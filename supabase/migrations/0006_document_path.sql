-- =============================================================================
-- Digital Dark Spot — 0006 · in-app copy of an uploaded document
-- =============================================================================
-- Demonstration sources are real PDFs supplied by the researcher. Their bytes
-- live with the deployed site (public/demo-sources/…), not in Supabase Storage,
-- because the import ran offline. Recording that path separately from `url`:
--
--   url            the document's canonical location on the publisher's site
--                  (null when the inventory records none — never invented)
--   document_path  an app-relative path to the uploaded copy that the browser
--                  can open, so an excerpt can be checked at its PDF page
--   storage_path   Supabase Storage object (used when a user uploads at runtime)
--
-- Keeping them separate means "where the document came from" and "where I can
-- read the copy I was given" are never confused.
-- =============================================================================

alter table public.sources
  add column if not exists document_path text;

comment on column public.sources.document_path is
  'App-relative path to an uploaded copy of the document (e.g. /demo-sources/file.pdf). Used to open the exact PDF page behind an excerpt.';

-- One statement per table keeps this safe to re-run.
create index if not exists idx_sources_document_path on public.sources (session_id) where document_path is not null;
