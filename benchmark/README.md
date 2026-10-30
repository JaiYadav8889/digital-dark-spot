# Benchmark — status: **prepared, not validated**

The benchmark exists as structure plus a working runner. **No accuracy figure has been produced and
none should be quoted.** Two independent human reviewers are required before any case counts, and
that review has not happened.

## What is here

| File | Purpose |
|---|---|
| `slots.json` | The 36-slot frame: 12 categories (A–L) × 3 cases. Categories are **provisional** and must be reconciled with the Phase 1 research inventory. Empty slots are marked `to_author`; nothing was invented to fill them. |
| `cases.jsonl` | Authored cases, one JSON object per line. Currently **6 cases**, all drawn from the CSSS demonstration dataset (real, traceable to seeded evidence). |
| `../scripts/benchmark.mjs` | Runner: loads cases, compares predicted requirement statuses, prints per-case diagnostics and a confusion matrix. |

## Honest status

| Measure | Value |
|---|---|
| Target cases | 36 (20 real, ~16 synthetic) |
| Authored | 6 (A-01, B-01, C-01, C-02, D-01, D-02) |
| Real / synthetic | 6 real / 0 synthetic |
| Locked (2 agreeing reviews) | **0** |
| Validated score | **none — cannot be computed yet** |
| Categories reconciled with the inventory | no (provisional A–L) |

## Case shape

```json
{
  "case_id": "A-01",
  "category": "A",
  "provenance": "csss_demo",
  "synthetic": false,
  "session_id": "00000000-0000-4000-8000-000000000001",
  "requirement_code": "R13",
  "requirement": "Whether the AY 2026–27 application window is open …",
  "expected_status": "not_found",
  "expected_evidence_ids": [],
  "rationale": "No reviewed source states that a 2026–27 window is open …",
  "reviews": [],
  "status": "pending_review"
}
```

A case only becomes **locked** when `reviews` holds at least two entries from different reviewers,
both agreeing with `expected_status`. The runner checks this itself and refuses to report a headline
score otherwise.

## Running it

```bash
# score a real analysed session (needs VITE_SUPABASE_URL + anon key in env)
node scripts/benchmark.mjs --session 00000000-0000-4000-8000-000000000001

# score a predictions file
node scripts/benchmark.mjs --predictions predictions.json

# harness plumbing check — replays the expected labels, loudly labelled as not-a-result
node scripts/benchmark.mjs --self-check
```

Predictions file shape:

```json
[{ "case_id": "A-01", "status": "not_found", "evidence_ids": ["…"] }]
```

## Output contract

- Per-case diagnostics and a confusion matrix are always printed.
- `Verdict` is one of:
  - `PLUMBING CHECK ONLY` — self-check mode.
  - `NOTHING SCORED` — no prediction matched the case list.
  - `INSUFFICIENT REVIEW` — some scored cases have fewer than two agreeing reviews; only diagnostic
    agreement is shown, never a validated score.
  - `VALIDATED SCORE` — every scored case is locked.

## To finish the benchmark

1. Reconcile categories A–L with the Phase 1 inventory (the current names are placeholders).
2. Author the remaining 30 cases, keeping roughly 20 real / 16 synthetic, and mark every synthetic
   case `"synthetic": true`.
3. Have two people review each case independently; record both reviews in `reviews`.
4. Drop or re-author any case where the reviewers disagree — disagreement is a signal that the case
   is ambiguous, not that one reviewer is wrong.
5. Only then run the runner against a real analysed session and quote the `VALIDATED SCORE`.
