# Integration audit

Scope: what could be inspected and operated from this environment, what was verified by executing
it, and what remains a manual step. Written to be checkable — nothing below is marked "tested"
unless it was actually run.

## 1. Repository

| Check | Result |
|---|---|
| Repository | `JaiYadav8889/digital-dark-spot` (cloned checkout) |
| Branch | `arena/33516a43-digital-dark-spot`, branched from `main` @ `79d7e1d` |
| Push access | yes (`git push origin arena/33516a43-digital-dark-spot`) |
| Pre-existing content | a single `Initial commit` (repo effectively empty) — nothing useful to preserve |
| Workflow files / CI | none |

## 2. Supabase

| Check | Result |
|---|---|
| Project | `aktubbwkbkekijuxjbwu`, region reachable through the connector |
| SQL / DDL | available — schema, views, RLS, seed data all applied by executing SQL |
| Storage | `source-documents` bucket created, private, 25 MB limit, pdf/text/html/docx |
| Edge Functions | `analyse`, `extract-source`, `system-status` deployed and ACTIVE (v1, `verify_jwt: true`) |
| Secrets | only the platform defaults are present: `GEMINI_API_KEY`, `GEMINI_MODEL`, `EXTRACTION_SERVICE_URL`, `EXTRACTION_SHARED_SECRET` are **not set** |
| Auth | email sign-up is available; SMTP is not configured (default sender, ~2 mails/hour), so password reset is best-effort only |

Verified by executing SQL against the live database:

- `v_requirement_status` returns 13 requirement rows for the demo session with the designed mix:
  8 found, 2 partial (R4, R8), 1 conflicting (R6), 2 outdated (R10, R12), 1 not found (R13).
- `v_session_summary` returns 8 sources / 8 processed / 0 failed, 13 requirements,
  4 open gaps, 2 open conflicts, 8 of 11 tasks open.
- The `v_session_summary` view was extended with `target_cycle` (the dashboard and history pages
  read it) and both views now have their inherited write privileges revoked for `anon`/`authenticated`
  — they are read-only projections.
- The `do $$ … foreach … end loop $$` policy block in `0001_core_schema.sql` was executed against the
  live database and completed without error; the resulting policies are 4 per session-keyed table
  and 3 on `finding_evidence`. (An earlier note claiming this block was invalid was wrong.)

**Limitation:** this sandbox's outbound network allows only `github.com`, `codeload.github.com`,
`api.github.com`, `registry.npmjs.org`, `pypi.org`, `files.pythonhosted.org`. Therefore
`*.supabase.co` and the Gemini API cannot be reached from a shell here, and no Edge Function could be
invoked with `curl`. Function behaviour is verified by code inspection plus 65 executable assertions in
`scripts/` that slice the *shipped* function sources, transform them, and exercise the helpers
(JSON recovery, schema validation, requirement generation, scoring, HTML→text, chunk paging).
That suite caught one real defect during this session: `stripHtml` emitted single newlines at block
boundaries, so paragraph-based chunking never saw paragraph breaks. It now emits a blank line and the
regression is covered by an assertion.

## 3. Vercel

| Check | Result |
|---|---|
| Existing projects | none |
| Project created | `digital-dark-spot` — `prj_SANq7l0QoDb3IWmSGQjaEgd4eqj2` |
| Framework / build | Vite, `npm run build`, output `dist` (recorded in `vercel.json` too) |
| Env vars | `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` set for production, preview and development |
| GitHub link | **not possible** — the Vercel account has no GitHub integration installed (`400 … you need to install the GitHub integration first`) |
| Deployment | none produced; without the Git link an upload deployment would have had to ship the whole tree as inline strings |

**Action required (2 minutes):** install the GitHub integration, link the repo, deploy. Then add
`EXTRACTION_SHARED_SECRET` as a Vercel env var and set the matching
`EXTRACTION_SERVICE_URL`/`EXTRACTION_SHARED_SECRET` in Supabase secrets. Exact steps are in
[SETUP.md](SETUP.md#5-link-vercel-to-github----action).

**Note:** this account's deployment protection is set to *all deployments except custom domains*, so
a `*.vercel.app` URL will ask viewers to log in to Vercel until that toggle is switched off. Judges
need it off (or a custom domain).

## 4. Gemini

No API key was available in this environment, so the AI path could not be executed end to end. It is
fully implemented (`analyse` builds the prompts, validates the JSON, retries once, falls back) and
the fallback path is what runs without a key — visibly labelled "Heuristic" in the UI, with the
reason stored in `research_sessions.analysis_error`.

`system-status` reports `gemini_configured` so the Settings page tells the truth about which engine
is active.

## 5. What was executed end to end

| Path | Verified how |
|---|---|
| Schema, views, RLS | SQL executed against the live project |
| Demo dataset integrity | SQL queries listed above |
| TypeScript / lint gate | `npx tsc -b --noEmit` clean |
| Production bundle | `npm run build` succeeds |
| Dev server + all routes | `npm run dev` serves `/`, `/app/*` with HTTP 200 |
| Analysis helpers | `node scripts/test-analysis.mjs` — 28 assertions, all passing |
| Extraction pipeline | `node scripts/test-extraction.mjs` — 17 assertions; `python3 scripts/test_extraction_service.py` — 20 assertions, all passing |
| Edge Function invocation from a browser | **not run here** (network egress limitation) — to be confirmed in the preview |

## 6. Known gaps, stated plainly

1. No Gemini key ⇒ AI analysis unverified at runtime; heuristic fallback works and is labelled.
2. Extraction service not deployed ⇒ PDF uploads fail with an explicit message; web pages use the
   labelled Deno fallback.
3. Vercel project exists but has never built this repo — the deployment URL is not live yet.
4. No authentication gate: sessions without an owner are readable with the anon key. Acceptable for
   a synthetic demo dataset; a one-line change (`owner_id` on insert) scopes it once Auth is enabled.
5. Email delivery for password reset is limited by Supabase's default SMTP.
6. The deployed `extract-source` is **version 1**, created before the paragraph-chunking fix found
   later in the session. Functionally identical for extraction, but paragraph boundaries are packed
   less faithfully. Redeploy to sync the repo and the runtime:
   `supabase functions deploy extract-source --project-ref aktubbwkbkekijuxjbwu`. `analyse` and
   `system-status` match the repository sources.
