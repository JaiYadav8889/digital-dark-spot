-- =============================================================================
-- Digital Dark Spot — core schema
-- Information Completeness Analysis platform · Team NEXORA · GRAVITON 2026
-- =============================================================================
-- Design notes
--  * Every AI-derived record is traceable: findings -> finding_evidence -> evidence_items
--    -> source_chunks -> sources (with URL / PDF page / publication date).
--  * Requirement status is DERIVED (see v_requirement_status) and never stored, so a
--    status can never drift away from the evidence that produced it.
--  * Text is stored in ~2,000 char chunks so rows stay small and evidence excerpts can
--    be located precisely inside a source.
-- =============================================================================

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------- enums (as checks)
-- Enums are expressed as CHECK constraints so that the analysis engine can evolve
-- without a migration lock-step with the Edge Functions.

create table if not exists public.research_sessions (
  id                 uuid primary key default gen_random_uuid(),
  title              text not null check (char_length(btrim(title)) between 3 and 200),
  question           text not null check (char_length(btrim(question)) between 10 and 2000),
  context            text check (context is null or char_length(context) <= 4000),
  target_cycle       text check (target_cycle is null or char_length(target_cycle) <= 80),
  domain             text check (domain is null or char_length(domain) <= 120),
  status             text not null default 'draft'
                     check (status in ('draft','collecting','analysing','ready','failed')),
  analysis_engine    text check (analysis_engine in ('gemini','heuristic','curated','manual')),
  analysis_error     text,
  owner_id           uuid references auth.users(id) on delete set null,
  is_demo            boolean not null default false,
  last_analysed_at   timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table if not exists public.sources (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.research_sessions(id) on delete cascade,
  kind              text not null default 'url' check (kind in ('url','pdf','note')),
  title             text not null check (char_length(btrim(title)) between 2 and 300),
  url               text check (url is null or url ~ '^https?://'),
  domain            text,
  issuer            text,
  source_type       text not null default 'other'
                    check (source_type in ('official_guideline','government_page','parliamentary_record',
                                           'secondary_guide','pdf_document','other')),
  storage_path      text,
  file_name         text,
  file_size         bigint check (file_size is null or file_size between 0 and 52428800),
  mime_type         text,
  page_count        integer check (page_count is null or page_count between 0 and 5000),
  published_date    date,
  updated_date      date,
  retrieved_at      timestamptz,
  status            text not null default 'waiting'
                    check (status in ('waiting','processing','extracted','partial','failed')),
  extractor         text,
  extraction_notes  text,
  error_message     text,
  char_count        integer not null default 0,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create table if not exists public.source_chunks (
  id            uuid primary key default gen_random_uuid(),
  source_id     uuid not null references public.sources(id) on delete cascade,
  session_id    uuid not null references public.research_sessions(id) on delete cascade,
  chunk_index   integer not null check (chunk_index >= 0),
  content       text not null,
  char_count    integer not null default 0,
  page_from     integer,
  page_to       integer,
  created_at    timestamptz not null default now(),
  unique (source_id, chunk_index)
);

create table if not exists public.requirements (
  id                uuid primary key default gen_random_uuid(),
  session_id        uuid not null references public.research_sessions(id) on delete cascade,
  code              text not null,
  description       text not null check (char_length(btrim(description)) between 3 and 500),
  category          text,
  importance        text not null default 'medium' check (importance in ('high','medium','low')),
  why_it_matters    text,
  expected_evidence text,
  order_index       integer not null default 0,
  engine            text default 'gemini' check (engine in ('gemini','heuristic','curated','manual')),
  created_at        timestamptz not null default now(),
  unique (session_id, code)
);

create table if not exists public.evidence_items (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.research_sessions(id) on delete cascade,
  source_id      uuid not null references public.sources(id) on delete cascade,
  chunk_id       uuid references public.source_chunks(id) on delete set null,
  claim_text     text not null check (char_length(btrim(claim_text)) between 5 and 4000),
  summary        text,
  context_note   text,
  page_number    integer check (page_number is null or page_number between 1 and 5000),
  quote_verified boolean not null default false,
  locator        text,
  engine         text default 'gemini' check (engine in ('gemini','heuristic','curated','manual')),
  created_at     timestamptz not null default now()
);

create table if not exists public.evidence_links (
  id             uuid primary key default gen_random_uuid(),
  session_id     uuid not null references public.research_sessions(id) on delete cascade,
  evidence_id    uuid not null references public.evidence_items(id) on delete cascade,
  requirement_id uuid not null references public.requirements(id) on delete cascade,
  relation       text not null check (relation in ('SUPPORTS','PARTIAL','CONFLICTS','OUTDATED')),
  rationale      text,
  confidence     numeric(3,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  engine         text default 'gemini' check (engine in ('gemini','heuristic','curated','manual')),
  created_at     timestamptz not null default now(),
  unique (evidence_id, requirement_id, relation)
);

create table if not exists public.findings (
  id                        uuid primary key default gen_random_uuid(),
  session_id                uuid not null references public.research_sessions(id) on delete cascade,
  kind                      text not null check (kind in ('gap','conflict','outdated','unanswered','insight')),
  title                     text not null check (char_length(btrim(title)) between 5 and 300),
  summary                   text not null,
  severity                  text not null default 'medium' check (severity in ('high','medium','low')),
  requirement_id            uuid references public.requirements(id) on delete set null,
  recommended_verification  text,
  status                    text not null default 'open' check (status in ('open','resolved','dismissed')),
  confidence                numeric(3,2) check (confidence is null or (confidence >= 0 and confidence <= 1)),
  engine                    text default 'gemini' check (engine in ('gemini','heuristic','curated','manual')),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create table if not exists public.finding_evidence (
  id          uuid primary key default gen_random_uuid(),
  finding_id  uuid not null references public.findings(id) on delete cascade,
  evidence_id uuid not null references public.evidence_items(id) on delete cascade,
  role        text not null default 'context'
              check (role in ('claim_a','claim_b','claim_c','context','supporting')),
  note        text,
  unique (finding_id, evidence_id, role)
);

create table if not exists public.checklist_items (
  id                 uuid primary key default gen_random_uuid(),
  session_id         uuid not null references public.research_sessions(id) on delete cascade,
  title              text not null check (char_length(btrim(title)) between 5 and 300),
  why_it_matters     text,
  requirement_id     uuid references public.requirements(id) on delete set null,
  finding_id         uuid references public.findings(id) on delete set null,
  recommended_source text,
  priority           text not null default 'medium' check (priority in ('high','medium','low')),
  completed          boolean not null default false,
  completed_at       timestamptz,
  order_index        integer not null default 0,
  engine             text default 'curated' check (engine in ('gemini','heuristic','curated','manual')),
  created_at         timestamptz not null default now()
);

create table if not exists public.analysis_jobs (
  id           uuid primary key default gen_random_uuid(),
  session_id   uuid not null references public.research_sessions(id) on delete cascade,
  stage        text not null
               check (stage in ('extraction','requirements','evidence','findings','checklist','full')),
  status       text not null default 'queued'
               check (status in ('queued','running','succeeded','partial','failed')),
  progress     integer not null default 0 check (progress between 0 and 100),
  message      text,
  error        text,
  payload      jsonb not null default '{}'::jsonb,
  engine       text check (engine in ('gemini','heuristic','curated','manual')),
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now()
);

-- ------------------------------------------------------------------------ indexes
create index if not exists idx_sources_session        on public.sources (session_id);
create index if not exists idx_chunks_source          on public.source_chunks (source_id);
create index if not exists idx_chunks_session         on public.source_chunks (session_id);
create index if not exists idx_requirements_session   on public.requirements (session_id, order_index);
create index if not exists idx_evidence_session       on public.evidence_items (session_id);
create index if not exists idx_evidence_source        on public.evidence_items (source_id);
create index if not exists idx_links_requirement      on public.evidence_links (requirement_id);
create index if not exists idx_links_evidence         on public.evidence_links (evidence_id);
create index if not exists idx_findings_session       on public.findings (session_id, kind);
create index if not exists idx_finding_evidence_f     on public.finding_evidence (finding_id);
create index if not exists idx_checklist_session      on public.checklist_items (session_id, order_index);
create index if not exists idx_jobs_session           on public.analysis_jobs (session_id, created_at desc);

-- ------------------------------------------------------------------ updated_at trigger
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_sessions_touch on public.research_sessions;
create trigger trg_sessions_touch before update on public.research_sessions
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_sources_touch on public.sources;
create trigger trg_sources_touch before update on public.sources
  for each row execute function public.touch_updated_at();

drop trigger if exists trg_findings_touch on public.findings;
create trigger trg_findings_touch before update on public.findings
  for each row execute function public.touch_updated_at();

-- --------------------------------------------------------------- derived requirement status
-- Relationship priority (documented in the UI):
--   CONFLICTS  > OUTDATED (only when nothing supports) > SUPPORTS > PARTIAL > NOT FOUND
-- A requirement is never "found" merely because a word matched: a link only exists when
-- the analysis engine asserted that the excerpt addresses the requirement.
create or replace view public.v_requirement_status as
with agg as (
  select
    r.id                                            as requirement_id,
    r.session_id,
    r.code,
    r.description,
    r.category,
    r.importance,
    r.why_it_matters,
    r.expected_evidence,
    r.order_index,
    count(distinct el.evidence_id) filter (where el.relation = 'SUPPORTS') as supports,
    count(distinct el.evidence_id) filter (where el.relation = 'PARTIAL')  as partial,
    count(distinct el.evidence_id) filter (where el.relation = 'CONFLICTS') as conflicts,
    count(distinct el.evidence_id) filter (where el.relation = 'OUTDATED') as outdated,
    count(distinct e.source_id) filter (where el.relation in ('SUPPORTS','PARTIAL','CONFLICTS','OUTDATED')) as source_count,
    count(distinct el.evidence_id) as evidence_count
  from public.requirements r
  left join public.evidence_links el on el.requirement_id = r.id
  left join public.evidence_items e on e.id = el.evidence_id
  group by r.id
)
select
  agg.*,
  case
    when agg.conflicts > 0 then 'conflicting'
    when agg.supports  = 0 and agg.outdated > 0 then 'outdated'
    when agg.supports  > 0 then 'found'
    when agg.partial   > 0 then 'partial'
    when agg.outdated  > 0 then 'outdated'
    else 'not_found'
  end as status,
  (agg.conflicts > 0 or agg.partial > 0 or agg.outdated > 0
    or (agg.supports > 0 and agg.outdated > 0)) as needs_verification,
  -- Alias so clients can treat a status row exactly like a requirement row.
  agg.requirement_id as id
from agg;

-- ------------------------------------------------------------------- session rollup
create or replace view public.v_session_summary as
select
  s.id as session_id,
  s.title,
  s.status,
  s.is_demo,
  s.analysis_engine,
  s.target_cycle,
  s.created_at,
  s.updated_at,
  (select count(*) from public.sources src where src.session_id = s.id) as total_sources,
  (select count(*) from public.sources src
     where src.session_id = s.id and src.status in ('extracted','partial')) as processed_sources,
  (select count(*) from public.sources src
     where src.session_id = s.id and src.status = 'failed') as failed_sources,
  (select count(*) from public.requirements r where r.session_id = s.id) as total_requirements,
  (select count(*) from public.v_requirement_status v
     where v.session_id = s.id and v.status = 'found') as found_requirements,
  (select count(*) from public.v_requirement_status v
     where v.session_id = s.id and v.status = 'partial') as partial_requirements,
  (select count(*) from public.v_requirement_status v
     where v.session_id = s.id and v.status = 'conflicting') as conflicting_requirements,
  (select count(*) from public.v_requirement_status v
     where v.session_id = s.id and v.status = 'outdated') as outdated_requirements,
  (select count(*) from public.v_requirement_status v
     where v.session_id = s.id and v.status = 'not_found') as not_found_requirements,
  (select count(*) from public.findings f
     where f.session_id = s.id and f.kind = 'gap' and f.status = 'open') as open_gaps,
  (select count(*) from public.findings f
     where f.session_id = s.id and f.kind = 'conflict' and f.status = 'open') as open_conflicts,
  (select count(*) from public.checklist_items c
     where c.session_id = s.id and c.completed = false) as open_tasks,
  (select count(*) from public.checklist_items c
     where c.session_id = s.id) as total_tasks
from public.research_sessions s;

-- ------------------------------------------------------------------------- RLS
alter table public.research_sessions enable row level security;
alter table public.sources            enable row level security;
alter table public.source_chunks      enable row level security;
alter table public.requirements        enable row level security;
alter table public.evidence_items     enable row level security;
alter table public.evidence_links     enable row level security;
alter table public.findings           enable row level security;
alter table public.finding_evidence   enable row level security;
alter table public.checklist_items    enable row level security;
alter table public.analysis_jobs      enable row level security;

-- A session is accessible when it is a shared guest/demo workspace (owner_id is null)
-- or when the signed-in user owns it. The publishable key alone can therefore never
-- read another user's private research.
create or replace function public.can_access_session(p_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.research_sessions s
    where s.id = p_session_id
      and (s.owner_id is null or s.owner_id = auth.uid())
  );
$$;

revoke all on function public.can_access_session(uuid) from public;
grant execute on function public.can_access_session(uuid) to anon, authenticated;

-- sessions
drop policy if exists sessions_select on public.research_sessions;
create policy sessions_select on public.research_sessions
  for select using (owner_id is null or owner_id = auth.uid());

drop policy if exists sessions_insert on public.research_sessions;
create policy sessions_insert on public.research_sessions
  for insert with check (owner_id is null or owner_id = auth.uid());

drop policy if exists sessions_update on public.research_sessions;
create policy sessions_update on public.research_sessions
  for update using (owner_id is null or owner_id = auth.uid())
  with check (owner_id is null or owner_id = auth.uid());

drop policy if exists sessions_delete on public.research_sessions;
create policy sessions_delete on public.research_sessions
  for delete using (owner_id is not null and owner_id = auth.uid());

-- child tables: identical shape, expressed per table (explicit is safer than clever)
do $$
declare t text;
begin
  foreach t in array array['sources','source_chunks','requirements','evidence_items',
                           'evidence_links','findings','checklist_items','analysis_jobs']
  loop
    execute format('drop policy if exists %I on public.%I', t || '_select', t);
    execute format('create policy %I on public.%I for select using (public.can_access_session(session_id))',
                   t || '_select', t);
    execute format('drop policy if exists %I on public.%I', t || '_insert', t);
    execute format('create policy %I on public.%I for insert with check (public.can_access_session(session_id))',
                   t || '_insert', t);
    execute format('drop policy if exists %I on public.%I', t || '_update', t);
    execute format('create policy %I on public.%I for update using (public.can_access_session(session_id))',
                   t || '_update', t);
    execute format('drop policy if exists %I on public.%I', t || '_delete', t);
    execute format('create policy %I on public.%I for delete using (public.can_access_session(session_id))',
                   t || '_delete', t);
  end loop;
end $$;

-- finding_evidence has no session_id; derive it from the parent finding.
drop policy if exists finding_evidence_select on public.finding_evidence;
create policy finding_evidence_select on public.finding_evidence
  for select using (exists (
    select 1 from public.findings f
    where f.id = finding_evidence.finding_id and public.can_access_session(f.session_id)));

drop policy if exists finding_evidence_insert on public.finding_evidence;
create policy finding_evidence_insert on public.finding_evidence
  for insert with check (exists (
    select 1 from public.findings f
    where f.id = finding_evidence.finding_id and public.can_access_session(f.session_id)));

drop policy if exists finding_evidence_delete on public.finding_evidence;
create policy finding_evidence_delete on public.finding_evidence
  for delete using (exists (
    select 1 from public.findings f
    where f.id = finding_evidence.finding_id and public.can_access_session(f.session_id)));

-- ------------------------------------------------------------------ storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('source-documents', 'source-documents', false, 26214400,
        array['application/pdf','text/plain','text/html','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists source_docs_insert on storage.objects;
create policy source_docs_insert on storage.objects
  for insert to anon, authenticated
  with check (bucket_id = 'source-documents');

drop policy if exists source_docs_select on storage.objects;
create policy source_docs_select on storage.objects
  for select to anon, authenticated
  using (bucket_id = 'source-documents');

drop policy if exists source_docs_delete on storage.objects;
create policy source_docs_delete on storage.objects
  for delete to anon, authenticated
  using (bucket_id = 'source-documents');

-- ------------------------------------------------------------------- grants
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant select on public.v_requirement_status, public.v_session_summary to anon, authenticated;

-- Views are read-only projections: remove the write privileges that the Supabase
-- default privileges attach to every new relation in the public schema.
revoke insert, update, delete, truncate, references, trigger
  on public.v_requirement_status, public.v_session_summary from anon, authenticated;
