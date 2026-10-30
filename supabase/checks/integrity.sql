-- =============================================================================
-- Digital Dark Spot — reproducible database checks
-- =============================================================================
-- These are the exact probes used in the audit. Every statement is wrapped in a
-- transaction that rolls back, so it is safe to run against the live project.
-- Run with psql (or paste blocks into the SQL editor) and compare the output to
-- the expectations noted in each block.
--
--   psql "$SUPABASE_DB_URL" -f supabase/checks/integrity.sql
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. RLS: an anonymous reader must see public sessions and nothing private.
--    Expected: anon_sees_demo = 1, anon_sees_private = 0
-- -----------------------------------------------------------------------------
begin;
insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values ('11111111-2222-4333-8444-555555555555', '00000000-0000-0000-0000-000000000000', 'authenticated',
        'authenticated', 'rls-probe@example.invalid', 'x', now(), now(), now());
insert into public.research_sessions (title, question, owner_id, status)
values ('RLS probe — private', 'A private session owned by a signed-in user.', '11111111-2222-4333-8444-555555555555', 'draft');

create temp table probe_rls (name text, value text) on commit drop;
grant select, insert on probe_rls to anon;
set local role anon;
insert into probe_rls select 'anon_sees_private', count(*)::text
  from public.research_sessions where title = 'RLS probe — private';
insert into probe_rls select 'anon_sees_demo', count(*)::text
  from public.research_sessions where is_demo;
reset role;
select name, value from probe_rls order by name;
rollback;


-- -----------------------------------------------------------------------------
-- 2. Ownership: a session created without signing in must be deletable.
--    Expected: anon_deleted_unowned = 1, row_remaining = 0
-- -----------------------------------------------------------------------------
begin;
insert into public.research_sessions (title, question, status, owner_id)
values ('Delete probe — unowned', 'Created without signing in.', 'draft', null);
create temp table probe_del (name text, value text) on commit drop;
grant select, insert on probe_del to anon;
set local role anon;
with gone as (delete from public.research_sessions where title = 'Delete probe — unowned' returning id)
insert into probe_del select 'anon_deleted_unowned', count(*)::text from gone;
reset role;
insert into probe_del select 'row_remaining', count(*)::text
  from public.research_sessions where title = 'Delete probe — unowned';
select name, value from probe_del order by name;
rollback;


-- -----------------------------------------------------------------------------
-- 3. Cascade: deleting a session must remove every child record.
--    Expected: every *_left = 0
-- -----------------------------------------------------------------------------
begin;
insert into public.research_sessions (id, title, question, status)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'Cascade probe', 'Does deleting a session remove its children?', 'ready');
insert into public.sources (id, session_id, kind, title, url, status)
values ('aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000001', 'url', 'Child source', 'https://example.gov/x', 'extracted');
insert into public.source_chunks (source_id, session_id, chunk_index, content, char_count)
values ('aaaaaaaa-0000-4000-8000-000000000011', 'aaaaaaaa-0000-4000-8000-000000000001', 0, 'chunk text', 10);
insert into public.requirements (id, session_id, code, description)
values ('aaaaaaaa-0000-4000-8000-000000000101', 'aaaaaaaa-0000-4000-8000-000000000001', 'R1', 'Cascade requirement');
insert into public.checklist_items (session_id, title, priority, order_index)
values ('aaaaaaaa-0000-4000-8000-000000000001', 'Cascade checklist item', 'high', 0);
delete from public.research_sessions where id = 'aaaaaaaa-0000-4000-8000-000000000001';
select
  (select count(*) from public.sources          where session_id = 'aaaaaaaa-0000-4000-8000-000000000001') as sources_left,
  (select count(*) from public.source_chunks    where session_id = 'aaaaaaaa-0000-4000-8000-000000000001') as chunks_left,
  (select count(*) from public.requirements     where session_id = 'aaaaaaaa-0000-4000-8000-000000000001') as requirements_left,
  (select count(*) from public.checklist_items  where session_id = 'aaaaaaaa-0000-4000-8000-000000000001') as checklist_left;
