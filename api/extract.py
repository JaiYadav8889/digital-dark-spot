"""
Digital Dark Spot — extraction service.

Why this exists
---------------
Supabase Edge Functions run Deno. Trafilatura and PyMuPDF are Python packages and
cannot be imported there, and substituting a weaker extractor for a PDF would
quietly degrade the evidence the product is built on. So extraction lives in a
separate, deployable service (Vercel Python runtime) and the Edge Function calls
it over HTTPS.

Endpoints (both served by this one file):
    GET  /api/extract   → health / capability report
    POST /api/extract   → { kind: "url" | "pdf", ... }

POST body for URLs:
    { "kind": "url", "url": "https://…" }

POST body for PDFs:
    { "kind": "pdf", "base64": "JVBERi0…", "filename": "guidelines.pdf" }

Responses:
    url  → {"ok": true, "text", "title", "siteName", "publishedDate", "extractor"}
    pdf  → {"ok": true, "pages": [{"page": 1, "text": "…"}], "pageCount", "extractor", "title"}
    error→ {"ok": false, "error": "…"}  with a non-200 status where appropriate

Security
--------
If EXTRACTION_SHARED_SECRET is set in the environment, every request must carry
the matching `x-dds-secret` header. Private/link-local address space is refused
so the service cannot be used as an SSRF pivot.
"""
from __future__ import annotations

import base64
import io
import ipaddress
import json
import os
import re
import socket
import sys
from http.server import BaseHTTPRequestHandler
from typing import Any
from urllib.parse import urlparse

MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024
MAX_REQUEST_BYTES = 24 * 1024 * 1024
MAX_PDF_BYTES = 18 * 1024 * 1024
FETCH_TIMEOUT = 25
OCR_MIN_CHARS = 40

USER_AGENT = (
    "Mozilla/5.0 (compatible; DigitalDarkSpot/1.0; +https://github.com/JaiYadav8889/digital-dark-spot) "
    "EvidenceExtractor"
)


def _capabilities() -> dict[str, Any]:
    caps: dict[str, Any] = {"service": "digital-dark-spot-extraction", "ok": True}
    try:
        import trafilatura  # noqa: F401

        caps["trafilatura"] = True
    except Exception:  # pragma: no cover - environment dependent
        caps["trafilatura"] = False
    try:
        try:
            import pymupdf  # noqa: F401
        except ImportError:
            import fitz  # noqa: F401

        caps["pymupdf"] = True
    except Exception:  # pragma: no cover
        caps["pymupdf"] = False
    try:
        import pytesseract  # noqa: F401

        caps["tesseract_python"] = True
        caps["tesseract_binary"] = bool(_tesseract_available())
    except Exception:  # pragma: no cover
        caps["tesseract_python"] = False
        caps["tesseract_binary"] = False
    return caps


def _tesseract_available() -> str | None:
    from shutil import which

    return which("tesseract")


def _is_public_host(hostname: str) -> bool:
    """Refuse loopback, private and link-local targets (basic SSRF guard)."""
    if not hostname:
        return False
    lowered = hostname.lower()
    if lowered in {"localhost", "metadata.google.internal"} or lowered.endswith(".local"):
        return False
    try:
        infos = socket.getaddrinfo(hostname, None)
    except socket.gaierror:
        return False
    for info in infos:
        try:
            address = ipaddress.ip_address(info[4][0])
        except ValueError:
            continue
        if (
            address.is_private
            or address.is_loopback
            or address.is_link_local
            or address.is_reserved
            or address.is_multicast
        ):
            return False
    return True


