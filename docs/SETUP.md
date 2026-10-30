# Setup and deployment

Everything below is what was actually done for this repository's live environment. Where a step
still needs a human (a credential only you hold, or a dashboard toggle), it is marked **ACTION**.

## 0. What already exists (verified this session)

| Item | Value |
|---|---|
| Supabase project | `aktubbwkbkekijuxjbwu` → `https://aktubbwkbkekijuxjbwu.supabase.co` |
| Schema + RLS + views | applied |
| Storage bucket | `source-documents` (private, 25 MB limit, pdf/text/html/docx) |
| Edge Functions | `analyse`, `extract-source`, `system-status` — all ACTIVE, version 1, JWT verification on |
| Vercel project | `digital-dark-spot` (`prj_SANq7l0QoDb3IWmSGQjaEgd4eqj2`) with `VITE_SUPABASE_URL` + `VITE_SUPABASE_PUBLISHABLE_KEY` set for production/preview/development |
| Demo dataset | session `00000000-0000-4000-8000-000000000001` (see [DEMO.md](DEMO.md)) |

**ACTION — still required for full functionality**

1. **Gemini key.** None was available in this environment, so `GEMINI_API_KEY` is unset. Until it is
   set, `analyse` uses the labelled heuristic engine (lexical matching) and says so in the UI.
2. **Extraction service.** `api/extract.py` needs to be deployed and its URL registered (steps 4–5).
   Until then, web pages extract through the Deno-native fallback and PDFs return an explicit
   "requires the extraction service" error.
3. **Vercel build.** The Vercel project is not yet linked to GitHub (the GitHub integration is not
   installed on the Vercel account), so no deployment has been produced from this repo.

## 1. Local frontend

```bash
npm install
cp .env.example .env      # VITE_SUPABASE_URL + VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev               # http://localhost:5173
```

The publishable key must be a signed **anon JWT** (starts `eyJ…`). A `sb_publishable_…` key is not a
JWT and the Edge Function gateway will reject it.

## 2. Supabase secrets — **ACTION**

Dashboard → Project Settings → Edge Functions → Secrets (or `supabase secrets set`):

| Secret | Value | Required |
|---|---|---|
| `GEMINI_API_KEY` | Google AI Studio key | yes, for AI analysis |
| `GEMINI_MODEL` | `gemini-2.5-flash` (default if unset) | optional |
| `EXTRACTION_SERVICE_URL` | e.g. `https://digital-dark-spot.vercel.app` | yes, for PDFs |
| `EXTRACTION_SHARED_SECRET` | any long random string (must equal the value set in Vercel) | recommended |

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected automatically — never copy them
elsewhere.

Verify from the UI: **Settings → System status** (it calls `system-status`) shows whether Gemini is
configured, whether the extraction service is reachable, and any notes.

## 3. Edge Functions

Deployed already. To redeploy after editing sources:

```bash
supabase functions deploy analyse        --project-ref aktubbwkbkekijuxjbwu
supabase functions deploy extract-source --project-ref aktubbwkbkekijuxjbwu
supabase functions deploy system-status  --project-ref aktubbwkbkekijuxjbwu
```

Each function is a single self-contained `index.ts` (no shared imports) so it can also be pasted
into the dashboard editor and deployed on its own.

## 4. Deploy the extraction service — **ACTION**

```bash
vercel link            # select the digital-dark-spot project
vercel env add EXTRACTION_SHARED_SECRET production   # same value as the Supabase secret
vercel --prod
```

`vercel.json` already routes `/api/extract` to `api/extract.py`, installs `requirements.txt`
(Trafilatura, PyMuPDF, Pillow, pytesseract) and sets `maxDuration: 60`.

Then register the URL:

```bash
curl -s https://<your-deployment>/api/extract | jq
# {"service":"digital-dark-spot-extraction","ok":true,"trafilatura":true,"pymupdf":true,
#  "tesseract_python":true,"tesseract_binary":false}
```

`tesseract_binary: false` is expected on Vercel — OCR needs the `tesseract-ocr` system package, which
the Python runtime does not include. Digital PDFs work; scanned PDFs will be reported as partially
extracted rather than silently mangled.

## 5. Link Vercel to GitHub — **ACTION**

Vercel → Settings → Git → connect `JaiYadav8889/digital-dark-spot`, framework preset **Vite**,
build `npm run build`, output `dist`. After that every push to `main` deploys automatically.

Also turn off **Deployment Protection → Vercel Authentication** for this project if you want judges
to open the `*.vercel.app` URL without logging in to Vercel; by default the account setting protects
all deployments except custom domains.

## 6. Re-seed the demo dataset (optional)

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed/csss_demo.sql
```

The file is idempotent per session id and matches the live dataset: 8 sources, 13 requirements,
11 findings, 11 checklist items, 17 evidence items, 20 evidence links, 5 job rows.

## 7. Tests

```bash
npm run typecheck                     # tsc -b --noEmit
npm run build                         # production bundle
node scripts/test-extraction.mjs      # extract-source logic (fetch/chunk/page mapping)
node scripts/test-analysis.mjs        # analyse stage helpers + validation
python3 scripts/test_extraction_service.py   # extraction service handlers
python3 scripts/extract_server.py     # local extraction service on :8000
```

The Python tests bind `127.0.0.1:8811` internally and need `trafilatura`, `pymupdf` and
`lxml_html_clean` installed (`pip install -r requirements.txt`).

## 8. Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| `Unauthorized` when invoking a function | publishable key is not a JWT | use the anon JWT from Project Settings → API |
| "Extraction requires the Python extraction service" on a PDF | `EXTRACTION_SERVICE_URL` unset or unreachable | deploy `api/extract.py`, set the secret, check `GET /api/extract` |
| Findings say "heuristic engine" | `GEMINI_API_KEY` unset or Gemini returned invalid JSON | set the key; check `analysis_error` on the session and the job row |
| Sources stuck on "Waiting" | extraction never invoked | press **Run analysis** again; the runner retries `waiting`/`failed` sources |
| Empty dashboard | no sessions yet or wrong project ref | check `.env`, then open `/app/history` |
