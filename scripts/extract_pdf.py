#!/usr/bin/env python3
"""
Extract a PDF with the extraction service's own code and print JSON.

This is the bridge the offline importer uses: it calls
`api/extract.py::_extract_pdf`, i.e. exactly the function the deployed service
runs, so the text, page numbers and extractor label in the database come from the
shipped extraction path rather than from a second implementation.

    python3 scripts/extract_pdf.py path/to/file.pdf > out.json

Output:
    {"ok": true, "pages": [{"page": 1, "text": "…"}], "pageCount": 7,
     "title": "…", "filename": "…", "extractor": "pymupdf"}
or
    {"ok": false, "error": "…"}

The file is never read from the network and never modified.
"""
from __future__ import annotations

import base64
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from api import extract  # noqa: E402


def main() -> int:
    if len(sys.argv) < 2:
        print(json.dumps({"ok": False, "error": "usage: extract_pdf.py <file.pdf>"}))
        return 2

    path = sys.argv[1]
    if not os.path.isfile(path):
        print(json.dumps({"ok": False, "error": f"no such file: {path}"}))
        return 2

    with open(path, "rb") as handle:
        payload = handle.read()

    result = extract._extract_pdf(base64.b64encode(payload).decode("ascii"), os.path.basename(path))

    # Keep the payload small and predictable for the caller.
    if result.get("ok"):
        result["pages"] = [{"page": p.get("page"), "text": p.get("text", "")} for p in result.get("pages", [])]
        result["chars"] = sum(len(p["text"]) for p in result["pages"])
        result["bytes"] = len(payload)
    print(json.dumps(result))
    return 0 if result.get("ok") else 1


if __name__ == "__main__":
    sys.exit(main())
