# Digital Dark Spot

**Find what information is missing, not just what is available.**

Digital Dark Spot is an **Information Completeness Analysis** platform. You give it a research
objective and a set of sources (URLs and PDFs). It decomposes the objective into structured
information requirements, extracts claim-level evidence from every source, maps that evidence onto
the requirements, and then reports what the reviewed material **does not establish**, where sources
**appear to disagree**, what looks **potentially outdated**, and **what you should verify next** —
every claim traceable to an exact excerpt and its source.

> Built for **GRAVITON 2026** by **Team NEXORA**, ISTE CGC University, Mohali.

Every output is presented as a **potential finding / signal for human verification**. The product
never says information "does not exist" — only that it **was not found in the sources reviewed**.

---

## What the app actually does

| # | Workflow step | Where it lives |
|---|---------------|----------------|
| 1 | Enter a research question, optional context, target cycle/date range | `src/pages/NewResearch.tsx` |
| 2 | Add sources by URL or PDF upload (single + multiple) | `src/components/session/SourcesPanel.tsx` |
| 3 | Extract and organise content into ~2 000-character chunks | `supabase/functions/extract-source` + `api/extract.py` |
| 4 | Generate structured information requirements | `supabase/functions/analyse` (stage `requirements`) |
| 5 | Extract claims / evidence verbatim | `analyse` (stage `evidence`) |
| 6 | Map evidence → requirements (SUPPORTS / PARTIAL / CONFLICTS / OUTDATED / NOT FOUND) | `analyse` (stage `evidence`) + `v_requirement_status` |
| 7 | Identify gaps | `analyse` (stage `findings`) |
| 8 | Detect cross-source contradictions | `analyse` (stage `findings`) |
| 9 | Flag potentially outdated information | `analyse` (stage `findings`) |
| 10 | Show supporting excerpts with source references and PDF page numbers | Evidence panel, Evidence Library |
| 11 | Generate a prioritised verification checklist with real progress counts | `analyse` (stage `checklist`), `src/pages/VerificationTasks.tsx` |

Statuses shown to users: **Found**, **Partially supported**, **Conflicting**, **Potentially
outdated**, **Not found in reviewed sources**, plus **Requires verification** where evidence exists
but is not sufficient to rely on. Undated information is *never* automatically treated as outdated.

## Screens

- `/` — landing page: brand, headline, explainer of Information Completeness Analysis, the
  fragmented-information → evidence-map illustration, workflow, three feature highlights, CTA.
- `/app` — Overview dashboard (counts computed from real session data, coverage chart, recent sessions).
- `/app/new` — new research session.
- `/app/history` — research history.
- `/app/session/:sessionId?tab=overview|requirements|sources|findings|checklist|evidence` —
  the session workspace (stat cards, coverage, requirement matrix, findings with filters, evidence
  detail, checklist).
- `/app/evidence` — Evidence Library (cross-session).
- `/app/tasks` — Verification Tasks (cross-session checklist).
- `/app/settings` — settings / system status.

## Stack (as built)

- **Frontend** — React 18, Vite 5, TypeScript, Tailwind CSS, Lucide React, Recharts.
  Dark-first design system in `src/index.css` + `tailwind.config.js`.
- **Backend** — Supabase: PostgreSQL with RLS, Storage (`source-documents`), Edge Functions
  (`extract-source`, `analyse`, `system-status`). Auth only where required.
- **AI** — Google Gemini, called **server-side only** from Edge Functions, JSON-mode output,
  schema-validated, one retry, then a clearly-labelled deterministic fallback engine.
- **Extraction** — a standalone Python service (`api/extract.py`, deployed as a Vercel Python
  function): Trafilatura for URLs, PyMuPDF for digital PDFs, optional Tesseract OCR fallback.
- **Hosting** — Vercel (frontend + extraction service), GitHub (source of truth).

## Repository layout

```
src/                    React app (pages, components, hooks, lib)
api/extract.py          Python extraction service (Vercel serverless, also runnable locally)
scripts/                Local runner + executable tests for extraction and analysis
supabase/migrations/    Schema, RLS policies and views (reference copy)
supabase/functions/     Edge Functions: analyse, extract-source, system-status
supabase/seed/          Curated demonstration dataset (CSSS AY 2026–27)
docs/                   Architecture, setup, data model, integration audit
vercel.json             Vite build + Python function config + SPA rewrites
```

## Quick start

```bash
npm install
cp .env.example .env          # then set VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY
npm run dev                   # http://localhost:5173
```

The frontend only ever holds the **public anon key**. Gemini and service-role credentials live in
Supabase Edge Function secrets — see [docs/SETUP.md](docs/SETUP.md).

```bash
npm run typecheck             # tsc -b --noEmit
npm run build                 # tsc -b && vite build
node scripts/test-extraction.mjs              # 17 assertions on the shipped extractor helpers
node scripts/test-analysis.mjs                # 28 assertions on the shipped analysis helpers
python3 scripts/test_extraction_service.py    # 20 assertions over HTTP
node scripts/benchmark.mjs --self-check       # benchmark harness plumbing (no score)
```

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — module boundaries, job model, AI grounding rules.
- [docs/DATA_MODEL.md](docs/DATA_MODEL.md) — tables, views, status derivation.
- [docs/SETUP.md](docs/SETUP.md) — local setup, Supabase, secrets, Vercel, deployment checklist.
- [docs/AUDIT.md](docs/AUDIT.md) — integration audit and what was verified end-to-end.
- `supabase/migrations/` — 0001 core schema + 0002 claims view; both applied to the live project.
- [docs/DEMO.md](docs/DEMO.md) — the seeded demo case and a suggested demo script.
- [docs/REPORT.md](docs/REPORT.md) — factual delivery report: what is tested, partially tested,
  blocked and missing, with exact remaining manual steps.
- [benchmark/README.md](benchmark/README.md) — benchmark frame (36 slots), 6 authored cases, and the
  runner. **No accuracy is claimed** — cases are awaiting two independent human reviewers.

## Honest limits

- Findings are **signals**, not verdicts. They exist to direct verification.
- Absence of evidence in the reviewed sources is reported as absence **in those sources only**.
- Page numbers are only ever taken from the parsed PDF; nothing is invented.
- The heuristic fallback engine is lexical, not semantic, and labels itself as such in the UI.
- OCR requires a Tesseract binary; on serverless hosts it is usually unavailable, and the service
  reports that capability as `false` rather than silently degrading.
