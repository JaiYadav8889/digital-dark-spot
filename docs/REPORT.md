# Final delivery report

**Digital Dark Spot** — GRAVITON 2026, Team NEXORA, ISTE CGC University, Mohali.
Status date: 2026-10-30. Branch `arena/33516a43-digital-dark-spot`.

> Every line below distinguishes what was **executed and observed** from what was written but could
> not be run in this environment. Where an integration is blocked, the exact remaining action is
> given.

---

## 1. Component status

### Implemented and tested

| Component | Evidence |
|---|---|
| Relational schema (10 tables, 3 views, indexes, triggers, cascades) | applied to the live project; column list verified against `src/lib/types.ts` |
| Row Level Security (4 policies per session-keyed table, parent-scoped policies on `finding_evidence`) | policies counted live: 10 tables, 40+ policies |
| `v_requirement_status` status derivation | SQL executed: 13 rows for the demo session with the intended mix |
| `v_session_summary` roll-up | SQL executed; counts match the seeded dataset |
| `v_claims` claim-level projection | created and queried: 17 claims, 17 linked, 16 quote-verified |
| Storage bucket `source-documents` (private, 25 MB, pdf/text/html/docx) | queried from `storage.buckets` |
| Demo dataset (8 sources, 13 requirements, 17 claims, 20 links, 11 findings, 11 checklist items, 5 jobs) | seeded and queried; the seed file parses to exactly these counts |
| Frontend build | `npm run build` green; 40 modules transform under Vite; all routes return 200 |
| Type gate | `npx tsc -b --noEmit` clean |
| Extraction text utilities (real shipped code) | 17 assertions — `node scripts/test-extraction.mjs` |
| Analysis helpers (real shipped code) | 28 assertions — `node scripts/test-analysis.mjs` |
| Extraction service handlers | 20 assertions over HTTP — `python3 scripts/test_extraction_service.py` |
| Benchmark harness | runs; refuses to emit a score without two agreeing human reviews |
| Edge Function syntax | all three parse under esbuild |

### Implemented but not fully tested

| Component | Why not fully tested |
|---|---|
| `analyse` Edge Function (4 stages, Gemini + heuristic fallback, cursor-bounded evidence mapping) | Deployed and type-clean, but this sandbox's egress allowlist blocks `*.supabase.co`, so it could not be invoked from here. Behaviour is covered at the helper level by the 28 assertions; the HTTP path must be confirmed from a browser. |
| `extract-source` Edge Function (fetch → chunk → store, retry, page mapping) | Same network limitation. Deployed as v1 *before* the paragraph-chunking fix; redeploy pending. |
| `system-status` Edge Function | Same limitation; contract is a simple capability probe. |
| Session creation → source add → analysis → findings → checklist (full user journey) | Every step exists and its SQL surface is verified, but the click-path could not be driven without a browser. |
| Responsive layout (mobile) | Tailwind breakpoints applied throughout; not visually verified on a device. |

### Partially implemented

| Component | State |
|---|---|
| Gemini analysis | Prompts, JSON-mode calls, schema validation, single retry and labelled heuristic fallback are implemented and deployed. **No API key exists in this environment**, so no live Gemini call has ever run. Nothing in the UI claims otherwise: the session shows the engine that actually produced the rows. |
| PDF ingestion | Fully implemented (Storage upload → base64 → PyMuPDF → page-preserving chunks → OCR fallback). Requires the extraction service to be deployed; until then PDFs fail with an explicit message rather than degrading silently. |
| Benchmark | 6 of 36 cases authored (all real, from the demo dataset); 0 locked; 0 synthetic; categories provisional. No accuracy is claimed. |
| Auth | Supabase Auth is wired (sign-in/sign-up/sign-out in Settings) and `owner_id` scoping exists in RLS. The demo path runs unauthenticated, so sessions without an owner are readable with the anon key. |

### Blocked by configuration

| Component | Blocker | Exact action |
|---|---|---|
| Gemini analysis at runtime | No `GEMINI_API_KEY` | Supabase → Edge Functions → Secrets → add `GEMINI_API_KEY` (and optionally `GEMINI_MODEL`) |
| PDF extraction at runtime | Extraction service not deployed | `vercel --prod` with `api/extract.py`, then set `EXTRACTION_SERVICE_URL` + `EXTRACTION_SHARED_SECRET` in Supabase secrets |
| Vercel deployment | Vercel account has **no GitHub integration installed** (`400 … install the GitHub integration first`); the project exists but has never built | Install the GitHub integration → import `JaiYadav8889/digital-dark-spot` → framework Vite, build `npm run build`, output `dist` → deploy |
| Public demo URL | Account-level deployment protection is *all deployments except custom domains* | Vercel → Settings → Deployment Protection → turn off Vercel Authentication for this project |
| Redeploy of `extract-source` | CLI needed | `supabase functions deploy extract-source --project-ref aktubbwkbkekijuxjbwu` |

### Not implemented

- Live web-search discovery of new sources (out of scope; sources are user-supplied by design).
- Automated evaluation of the heuristic engine against the full benchmark (needs the review work first).
- Background queue/cron to chain analysis stages server-side. Stages are chained client-side with
  per-stage job rows and retries; a cron is an optimisation, not a missing capability.

---

## 2. Infrastructure facts

