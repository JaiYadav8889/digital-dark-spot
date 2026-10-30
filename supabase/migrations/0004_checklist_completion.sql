-- =============================================================================
-- Digital Dark Spot — 0004 · preserve checklist completion across a rebuild
-- =============================================================================
-- Problem (audit finding)
-- -----------------------
-- Re-running the analysis deletes findings and checklist_items and regenerates
-- them. Any verification the researcher had already ticked was silently lost —
-- the progress counter dropped back to zero with no warning. Checklist
-- completion is a required product feature, so losing it is data loss.
--
-- Why a trigger rather than a change inside the analyse function
-- --------------------------------------------------------------
-- The invariant is "a completed verification stays completed when the same item
-- is regenerated". That is a property of the table, not of one caller: the seed
-- script, a future stage, or a manual re-run must all respect it. A trigger also
-- means the guarantee does not depend on the Edge Function being redeployed.
--
-- Key
-- ---
-- Items are matched on lower(trim(title)) within the session. That is the only
-- stable identity a regenerated checklist shares with the previous one. If the
-- model rewords an item, it is treated as a new item — erring towards showing an
-- unticked task rather than falsely claiming work was done.
-- =============================================================================

create or replace function public.preserve_checklist_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  key      text;
begin
  if not coalesce(old.completed, false) then
    return old;
  end if;

  key := md5(lower(btrim(old.title)));

  select coalesce(analysis_meta -> 'completed_checklist', '{}'::jsonb)
    into snapshot
    from public.research_sessions
   where id = old.session_id;

  -- Keep the map bounded: a long-lived session must not accumulate forever.
  if (select count(*) from jsonb_object_keys(snapshot)) >= 50 then
    snapshot := '{}'::jsonb;
  end if;

  snapshot := snapshot || jsonb_build_object(key, to_jsonb(coalesce(old.completed_at, now())));

  update public.research_sessions
     set analysis_meta = jsonb_set(analysis_meta, '{completed_checklist}', snapshot, true)
   where id = old.session_id;

  return old;
end;
$$;

create or replace function public.restore_checklist_completion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  snapshot jsonb;
  key      text;
  done_at  timestamptz;
begin
  if coalesce(new.completed, false) then
    return new;
  end if;

  key := md5(lower(btrim(new.title)));

  select analysis_meta -> 'completed_checklist'
    into snapshot
    from public.research_sessions
   where id = new.session_id;

  if snapshot is null or not (snapshot ? key) then
    return new;
  end if;

  begin
    done_at := (snapshot ->> key)::timestamptz;
  exception when others then
    done_at := now();
  end;

  update public.checklist_items
     set completed = true,
         completed_at = coalesce(done_at, now())
   where id = new.id;

  return new;
end;
$$;

drop trigger if exists trg_checklist_preserve on public.checklist_items;
create trigger trg_checklist_preserve
  before delete on public.checklist_items
  for each row execute function public.preserve_checklist_completion();

drop trigger if exists trg_checklist_restore on public.checklist_items;
create trigger trg_checklist_restore
  after insert on public.checklist_items
  for each row execute function public.restore_checklist_completion();

comment on function public.preserve_checklist_completion() is
  'Remembers completed verification items in research_sessions.analysis_meta before a checklist rebuild deletes them.';
comment on function public.restore_checklist_completion() is
  'Re-ticks a regenerated verification item that the researcher had already completed.';