rollback;


-- -----------------------------------------------------------------------------
-- 4. Checklist completion survives a rebuild.
--    Expected: restored_item_completed = true, unticked stays false, new item false
-- -----------------------------------------------------------------------------
begin;
delete from public.checklist_items where session_id = '00000000-0000-4000-8000-000000000001';
insert into public.checklist_items (session_id, title, priority, completed, completed_at, order_index)
values ('00000000-0000-4000-8000-000000000001', 'Checklist probe ticked', 'high', true, now() - interval '1 day', 0);
insert into public.checklist_items (session_id, title, priority, completed, order_index)
values ('00000000-0000-4000-8000-000000000001', 'Checklist probe unticked', 'medium', false, 1);
-- simulate the analysis stages rebuilding the checklist
delete from public.checklist_items where session_id = '00000000-0000-4000-8000-000000000001';
insert into public.checklist_items (session_id, title, priority, completed, order_index)
values ('00000000-0000-4000-8000-000000000001', 'Checklist probe ticked', 'high', false, 0);
insert into public.checklist_items (session_id, title, priority, completed, order_index)
values ('00000000-0000-4000-8000-000000000001', 'Checklist probe unticked', 'medium', false, 1);
insert into public.checklist_items (session_id, title, priority, completed, order_index)
values ('00000000-0000-4000-8000-000000000001', 'Checklist probe new', 'low', false, 2);
select title, completed, (completed_at is not null) as has_timestamp
  from public.checklist_items
 where session_id = '00000000-0000-4000-8000-000000000001'
 order by order_index;
rollback;


-- -----------------------------------------------------------------------------
-- 5. Provenance integrity of the demonstration dataset.
--    Expected: 0 fabricated page numbers, 0 false verification flags,
--              0 orphan evidence, 0 findings without a requirement.
--    `findings_without_evidence` may be > 0: a gap finding legitimately quotes
--    nothing, and the UI says so explicitly.
-- -----------------------------------------------------------------------------
select 'page_number_on_non_pdf' as check, count(*) as value
  from public.evidence_items e join public.sources s on s.id = e.source_id
 where e.page_number is not null and s.kind <> 'pdf'
union all
select 'claims_marked_verified_but_not_in_chunk', count(*)
  from public.evidence_items e join public.source_chunks c on c.id = e.chunk_id
 where e.quote_verified and position(lower(left(e.claim_text, 90)) in lower(c.content)) = 0
union all
select 'evidence_without_link', count(*)
  from public.evidence_items e
 where not exists (select 1 from public.evidence_links el where el.evidence_id = e.id)
union all
select 'findings_without_requirement', count(*) from public.findings where requirement_id is null
union all
select 'findings_without_evidence', count(*)
  from public.findings f
 where not exists (select 1 from public.finding_evidence fe where fe.finding_id = f.id)
union all
select 'evidence_with_unverifiable_source', count(*)
  from public.evidence_items e join public.sources s on s.id = e.source_id
 where s.url is null and s.storage_path is null;


-- -----------------------------------------------------------------------------
-- 6. Every foreign key should have a leading index (expects zero rows).
-- -----------------------------------------------------------------------------
with fks as (
  select c.conrelid as rel, a.attname as col, c.conrelid::regclass::text as tbl
    from pg_constraint c
    join unnest(c.conkey) as k(attnum) on true
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
   where c.contype = 'f' and c.connamespace = 'public'::regnamespace
)
select fks.tbl, fks.col
  from fks
 where not exists (
   select 1 from pg_index i
    where i.indrelid = fks.rel
      and i.indkey[0] = (select attnum from pg_attribute where attrelid = fks.rel and attname = fks.col))
 order by 1, 2;
