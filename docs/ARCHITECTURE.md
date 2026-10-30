# Architecture

Digital Dark Spot is deliberately split into four modules with one-way dependencies, so that a
failure in one cannot corrupt the others and no privileged credential ever reaches the browser.

```
┌─────────────────────────────┐
│  Presentation (React/Vite)  │  publishable key only
└──────────────┬──────────────┘
               │  supabase-js (RLS-protected reads/writes, function invokes)
┌──────────────▼──────────────┐
│  Backend processing         │  Supabase Postgres + Edge Functions
│  extract-source · analyse   │  service-role key stays inside the function
└───────┬─────────────┬───────┘
        │             │
┌───────▼──────┐  ┌───▼─────────────────┐
│ Extraction   │  │  AI analysis        │
│ service (Py) │  │  Gemini (server-side)│
└──────────────┘  └─────────────────────┘
```

## 1. Presentation — `src/`

- `lib/supabase.ts` creates the browser client from `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY` (a public anon key). If either is missing the app renders a
  configuration state instead of throwing at import time.
- `lib/api.ts` is the only module that talks to the database or invokes functions. Errors are
  normalised into `ApiError` with an optional `hint`.
- `lib/status.ts` holds the entire analytical vocabulary: relation names, requirement statuses,
  finding kinds, source states, tones/colours, the coverage formula and the standing disclaimers.
  Components never hard-code a status string.
- `lib/stats.ts` aggregates dashboard numbers from real rows.
- `hooks/useAnalysisRunner.ts` orchestrates the pipeline as **sequential, individually retryable
  function calls** (extraction → requirements → evidence → findings → checklist). Each call is
  bounded; the hook loops while the function reports `remaining > 0`, so no single HTTP request has
  to finish a long document.
- `hooks/useSessionData.ts` loads a session and all of its rows in parallel and exposes a `refresh`.

Presentation rules enforced in `index.css` / `tailwind.config.js`: dark-first surfaces, one accent
(violet/indigo), cyan secondary, emerald success, amber warning, coral conflict; no neon or glass.

## 2. Backend processing — Supabase

Three Edge Functions, each self-contained (no shared imports, so a function can be deployed alone):

| Function | Contract |
|---|---|
| `extract-source` | `POST {source_id, mode: 'fetch' \| 'retry'}` → `{ok, status, extractor, chunks, char_count, message}` |
| `analyse` | `POST {session_id, stage: requirements\|evidence\|findings\|checklist\|full, batch_size}` → `{status, stage, engine, message, processed?, remaining?}` |
| `system-status` | `GET`/`POST` → `{gemini_configured, gemini_model, extraction_service_configured, extraction_service_reachable, service_role_configured, notes[]}` |

Both `extract-source` and `analyse` write an `analysis_jobs` row (`queued → running → succeeded |
failed`) with `progress`, a human message, the engine used and, for the evidence stage, a `payload`
cursor. The UI reads the same rows, so progress is real rather than simulated.

**Long work is bounded, not assumed.** `analyse` stops after 60 s of wall-clock work or
`batch_size` sources, persists its cursors, and reports `remaining`. The client calls again until
`remaining` is 0. Nothing depends on a single invocation finishing.

## 3. Extraction — `api/extract.py`

A standalone Python service, deployed as a Vercel Python function and runnable locally via
`scripts/extract_server.py`.

- Trafilatura for web pages, PyMuPDF for digital PDFs, Tesseract (via pytesseract) only as an
  optional OCR fallback when a page yields fewer than ~40 characters.
- Guarded by `x-dds-secret` against `EXTRACTION_SHARED_SECRET`; SSRF guard rejects private hosts.
- Limits: 15 MB download cap, 25 s fetch timeout, 18 MB PDF cap, 24 MB request cap, 40 chunks max.
- Health: `GET /api/extract` returns which capabilities are genuinely available
  (`trafilatura`, `pymupdf`, `tesseract_python`, `tesseract_binary`).

Supabase Edge Functions cannot run PyMuPDF or Trafilatura, so this service exists outside them. If
`EXTRACTION_SERVICE_URL` is unset, `extract-source` falls back to a Deno-native HTML fetch for
**web pages only**, labels the source `extractor = 'deno-html-fallback'`, and returns an explicit
error for PDFs rather than pretending to read them.

## 4. AI analysis — Gemini, server-side only

`analyse` is the only place Gemini is called. Key from `GEMINI_API_KEY`, model from `GEMINI_MODEL`
(default `gemini-2.5-flash`), `responseMimeType: application/json`, temperature 0.15, 55 s abort.

Grounding rules encoded in every prompt (`SYSTEM_RULES`):

1. Report only what the supplied evidence says — no outside facts.
2. Never say information does not exist; use "not found in the sources reviewed".
3. Hedge uncertainty; findings are signals for verification, not verdicts.
4. Return JSON only, with no commentary.

Every response is schema-validated field by field (`str`, `oneOf`, `num`, `asArray`). A response
that fails validation is retried once; if it still fails the stage falls back to a deterministic
**heuristic engine** and records the reason in `research_sessions.analysis_error` and in the job
message. The UI shows the engine label (`Gemini` / `Heuristic` / `Curated demo`) next to the
findings, so a fallback is never mistaken for AI output.

### Stage detail

- **requirements** — objective + context + cycle → 8–14 requirements (description, category,
  importance, why it matters, expected evidence). Domain-agnostic: the prompt forbids assuming a
  scholarship or any other subject. Deleting requirements cascades to findings/checklist.
- **evidence** — per source, chunks are sent with the requirement list; the model returns verbatim
  `claim_text` plus `SUPPORTS | PARTIAL | CONFLICTS | OUTDATED` links with rationale and confidence.
  Each claim is checked against the chunk text (`quote_verified`) — page numbers come from the
  parsed chunk, never from the model.
- **findings** — requirement status (from `v_requirement_status`, not from the model) plus the
  numbered evidence digest produce `gap | conflict | outdated | unanswered | insight` findings,
  each linked to evidence through `finding_evidence` with roles `claim_a/claim_b/context`.
- **checklist** — findings → prioritised, actionable verification items; `recommended_source` is a
  named authority or category, never an invented URL.

## Data-integrity invariants

- Requirement status is **derived** in `v_requirement_status` and never stored, so a status cannot
  drift from the evidence that produced it.
- Every finding links to at least one evidence row whenever evidence exists (`finding_evidence`).
- Every evidence row points at a source and, where applicable, a chunk with a real page number.
- Deleting a session cascades through sources → chunks → evidence → links → findings → checklist.

## Security posture

- The browser holds only the publishable anon key; the Gemini key and the service-role key exist
  solely as Edge Function secrets.
- RLS is enabled on all ten tables; child tables are guarded by `can_access_session(session_id)`.
- Sessions without an owner are readable by the anon key. That is required for a no-login demo and
  is the reason demo data is synthetic. Adding Supabase Auth and setting `owner_id` scopes every
  session to its creator with no schema change.
- File uploads are validated by MIME type and size in the browser *and* re-validated in the
  extraction path; URLs are scheme-checked and host-checked (SSRF guard).
