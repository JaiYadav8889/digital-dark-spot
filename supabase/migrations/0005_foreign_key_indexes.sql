-- =============================================================================
-- Digital Dark Spot — 0005 · indexes for foreign keys and RLS lookups
-- =============================================================================
-- Audit finding: seven foreign-key columns had no leading index. Postgres does
-- not index FK columns automatically, so:
--   * deleting a session or finding scanned the child table for every cascade,
--   * RLS evaluation filtered research_sessions by owner_id without an index,
--   * joins from evidence -> chunks and findings -> requirements were sequential.
--
-- All statements are additive and IF NOT EXISTS; no existing data is touched.
-- =============================================================================

create index if not exists idx_checklist_requirement on public.checklist_items (requirement_id);
create index if not exists idx_checklist_finding     on public.checklist_items (finding_id);
create index if not exists idx_evidence_chunk        on public.evidence_items (chunk_id);
create index if not exists idx_links_session         on public.evidence_links (session_id);
create index if not exists idx_fe_evidence           on public.finding_evidence (evidence_id);
create index if not exists idx_findings_requirement  on public.findings (requirement_id);
create index if not exists idx_sessions_owner        on public.research_sessions (owner_id);
-- Supports the "sources not yet processed" checks used by the runner and the UI.
create index if not exists idx_sources_status        on public.sources (session_id, status);