def _extract_url(url: str) -> dict[str, Any]:
    import trafilatura

    # trafilatura 1.x exposes extract_metadata at the top level; 2.x moved it to
    # trafilatura.metadata. Supporting both keeps the pinned range honest.
    try:
        from trafilatura.metadata import extract_metadata
    except ImportError:  # pragma: no cover - trafilatura 1.x
        from trafilatura import extract_metadata  # type: ignore[attr-defined]

    parsed = urlparse(url)
    if parsed.scheme not in ("http", "https"):
        return {"ok": False, "error": "Only http and https URLs are supported."}
    if not _is_public_host(parsed.hostname or ""):
        return {"ok": False, "error": "That host cannot be fetched (private, local or unresolvable)."}

    import urllib.request

    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"})
    try:
        with urllib.request.urlopen(request, timeout=FETCH_TIMEOUT) as response:
            content_type = response.headers.get("Content-Type", "")
            if "application/pdf" in content_type.lower():
                return {
                    "ok": False,
                    "error": "This URL returns a PDF. Upload the document instead so page numbers can be cited.",
                }
            if not any(t in content_type.lower() for t in ("text/html", "text/plain", "application/xhtml")):
                return {"ok": False, "error": f"Unsupported content type: {content_type or 'unknown'}"}
            raw = response.read(MAX_DOWNLOAD_BYTES + 1)
            if len(raw) > MAX_DOWNLOAD_BYTES:
                return {"ok": False, "error": "The page is larger than the 15 MB processing limit."}
            encoding = response.headers.get_content_charset() or "utf-8"
            html = raw.decode(encoding, errors="replace")
    except Exception as exc:  # network errors surface honestly
        return {"ok": False, "error": f"Could not fetch the URL: {exc}"}

    config = None
    try:  # trafilatura 1.x accepts a config object; 2.x does not need one
        from trafilatura.settings import use_config

        config = use_config()
        config.set("DEFAULT", "EXTRACTION_TIMEOUT", "20")
    except Exception:
        config = None

    extract_kwargs: dict[str, Any] = {
        "favor_recall": True,
        "include_comments": False,
        "include_tables": True,
        "include_formatting": False,
    }
    if config is not None:
        extract_kwargs["config"] = config
    else:
        extract_kwargs["no_fallback"] = False

    text = trafilatura.extract(html, **extract_kwargs)
    metadata = None
    try:
        metadata = extract_metadata(html, default_url=url)
    except Exception:
        metadata = None

    if not text and metadata and getattr(metadata, "title", None):
        # Fall back to a metadata-only pass so the caller at least gets the title.
        text = ""

    title = None
    if metadata is not None:
        title = getattr(metadata, "title", None)
        site_name = getattr(metadata, "sitename", None)
        date = getattr(metadata, "date", None)
    else:
        site_name, date = None, None

    return {
        "ok": True,
        "text": (text or "").strip(),
        "title": title,
        "siteName": site_name,
        "publishedDate": date,
        "extractor": "trafilatura",
    }


def _ocr_page(page: Any) -> str:
    """OCR a single PyMuPDF page. Returns empty string when OCR is unavailable."""
    try:
        import pytesseract
        from PIL import Image
    except Exception:
        return ""
    if not _tesseract_available():
        return ""
    try:
        pixmap = page.get_pixmap(dpi=200)
        image = Image.open(io.BytesIO(pixmap.tobytes("png")))
        return pytesseract.image_to_string(image) or ""
    except Exception:
        return ""


def _extract_pdf(base64_data: str, filename: str) -> dict[str, Any]:
    try:  # PyMuPDF >= 1.24 prefers the `pymupdf` module name, `fitz` still works
        import pymupdf as fitz
    except ImportError:  # pragma: no cover
        try:
            import fitz  # type: ignore[no-redef]
        except Exception:
            return {"ok": False, "error": "PyMuPDF is not installed on the extraction service."}

    try:
        data = base64.b64decode(base64_data, validate=False)
    except Exception as exc:
        return {"ok": False, "error": f"Invalid base64 payload: {exc}"}

    if len(data) > MAX_PDF_BYTES:
        return {"ok": False, "error": "The PDF is larger than the 18 MB processing limit."}
    if not data.startswith(b"%PDF"):
        return {"ok": False, "error": "That file is not a valid PDF."}

    try:
        document = fitz.open(stream=data, filetype="pdf")
    except Exception as exc:
        return {"ok": False, "error": f"PyMuPDF could not open this document: {exc}"}

    if getattr(document, "needs_pass", False):
        return {"ok": False, "error": "The PDF is password protected and cannot be read."}

    pages: list[dict[str, Any]] = []
    ocr_used = False
    digital_pages = 0

    for index, page in enumerate(document):
        try:
            text = page.get_text("text") or ""
        except Exception:
            text = ""
        text = _tidy(text)
        if len(text) < OCR_MIN_CHARS:
            ocr_text = _tidy(_ocr_page(page))
            if len(ocr_text) > len(text):
                text = ocr_text
                ocr_used = True
        if len(text) >= OCR_MIN_CHARS:
            digital_pages += 1
        if text:
            pages.append({"page": index + 1, "text": text})

    title = None
    try:
        metadata = document.metadata or {}
        title = metadata.get("title") or None
        if title and len(title.strip()) < 3:
            title = None
    except Exception:
        title = None

    page_count = document.page_count
    document.close()

    if not pages:
        return {
            "ok": False,
            "error": (
                "No extractable text found. This looks like a scanned document, and OCR was unavailable "
                "or produced nothing."
            ),
        }

    extractor = "pymupdf"
    if ocr_used:
        extractor = "pymupdf+tesseract"
    elif digital_pages == 0:
        extractor = "pymupdf"

    return {
        "ok": True,
        "pages": pages,
        "pageCount": page_count,
        "title": title,
        "filename": filename,
        "extractor": extractor,
    }


