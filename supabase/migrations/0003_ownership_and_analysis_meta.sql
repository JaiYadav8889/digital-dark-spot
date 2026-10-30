-- =============================================================================
-- Digital Dark Spot — 0003 · ownership fix, analysis metadata
-- =============================================================================
-- Audit findings addressed here (verified by executing as the `anon` role):
--
--  1. DELETE was impossible for any session created without signing in.
--     sessions_select / sessions_insert / sessions_update all allow
--     `owner_id is null` (the no-login demo and quick-start flow), but
--     sessions_delete required an owner. The UI therefore offered a delete
--     button that matched zero rows and reported success — a silent failure that
--     made the row reappear on reload. The delete policy now matches the rest of
--     the ownership model.
--
--  2. Re-running the analysis wiped checklist completion. The analysis stages
--     deleted and regenerated checklist_items, so a researcher who had ticked
--     items lost that progress without warning. `analysis_meta` gives the
--     analysis function somewhere to stash completion state across a rebuild.
-- =============================================================================

-- ---------------------------------------------------------------- 1. ownership
drop policy if exists sessions_delete on public.research_sessions;
create policy sessions_delete on public.research_sessions
  for delete using (owner_id is null or owner_id = auth.uid());

-- ------------------------------------------------------- 2. analysis metadata
alter table public.research_sessions
  add column if not exists analysis_meta jsonb not null default '{}'::jsonb;

comment on column public.research_sessions.analysis_meta is
  'Analysis bookkeeping that must survive between stage invocations, e.g. checklist completion carried across a rebuild. Never used for user-facing content.';

-- ------------------------------------------------------------- verification
-- (run manually; kept here as the exact checks that were performed)
--   begin;
--     set local role anon;
--     with gone as (
--       delete from public.research_sessions where title = 'Delete probe — unowned' returning id
--     ) select count(*) as deleted from gone;
--   rollback;
