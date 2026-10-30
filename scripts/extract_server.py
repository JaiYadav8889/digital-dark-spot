"""Local runner for the extraction service.

Vercel serves `api/extract.py` directly; locally we need a real HTTP server so the
Edge Function (and the Vite dev proxy) can talk to it.

    python scripts/extract_server.py            # http://127.0.0.1:8000/api/extract
    EXTRACTION_SHARED_SECRET=devsecret python scripts/extract_server.py

Then set the Supabase secret EXTRACTION_SERVICE_URL=http://host.docker.internal:8000
(or a tunnel URL) — for local UI-only work you do not need this service at all.
"""
from __future__ import annotations

import os
import sys
from http.server import ThreadingHTTPServer

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "api"))

from extract import handler  # noqa: E402

if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8000"))
    server = ThreadingHTTPServer(("0.0.0.0", port), handler)
    caps = __import__("extract")._capabilities()
    print(f"Extraction service listening on http://0.0.0.0:{port}/api/extract")
    print(f"Capabilities: {caps}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down")