def _tidy(text: str) -> str:
    text = text.replace("\u00ad", "")
    text = re.sub(r"[ \t\u00a0]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


class handler(BaseHTTPRequestHandler):  # noqa: N801 - Vercel python runtime convention
    protocol_version = "HTTP/1.1"

    # ---------------------------------------------------------------- helpers
    def _send(self, payload: dict[str, Any], status: int = 200) -> None:
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Headers", "content-type, x-dds-secret")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.end_headers()
        self.wfile.write(body)

    def _authorised(self) -> bool:
        expected = os.environ.get("EXTRACTION_SHARED_SECRET", "").strip()
        if not expected:
            return True  # no secret configured: open (documented in DEPLOYMENT.md)
        supplied = (self.headers.get("x-dds-secret") or "").strip()
        return supplied == expected

    def log_message(self, fmt: str, *args: Any) -> None:  # quieter logs
        sys.stderr.write("extract: " + (fmt % args) + "\n")

    # ----------------------------------------------------------------- routes
    def do_OPTIONS(self) -> None:  # noqa: N802
        self._send({"ok": True})

    def do_GET(self) -> None:  # noqa: N802
        if not self._authorised():
            self._send({"ok": False, "error": "Unauthorised."}, 401)
            return
        self._send(_capabilities())

    def do_POST(self) -> None:  # noqa: N802
        if not self._authorised():
            self._send({"ok": False, "error": "Unauthorised."}, 401)
            return

        try:
            length = int(self.headers.get("Content-Length") or "0")
        except ValueError:
            self._send({"ok": False, "error": "Invalid Content-Length."}, 400)
            return
        if length <= 0 or length > MAX_REQUEST_BYTES:
            self._send({"ok": False, "error": "Request body is empty or too large."}, 413)
            return

        try:
            payload = json.loads(self.rfile.read(length).decode("utf-8"))
        except Exception as exc:
            self._send({"ok": False, "error": f"Invalid JSON: {exc}"}, 400)
            return

        kind = (payload or {}).get("kind")
        try:
            if kind == "url":
                url = (payload or {}).get("url") or ""
                if not isinstance(url, str) or not url.startswith(("http://", "https://")):
                    self._send({"ok": False, "error": "A valid http(s) url is required."}, 400)
                    return
                result = _extract_url(url)
                self._send(result, 200 if result.get("ok") else 422)

            elif kind == "pdf":
                data = (payload or {}).get("base64") or ""
                if not isinstance(data, str) or len(data) < 100:
                    self._send({"ok": False, "error": "A base64 pdf payload is required."}, 400)
                    return
                result = _extract_pdf(data, str((payload or {}).get("filename") or "document.pdf"))
                self._send(result, 200 if result.get("ok") else 422)

            else:
                self._send({"ok": False, "error": 'kind must be "url" or "pdf".'}, 400)
        except Exception as exc:  # never leak a stack trace to the caller
            self._send({"ok": False, "error": f"Extraction failed: {exc}"}, 500)
