# Demo guide

## The seeded case

Session **`00000000-0000-4000-8000-000000000001`** — *"Is the Central Sector Scheme of Scholarship
(CSSS) still available for AY 2026–27, and what exactly must a student do to claim it?"*

It is a curated, hand-checked dataset rather than a live model run, so the demo is deterministic and
every claim is traceable to an excerpt. It is labelled **Curated demo** in the UI.

| Item | Count |
|---|---|
| Sources | 8 (2 official PDFs, 3 government pages, 1 parliamentary record, 2 secondary guides) |
| Requirements | 13 — 8 found, 2 partially supported, 1 conflicting, 2 potentially outdated, **1 not found** |
| Evidence excerpts | 17, all linking to at least one requirement |
| Evidence links | 20 (SUPPORTS / PARTIAL / CONFLICTS / OUTDATED) |
| Findings | 11 — 4 gaps, 2 conflicts, 2 outdated, 2 open questions, 1 context note |
| Checklist items | 11 (2 completed, 9 open) |
| Job rows | 5, one per stage, all `succeeded` |

What makes it a good Information Completeness Analysis story:

- **R13 — "is the 2026–27 window open, and where?" is genuinely not found.** No source reviewed says
  so. The UI says "not found in the sources reviewed" and explicitly adds that this is not evidence
  the information does not exist.
- **R6 — three sources give three closing dates** (31 Oct, 30 Sep, 25 Oct). The finding presents both
  claims with excerpts and says it is a *possible inconsistency* — the dates may refer to different
  stages (application, correction, institute verification).
- **R10 / R12 — the only official dates found are for 2025–26**, and the ministry approval period is
  recorded as ending in March 2026 or on earlier review. These are flagged potentially outdated,
  while an *undated* source is flagged as unknown-validity, not outdated.
- **The Rajya Sabha answer** (78,142 disbursements in 2025–26) is scored as context, not as rules —
  a dated figure is not a rule.

## Five-minute demo script

1. **Landing page** — headline, one-sentence explainer, the fragmented-information → evidence-map
   illustration. Point out the copy: it is about what is *missing*.
2. **Start Research → the seeded session** (or `/app/session/00000000-0000-4000-8000-000000000001`).
3. **Overview** — six stat cards all computed from rows, coverage chart with the formula visible,
   requirement matrix. Say the line: *coverage is not a completeness percentage of reality, it is
   coverage of the sources reviewed.*
4. **Requirements tab** — open **R6** (conflicting). The drawer shows both claims verbatim, with
   source titles, dates and page numbers.
5. **Findings tab** — filter to *Possible conflicts*: the card names both claims, explains why the
   dates might legitimately differ, and says what to verify. Filter to *Potential gaps* for R13.
6. **Sources tab** — show extraction states, the snippet-only page marked partially extracted, and
   that no page number is invented for it.
7. **Checklist** — 9 of 11 open, prioritised high/medium/low, each tied to a requirement and a named
   authority. Tick one and watch the progress count move.
8. **Run a live session** — create a new research session with two URLs, press **Run analysis**, and
   show the pipeline steps and job messages. Be explicit about which engine ran (Gemini vs the
   labelled heuristic fallback) — the UI shows it.

## Reset

```bash
psql "$SUPABASE_DB_URL" -f supabase/seed/csss_demo.sql
```

## Editing the case

All copy lives in `supabase/seed/csss_demo.sql`. ID blocks:

| Entity | Range |
|---|---|
| Sources | `…0011`–`…0018` |
| Requirements | `…0101`–`…0113` |
| Evidence | `…0201`–`…0217` |
| Findings | `…0301`–`…0311` |

Keep `analysis_jobs` messages in the seed consistent with the row counts if you add or remove rows —
they are displayed verbatim in the session's job history.
