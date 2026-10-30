-- =============================================================================
-- Digital Dark Spot — 0002 · claim-level projection and view hardening
-- =============================================================================
-- The master brief lists "claims" and "evidence" as separate concepts.
-- In this schema a claim *is* an evidence row: evidence_items stores the exact
-- quoted text together with its source, chunk, page and verification flag, and
-- evidence_links records how that claim relates to each requirement. Rather than
-- duplicating the same text in two tables (which would let them drift apart),
-- claims are exposed as a projection over evidence_items.
--
-- This migration therefore:
--   1. adds v_claims — one row per extracted claim with its provenance and the
--      relationship(s) it carries;
--   2. keeps the views read-only for API roles.
-- =============================================================================

create or replace view public.v_claims as
select
  e.id                as claim_id,
  e.session_id,
  e.source_id,
  e.chunk_id,
  e.claim_text,
  e.summary,
  e.context_note,
  e.page_number,
  e.quote_verified,
  e.locator,
  e.engine,
  e.created_at,
  s.title             as source_title,
  s.source_type,
  s.url               as source_url,
  s.issuer,
  s.domain,
  s.published_date,
  s.status            as source_status,
  c.chunk_index,
  c.page_from,
  c.page_to,
  (select count(*) from public.evidence_links el where el.evidence_id = e.id) as requirement_links,
  coalesce(
    (select string_agg(distinct el.relation, ',' order by el.relation)
       from public.evidence_links el
      where el.evidence_id = e.id),
    ''
  ) as relations
from public.evidence_items e
  join public.sources s on s.id = e.source_id
  left join public.source_chunks c on c.id = e.chunk_id;

comment on view public.v_claims is
  'Claim-level projection of evidence_items: exact quoted text, source provenance, PDF page and the relations it carries. Kept as a view so claim text and evidence can never diverge.';

-- Views are read-only projections.
grant select on public.v_claims to anon, authenticated;
revoke insert, update, delete, truncate, references, trigger
  on public.v_claims from anon, authenticated;