| Item | Value |
|---|---|
| Repository | `https://github.com/JaiYadav8889/digital-dark-spot` |
| Branch | `arena/33516a43-digital-dark-spot` |
| Latest commit | see `git log -1` on that branch (final commit of this session) |
| Vercel project | `digital-dark-spot` — `prj_SANq7l0QoDb3IWmSGQjaEgd4eqj2`; env `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` set for production/preview/development |
| Vercel deployment URL | **none yet** — not verifiable, so not claimed |
| Supabase project | `aktubbwkbkekijuxjbwu` → `https://aktubbwkbkekijuxjbwu.supabase.co` |
| Migrations | `supabase/migrations/0001_core_schema.sql` (tables, views, indexes, RLS, storage policies, grants) and `0002_claims_view.sql` — both applied to the live database |
| Edge Functions | `analyse`, `extract-source`, `system-status` — ACTIVE v1, `verify_jwt: true` |
| Storage | bucket `source-documents`, private, 1-hour signed URLs |
| Secrets present | platform defaults only (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_PUBLISHABLE_KEYS`, `SUPABASE_SECRET_KEYS`, `SUPABASE_DB_URL`, `SUPABASE_JWKS`) |
| Secrets missing | `GEMINI_API_KEY`, `GEMINI_MODEL`, `EXTRACTION_SERVICE_URL`, `EXTRACTION_SHARED_SECRET` |

---

## 3. Test results

```
npx tsc -b --noEmit                                  clean
npm run build                                        success (dist/ 1.0 MB js, 45 kB css)
node scripts/test-extraction.mjs                     17/17 assertions
node scripts/test-analysis.mjs                       28/28 assertions
python3 scripts/test_extraction_service.py           20/20 assertions
node scripts/benchmark.mjs --self-check              harness plumbing OK (no score claimed)
```

The suites load the **shipped** function sources (sliced, type-stripped, imported), not copies. They
found and fixed a real defect: `stripHtml` emitted single newlines at block boundaries so
paragraph-aware chunking never saw paragraph breaks.

SQL verification executed against the live database:

- 13 requirement status rows: 7 found, 2 partial, 1 conflicting, 2 outdated, 1 not found (R13).
- Session roll-up: 8 sources / 8 processed / 0 failed, 13 requirements, 4 open gaps, 2 open conflicts, 9 of 11 tasks open.
- `v_claims`: 17 claims, all linked, 16 quote-verified (the 17th is the snippet-only source).
- Policy block executed without error; view write privileges revoked for `anon`/`authenticated`.

**Not run here:** any request to `*.supabase.co` or `generativelanguage.googleapis.com`. The sandbox
egress allowlist is GitHub/npm/PyPI only. Consequently no Edge Function was invoked and no browser
journey was driven from this environment. Those are the two checks to repeat first.

---

## 4. Known limitations

1. Without `GEMINI_API_KEY`, requirement decomposition uses an 8-question structural template and
   evidence mapping uses lexical scoring. Both are labelled `heuristic` in the UI and in the job row.
2. The demo dataset is curated, not live-extracted. It is displayed with the exact disclaimer:
   *"Demonstration dataset based on the Phase 1 research inventory — verify against the current
   official NSP portal before making application decisions."*
3. Sources recorded from the inventory without a URL show **"URL unavailable for verification"**
   instead of a fabricated link; the snippet-only scheme page is marked `quote_verified = false`.
4. Sessions with no owner are readable with the anon key (required for a no-login demo). Enabling
   Auth and setting `owner_id` scopes them with no schema change.
5. Password reset email is limited by Supabase's default SMTP.
6. The deployed `extract-source` predates the chunking fix (see above) — redeploy to sync.
7. The coverage figure is importance-weighted evidence coverage of the reviewed sources, with the
   formula and weights shown; it is never presented as a completeness percentage of reality.

---

## 5. Three-to-five minute demonstration

1. **Landing (20 s).** Headline: *"The most important information might be the information you
   haven't found."* Point at the fragmented-information → evidence-map illustration.
2. **Open the demonstration case (30 s).** `/app/history` → the case is in its own *Demonstration*
   group. Read the amber banner aloud — that is the honesty contract.
3. **Overview (45 s).** Six cards computed from rows; coverage chart with the formula in the
   tooltip; requirement matrix. Line: *coverage is coverage of the sources reviewed, not of reality.*
4. **R13 — not found (40 s).** Requirements tab → open R13. "The 2026–27 application window is not
   found in the sources reviewed" plus the sentence that this is *not* evidence it does not exist.
5. **R6 — conflicting (45 s).** Three guides, three dates (31 Oct / 30 Sep / 25 Oct). Both claims
   side by side with source, date and page. Explain why the app says *possible inconsistency
   requiring verification* and names the stage difference as the likely explanation.
6. **Outdated vs undated (30 s).** R10/R12 are outdated because the source describes an earlier
   cycle; the undated mirror is flagged unknown-validity, not outdated.
7. **Evidence explorer (30 s).** Click any excerpt: source title, type, issuer, date, page, relation
   rationale. Show a source whose URL is unavailable — no invented link.
8. **Checklist (25 s).** 9 of 11 open, prioritised, each with a named authority. Tick one; the count
   moves and persists.
9. **Live run (30 s, if Gemini is configured).** New research → two URLs → **Run analysis**. Say which
   engine ran. If Gemini is not configured, show the heuristic label instead of implying AI.
10. **Close.** "We don't answer your question. We tell you what your evidence does not establish, and
    what to verify next."
