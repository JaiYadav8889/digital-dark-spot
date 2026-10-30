#!/usr/bin/env python3
"""
Tests the real extraction service in api/extract.py.

The service is started on a loopback port (127.0.0.1:8811) and driven over HTTP,
so the request parsing, the capability report, the PDF page mapping, the honest
failure modes and the shared-secret check are all exercised as deployed.

    python3 scripts/test_extraction_service.py
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

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import extract  # noqa: E402

PORT = 8811
SECRET = "test-secret-value"

passed = 0
failed = 0


def check(name: str, condition: bool, detail: str = "") -> None:
    global passed, failed
    if condition:
        passed += 1
        print(f"  \u2713 {name}")
    else:
        failed += 1
        print(f"  \u2717 {name}{f' — {detail}' if detail else ''}")


def make_pdf(pages: list[str]) -> bytes:
    """Build a small digital PDF with exactly len(pages) pages of real text."""
    pymupdf = _pymupdf()
    doc = pymupdf.open()
    for body in pages:
        page = doc.new_page()
        page.insert_text((72, 100), body, fontsize=12)
    payload = doc.tobytes()
    doc.close()
    return payload


def make_image_only_pdf() -> bytes:
    """One page with a solid rectangle and no text layer (no OCR possible here)."""
    pymupdf = _pymupdf()
    doc = pymupdf.open()
    page = doc.new_page()
    page.draw_rect(pymupdf.Rect(72, 72, 400, 200), color=(0, 0, 0), fill=(0, 0, 0))
    payload = doc.tobytes()
    doc.close()
    return payload


def _pymupdf():
    try:
        import pymupdf  # type: ignore

        return pymupdf
    except ImportError:  # pragma: no cover
        import fitz  # type: ignore

        return fitz


def post(body: dict, secret: str | None = SECRET) -> tuple[int, dict]:
    data = json.dumps(body).encode()
    request = urllib.request.Request(
        f"http://127.0.0.1:{PORT}/api/extract",
        data=data,
        headers={"Content-Type": "application/json", **({"x-dds-secret": secret} if secret else {})},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode())


def get(secret: str | None = SECRET) -> tuple[int, dict]:
    request = urllib.request.Request(
        f"http://127.0.0.1:{PORT}/api/extract",
        headers={"x-dds-secret": secret} if secret else {},
    )
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return response.status, json.loads(response.read().decode())
    except urllib.error.HTTPError as exc:
        return exc.code, json.loads(exc.read().decode())


def main() -> int:
    os.environ["EXTRACTION_SHARED_SECRET"] = SECRET

    server = ThreadingHTTPServer(("127.0.0.1", PORT), extract.handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    try:
        print("\nextraction service\n")

        # 1 — health
        status, body = get()
        check("health returns 200", status == 200, str(status))
        check("health reports the service name", body.get("service") == "digital-dark-spot-extraction")
        check("health reports real capability flags", all(k in body for k in ("trafilatura", "pymupdf", "tesseract_binary")))

        # 2 — shared secret is enforced
        status, body = get(secret=None)
        check("requests without the secret are refused", status in (401, 403), f"{status} {body}")
        status, body = post({"kind": "url", "url": "https://example.com"}, secret="wrong")
        check("requests with a wrong secret are refused", status in (401, 403), str(status))

        # 3 — multi-page PDF keeps page numbers
        pdf = make_pdf(["Page one talks about eligibility and income limits.", "Page two lists documents and deadlines."])
        status, body = post({"kind": "pdf", "base64": base64.b64encode(pdf).decode(), "filename": "test.pdf"})
        check("pdf extraction succeeds", status == 200 and body.get("ok") is True, str(body)[:200])
        pages = body.get("pages") or []
        check("pdf keeps one entry per page", len(pages) == 2, f"pages={len(pages)}")
        check("pdf page numbers are 1-based and ordered", [p["page"] for p in pages] == [1, 2])
        check("pdf text is preserved", "eligibility" in pages[0]["text"].lower())
        check("pdf extractor is labelled", body.get("extractor", "").startswith("pymupdf"))

        # 4 — an image-only page fails honestly instead of inventing text
        status, body = post(
            {"kind": "pdf", "base64": base64.b64encode(make_image_only_pdf()).decode(), "filename": "scan.pdf"}
        )
        check("image-only pdf does not return invented text", not (body.get("ok") and any(p["text"].strip() for p in body.get("pages", []))), str(body)[:200])

        # 5 — SSRF guard
        status, body = post({"kind": "url", "url": "http://127.0.0.1:8811/api/extract"})
        check("loopback URLs are refused", body.get("ok") is False and status in (400, 422), f"{status} {body}")
        status, body = post({"kind": "url", "url": "http://169.254.169.254/latest/meta-data/"})
        check("link-local metadata URLs are refused", body.get("ok") is False)
        status, body = post({"kind": "url", "url": "file:///etc/passwd"})
        check("non-http schemes are refused", body.get("ok") is False)

        # 6 — bad payloads
        status, body = post({"kind": "pdf", "base64": base64.b64encode(b"not a pdf").decode(), "filename": "x.pdf"})
        check("corrupt pdf is rejected", body.get("ok") is False, str(body)[:160])
        status, body = post({"kind": "unknown"})
        check("unknown kind is rejected", body.get("ok") is False)

        # 7 — URL path runs trafilatura end to end (transport stubbed, parsing real)
        original_is_public = extract._is_public_host
        original_urlopen = urllib.request.urlopen
        html = (
            "<html><head><title>Scheme notice</title>"
            '<meta property="article:published_time" content="2026-10-01"></head><body>'
            "<article><h1>Scheme notice</h1>"
            "<p>The closing date for applications is 31 October 2026. Applications must be submitted "
            "through the national portal and verified by the institute before the deadline.</p>"
            "<p>Income limits and document requirements are unchanged from the previous cycle, and the "
            "ministry has not announced any revision for the current academic year.</p>"
            "</article></body></html>"
        ).encode()

        class FakeResponse(io.BytesIO):
            def __init__(self, data: bytes):
                super().__init__(data)
                self.headers = _Headers()

            def __enter__(self):
                return self

            def __exit__(self, *exc):
                return False

        class _Headers:
            def get(self, name, default=""):
                return "text/html; charset=utf-8" if name.lower() == "content-type" else default

            def get_content_charset(self):
                return "utf-8"

        def fake_urlopen(request, timeout=None):
            # Only intercept the target host; anything else behaves normally.
            url = request.full_url if hasattr(request, "full_url") else str(request)
            if "example.gov" in url:
                return FakeResponse(html)
            return original_urlopen(request, timeout=timeout)

        extract._is_public_host = lambda host: True  # bypass DNS for the stub target
        urllib.request.urlopen = fake_urlopen
        try:
            status, body = post({"kind": "url", "url": "https://example.gov/scheme-notice"})
        finally:
            urllib.request.urlopen = original_urlopen
            extract._is_public_host = original_is_public

        check("url extraction succeeds", body.get("ok") is True, str(body)[:200])
        check("url extractor is labelled", body.get("extractor") == "trafilatura")
        check("url text keeps the substantive sentence", "31 October 2026" in (body.get("text") or ""))
        check("url metadata is captured", (body.get("title") or "").strip().lower().startswith("scheme"))

        print(f"\n{passed} extraction-service assertions passed{'' if not failed else f', {failed} failed'}\n")
    finally:
        server.shutdown()
        server.server_close()

    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
