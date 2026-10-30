"""Integration tests for the extraction service (api/extract.py).

Exercises the real HTTP handler:
  * health / capability reporting
  * PDF text extraction with page numbers (PyMuPDF)
  * a scanned-style PDF with no text layer (must fail honestly, not fake text)
  * URL extraction through Trafilatura (network stubbed at the urllib layer)
  * SSRF guard for private hosts
  * shared-secret enforcement

Run: python scripts/test_extraction_service.py
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys
import threading
import urllib.error
import urllib.request
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

import extract as svc  # noqa: E402

PORT = 8811
BASE = f"http://127.0.0.1:{PORT}/api/extract"
passed = 0


def check(name: str, fn) -> None:
    global passed
    fn()
    passed += 1
    print(f"  \u2713 {name}")


def post(payload: dict, headers: dict | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        BASE,
        data=data,
        method="POST",
        headers={"Content-Type": "application/json", **(headers or {})},
    )
    try:
        with urllib.request.urlopen(req, timeout=60) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read())


def get(headers: dict | None = None) -> tuple[int, dict]:
    req = urllib.request.Request(BASE, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=30) as res:
            return res.status, json.loads(res.read())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read())


def make_pdf(pages: list[str]) -> bytes:
    """Build a real multi-page PDF with a text layer."""
    try:
        import pymupdf as fitz
    except ImportError:  # pragma: no cover
        import fitz

    doc = fitz.open()
    for body in pages:
        page = doc.new_page()
        page.insert_text((72, 96), body, fontsize=11)
    data = doc.tobytes()
    doc.close()
    return data


def run() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", PORT), svc.handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    print("extraction service")

    def health() -> None:
        status, body = get()
        assert status == 200, body
        assert body["ok"] is True
        assert body["trafilatura"] is True, "trafilatura should be importable"
        assert body["pymupdf"] is True, "pymupdf should be importable"

    def pdf_extraction() -> None:
        pdf = make_pdf([
            "Central Sector Scheme of Scholarships. The scholarship rate is 12000 per annum at graduation level.",
            "Renewal requires at least 50 percent marks in the annual examination and 75 percent attendance.",
        ])
        status, body = post({"kind": "pdf", "base64": base64.b64encode(pdf).decode(), "filename": "guidelines.pdf"})
        assert status == 200, body
        assert body["ok"] is True, body
        assert body["pageCount"] == 2, body
        assert [p["page"] for p in body["pages"]] == [1, 2], body
        assert "12000" in body["pages"][0]["text"].replace(",", ""), body["pages"][0]["text"]
        assert "attendance" in body["pages"][1]["text"], body["pages"][1]["text"]
        assert body["extractor"] in ("pymupdf", "pymupdf+tesseract"), body

    def scanned_pdf_fails_honestly() -> None:
        # A PDF with hatching but no text layer: must not invent text.
        try:
            import pymupdf as fitz
        except ImportError:  # pragma: no cover
            import fitz
        doc = fitz.open()
        page = doc.new_page()
        page.draw_rect(fitz.Rect(50, 50, 400, 400), color=(0, 0, 0), fill=(0.2, 0.2, 0.2))
        data = doc.tobytes()
        doc.close()
        status, body = post({"kind": "pdf", "base64": base64.b64encode(data).decode(), "filename": "scan.pdf"})
        assert body["ok"] is False, body
        assert "scanned" in body["error"].lower() or "no extractable" in body["error"].lower(), body

    def url_extraction_with_stubbed_network() -> None:
        html = b"""<html><head><title>Scheme page</title>
        <meta property="og:title" content="CSSS scheme page"><meta name="date" content="2025-10-01"></head>
        <body><nav>menu</nav><article>
        <p>The last date for students to submit applications is 31 October 2025. Institutes must verify by 15 November 2025.</p>
        <p>State nodal agencies complete verification by 30 November 2025. Applications are routed through the institute.</p>
        </article><footer>footer</footer></body></html>"""

        class FakeHeaders(dict):
            def get_content_charset(self):
                return "utf-8"

        class FakeResponse(io.BytesIO):
            headers = FakeHeaders(
                {
                    "Content-Type": "text/html; charset=utf-8",
                    "Content-Length": str(len(html)),
                }
            )

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        original_urlopen = urllib.request.urlopen
        original_guard = svc._is_public_host
        svc._is_public_host = lambda host: True  # bypass DNS guard for the stub

        def fake_urlopen(request, *args, **kwargs):
            url = getattr(request, "full_url", str(request))
            if "education.gov.in" in url:
                return FakeResponse(html)
            return original_urlopen(request, *args, **kwargs)  # type: ignore[operator]

        urllib.request.urlopen = fake_urlopen  # type: ignore[assignment]
        try:
            status, body = post({"kind": "url", "url": "https://www.education.gov.in/scheme"})
        finally:
            urllib.request.urlopen = original_urlopen
            svc._is_public_host = original_guard

        assert status == 200, body
        assert body["ok"] is True, body
        assert body["extractor"] == "trafilatura", body
        text = body["text"]
        assert "31 October 2025" in text, text
        assert "30 November 2025" in text, text
        assert "menu" not in text.lower(), "navigation should be dropped"
        assert body["title"], body
        assert body["publishedDate"] in ("2025-10-01", None), body

    def ssrf_guard() -> None:
        status, body = post({"kind": "url", "url": "http://127.0.0.1:8811/api/extract"})
        assert body["ok"] is False, body
        assert "private" in body["error"].lower() or "cannot be fetched" in body["error"].lower(), body

    def rejects_non_pdf() -> None:
        status, body = post({"kind": "pdf", "base64": base64.b64encode(b"not a pdf at all" * 20).decode()})
        assert body["ok"] is False
        assert "valid pdf" in body["error"].lower(), body

    def rejects_unknown_kind() -> None:
        status, body = post({"kind": "spreadsheet"})
        assert status == 400, (status, body)

    check("health reports Trafilatura and PyMuPDF availability", health)
    check("multi-page PDF keeps page numbers and text", pdf_extraction)
    check("image-only PDF fails honestly instead of inventing text", scanned_pdf_fails_honestly)
    check("URL extraction works through Trafilatura", url_extraction_with_stubbed_network)
    check("private-network URLs are refused", ssrf_guard)
    check("non-PDF payloads are rejected", rejects_non_pdf)
    check("unknown payload kinds are rejected", rejects_unknown_kind)

    def shared_secret() -> None:
        os.environ["EXTRACTION_SHARED_SECRET"] = "s3cret"
        try:
            status, body = get()
            assert status == 401, (status, body)
            status, body = get(headers={"x-dds-secret": "s3cret"})
            assert status == 200, (status, body)
        finally:
            os.environ.pop("EXTRACTION_SHARED_SECRET", None)

    check("shared secret is enforced when configured", shared_secret)

    server.shutdown()
    print(f"\n{passed} extraction-service assertions passed")


if __name__ == "__main__":
    run()
