# Demo guide

## The seeded case

Session **`00000000-0000-4000-8000-000000000001`** — *"CSSS scholarship — what must be verified for
AY 2026–27?"*

The dataset is **not** typed in. It is generated from the two PDFs supplied in the Phase 1 pack by
this project's own extraction and analysis code:

```bash
node scripts/build-demo-dataset.mjs      # reads demo/manifest.json, writes supabase/seed/csss_source_driven.sql
```

The requirement *titles* come from the researcher's inventory CSV (`demo/inventory/…`). Nothing else
does: the inventory's `relation`, `claim_paraphrase` and `verification_status` columns are never read,
so no expected answer can leak into the analysis. Every status, excerpt, finding and checklist item
below was computed from the extracted text.

| Item | Count |
|---|---|
| Sources | 2 uploaded PDFs — the MHRD/DOHE scheme guidelines (7 pages) and the DOHE CSSS FAQ (8 pages) |
| Chunks | 15, one per page, so every excerpt carries a real page number |
| Requirements | 13 — **5 found, 6 partial, 1 not found, 1 outdated** |
| Evidence excerpts | 12, each the best-matching sentence of its page |
| Evidence links | 30 (SUPPORTS / PARTIAL) |
| Findings | 2 — one gap, one outdated |
| Checklist items | 8 |
| Job rows | 5, one per stage |

Regenerating is safe: the generator de-duplicates by SHA-256 (the two FAQ filenames in the pack are
the same bytes, so the duplicate is skipped rather than counted as corroboration) and rewrites the
seed atomically.

## What the pipeline actually concluded

- **R09 "Application deadline for 2026-27" is `partial`, not found.** Neither PDF contains a
  calendar deadline; the only deadline language is "renewal deadline" and "closing date of NSP", and
  the academic years quoted run 2008-09 … 2025-26. The app says it cannot settle the date for
  2026-27 instead of inventing one.
- **R13 "Scheme valid for 2026-27" is `outdated`.** Every passage that could have supported it refers
  to an earlier academic year, so the link was downgraded and the reason recorded against the link:
  *"This passage refers to 2022–23, not to the target cycle starting 2026."*
- **R04 "No other scholarship" is `not found`.** The gap finding says "none of the excerpts reviewed
  addresses this requirement" and adds that this does not establish the information is unavailable.
- **The two sources are never merged into one voice.** One is a 2018 paper capture whose text layer
  is OCR output ("80111 percentile", "Income Cenificate"); that caveat is printed under the source,
  alongside its original filename, SHA-256 and the basis of its date.

## Provenance the demo is built to show

Every source, excerpt and finding carries one of four numbered categories, explained by the key at
the top of the session page:

| # | Category | How it is decided |
|---|---|---|
| 1 | Uploaded demonstration source | anything supplied by the researcher — an uploaded PDF, a runtime upload, a note |
| 2 | Live retrieved source | only a source fetched from its own URL in this session |
| 3 | AI-generated potential finding | only a finding whose engine is Gemini |
| 4 | Requires independent verification | rule-based findings and flagged checklist items |

The uploads are category 1. They are not described as "currently live-verified" anywhere, and the
source notes state that neither file was re-fetched from the web during this import.

## Suggested five-minute walkthrough

1. `/app/history` → *Demonstration* group → open the case. Read the amber banner and the provenance key.
2. **Sources** — two uploads, category 1, with page counts, extractor, hash and OCR caveat. One has a
   recorded URL, the other says "URL unavailable for verification" rather than showing a fake link.
3. **Overview** — coverage chart with its formula; status mix 5 / 6 / 1 / 1.
4. **R09** — a deadline the documents do not settle, with the real excerpt and the reason.
5. **R13** — support downgraded because the passages describe earlier cycles.
6. **R04** — a gap stated as "not found in the sources reviewed", never as "does not exist".
7. **Evidence drawer** — category, source, date, page, exact excerpt, matching rationale, and
   **Open at page N** which opens the uploaded PDF from the copy the app serves.
8. **Checklist** — 8 prioritised items, each naming the authority to ask; tick one and it persists.
9. **Close** — "We don't answer your question. We tell you what your evidence does not establish, and
   what to verify next."
