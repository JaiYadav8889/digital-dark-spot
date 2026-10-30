# Data model

Ten tables and two views in `public`. The reference DDL is
[`supabase/migrations/0001_core_schema.sql`](../supabase/migrations/0001_core_schema.sql) — it is the
exact definition applied to the live project, and it is idempotent (`create table if not exists`,
`create or replace view`, `drop policy if exists` before every `create policy`).

## Tables

| Table | Purpose | Key columns |
|---|---|---|
| `research_sessions` | One research objective | `title`, `question`, `context`, `target_cycle`, `status` (`draft/collecting/analysing/ready/failed`), `analysis_engine`, `analysis_error`, `owner_id`, `is_demo` |
| `sources` | Inputs, one row per URL/PDF | `kind` (`url/pdf/note`), `title`, `url`, `domain`, `issuer`, `source_type`, `storage_path`, `published_date`, `page_count`, `status` (`waiting/processing/extracted/partial/failed`), `extractor`, `char_count`, `error_message` |
| `source_chunks` | ~2 000-char slices | `chunk_index`, `content`, `page_from`, `page_to`, unique `(source_id, chunk_index)` |
| `requirements` | Decomposed objective | `code` (R1…), `description`, `category`, `importance`, `why_it_matters`, `expected_evidence`, `order_index`, unique `(session_id, code)` |
| `evidence_items` | Verbatim claims | `claim_text`, `summary`, `context_note`, `page_number`, `quote_verified`, `locator`, `engine` |
| `evidence_links` | Evidence ↔ requirement | `relation` (`SUPPORTS/PARTIAL/CONFLICTS/OUTDATED`), `rationale`, `confidence`, unique `(evidence_id, requirement_id, relation)` |
| `findings` | Gap / conflict / outdated / unanswered / insight | `kind`, `title`, `summary`, `severity`, `requirement_id`, `recommended_verification`, `status`, `confidence` |
| `finding_evidence` | Which excerpts a finding rests on | `role` (`claim_a/claim_b/claim_c/context/supporting`), `note` |
| `checklist_items` | Verification tasks | `title`, `why_it_matters`, `recommended_source`, `priority`, `completed`, `completed_at`, `order_index` |
| `analysis_jobs` | Async job records | `stage`, `status`, `progress`, `message`, `error`, `payload` (cursors), `engine`, `started_at`, `finished_at` |

Sizing choices that matter: text lives in chunks rather than in one large column; `claim_text` is
capped at 4 000 characters by CHECK; `file_size` is capped at 50 MB; every free-text column has a
reasonable length bound. Timestamps default to `now()`; `updated_at` is maintained by trigger.

## Views

### `v_requirement_status`

Derives the user-facing status from the evidence links — it is never written by the application:

```
conflicts > 0                                   → conflicting
supports = 0 and outdated > 0                   → outdated
supports > 0                                    → found
partial > 0                                     → partial
outdated > 0                                    → outdated
otherwise                                       → not_found
```

plus `needs_verification = (conflicts > 0 or partial > 0 or outdated > 0 or (supports > 0 and
outdated > 0))`, and counts of `supports/partial/conflicts/outdated/evidence_count/source_count`.

The TypeScript twin `deriveStatus()` in `src/lib/status.ts` mirrors this exactly, so optimistic UI
never disagrees with the database.

### `v_session_summary`

Session roll-up used by the dashboard, history and task pages: source counts
(`total/processed/failed`), requirement counts by status, `open_gaps`, `open_conflicts`,
`open_tasks`, `total_tasks`.

## Coverage score

Deliberately not a stored column, because it must be explainable:

```
score = Σ(statusWeight × importanceWeight) / Σ(importanceWeight) × 100
statusWeight: found 1 · partial 0.5 · outdated 0.4 · conflicting 0.25 · not_found 0
importanceWeight: high 3 · medium 2 · low 1
```

`null` when the session has no requirements. The UI labels it "Evidence coverage" and shows the
formula and weights in a tooltip, together with the note that it describes only the sources
reviewed in that session.

## RLS

Enabled on all ten tables. `can_access_session(uuid)` returns true when the session's `owner_id` is
null (public demo sessions) or equals `auth.uid()`. Parent-scoped policies are created for
`SELECT`, `INSERT`, `UPDATE` and `DELETE` on the eight session-keyed tables; `finding_evidence` has
no `session_id` and is guarded through its parent finding.

## Storage

Bucket `source-documents`, path `${sessionId}/${uuid}-${sanitisedFilename}`. The original file is
kept so a reviewer can open the exact PDF behind an excerpt. Reads use short-lived signed URLs
(1 hour) rather than public links.
