/**
 * Database row types + domain vocabulary for Digital Dark Spot.
 *
 * Every type here mirrors supabase/migrations/0001_core_schema.sql exactly.
 * Vocabulary is deliberately hedged: the product reports what the *reviewed
 * evidence* does or does not establish — never what is objectively true.
 */

export type SourceKind = 'url' | 'pdf' | 'note'
export type SourceStatus = 'waiting' | 'processing' | 'extracted' | 'partial' | 'failed'
export type SourceType =
  | 'official_guideline'
  | 'government_page'
  | 'parliamentary_record'
  | 'secondary_guide'
  | 'pdf_document'
  | 'other'
export type Importance = 'high' | 'medium' | 'low'
export type Relation = 'SUPPORTS' | 'PARTIAL' | 'CONFLICTS' | 'OUTDATED'
export type RequirementStatus = 'found' | 'partial' | 'conflicting' | 'outdated' | 'not_found'
export type FindingKind = 'gap' | 'conflict' | 'outdated' | 'unanswered' | 'insight'
export type FindingStatus = 'open' | 'resolved' | 'dismissed'
export type Engine = 'gemini' | 'heuristic' | 'curated' | 'manual'
export type JobStage = 'extraction' | 'requirements' | 'evidence' | 'findings' | 'checklist' | 'full'
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'partial' | 'failed'
export type SessionStatus = 'draft' | 'collecting' | 'analysing' | 'ready' | 'failed'

export interface ResearchSession {
  id: string
  title: string
  question: string
  context: string | null
  target_cycle: string | null
  domain: string | null
  status: SessionStatus
  analysis_engine: Engine | null
  analysis_error: string | null
  owner_id: string | null
  is_demo: boolean
  last_analysed_at: string | null
  /**
   * Internal analysis bookkeeping (e.g. checklist completion carried across a
   * rebuild). Never rendered as content; kept typed as an opaque record.
   */
  analysis_meta?: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Source {
  id: string
  session_id: string
  kind: SourceKind
  title: string
  url: string | null
  domain: string | null
  issuer: string | null
  source_type: SourceType
  storage_path: string | null
  /**
   * App-relative path to an uploaded copy of the document, used to open the
   * exact PDF page behind an excerpt. Distinct from `url` (where the document
   * was published) and from `storage_path` (a runtime upload).
   */
  document_path: string | null
  file_name: string | null
  file_size: number | null
  mime_type: string | null
  page_count: number | null
  published_date: string | null
  updated_date: string | null
  retrieved_at: string | null
  status: SourceStatus
  extractor: string | null
  extraction_notes: string | null
  error_message: string | null
  char_count: number
  created_at: string
  updated_at: string
}

export interface SourceChunk {
  id: string
  source_id: string
  session_id: string
  chunk_index: number
  content: string
  char_count: number
  page_from: number | null
  page_to: number | null
  created_at: string
}

export interface Requirement {
  id: string
  session_id: string
  code: string
  description: string
  category: string | null
  importance: Importance
  why_it_matters: string | null
  expected_evidence: string | null
  order_index: number
  engine: Engine | null
  created_at: string
}

/**
 * Row shape of the v_requirement_status view.
 *
 * The view is a projection of `requirements`, so it carries every requirement
 * column except `engine` and `created_at` (which the view does not select).
 * Marking them absent here keeps the type honest rather than pretending they
 * exist at runtime.
 */
export interface RequirementWithStatus extends Omit<Requirement, 'engine' | 'created_at'> {
  requirement_id: string
  supports: number
  partial: number
  conflicts: number
  outdated: number
  source_count: number
  evidence_count: number
  status: RequirementStatus
  needs_verification: boolean
}

export interface EvidenceItem {
  id: string
  session_id: string
  source_id: string
  chunk_id: string | null
  claim_text: string
  summary: string | null
  context_note: string | null
  page_number: number | null
  quote_verified: boolean
  locator: string | null
  engine: Engine | null
  created_at: string
}

export interface EvidenceLink {
  id: string
  session_id: string
  evidence_id: string
  requirement_id: string
  relation: Relation
  rationale: string | null
  confidence: number | null
  engine: Engine | null
  created_at: string
}

export interface Finding {
  id: string
  session_id: string
  kind: FindingKind
  title: string
  summary: string
  severity: Importance
  requirement_id: string | null
  recommended_verification: string | null
  status: FindingStatus
  confidence: number | null
  engine: Engine | null
  created_at: string
  updated_at: string
}

export interface FindingEvidence {
  id: string
  finding_id: string
  evidence_id: string
  role: 'claim_a' | 'claim_b' | 'claim_c' | 'context' | 'supporting'
  note: string | null
}

export interface ChecklistItem {
  id: string
  session_id: string
  title: string
  why_it_matters: string | null
  requirement_id: string | null
  finding_id: string | null
  recommended_source: string | null
  priority: Importance
  completed: boolean
  completed_at: string | null
  order_index: number
  engine: Engine | null
  created_at: string
}

export interface AnalysisJob {
  id: string
  session_id: string
  stage: JobStage
  status: JobStatus
  progress: number
  message: string | null
  error: string | null
  payload: Record<string, unknown>
  engine: Engine | null
  started_at: string | null
  finished_at: string | null
  created_at: string
}

export interface SessionSummary {
  session_id: string
  title: string
  status: SessionStatus
  is_demo: boolean
  analysis_engine: Engine | null
  target_cycle: string | null
  created_at: string
  updated_at: string
  total_sources: number
  processed_sources: number
  failed_sources: number
  total_requirements: number
  found_requirements: number
  partial_requirements: number
  conflicting_requirements: number
  outdated_requirements: number
  not_found_requirements: number
  open_gaps: number
  open_conflicts: number
  open_tasks: number
  total_tasks: number
}

/** Evidence joined with its provenance, the shape the UI actually renders. */
export interface EvidenceWithSource extends EvidenceItem {
  source: Pick<
    Source,
    | 'id'
    | 'title'
    | 'url'
    | 'domain'
    | 'issuer'
    | 'source_type'
    | 'kind'
    | 'published_date'
    | 'updated_date'
    | 'page_count'
    | 'storage_path'
    | 'document_path'
    | 'file_name'
    | 'status'
  >
  links: Array<
    Pick<EvidenceLink, 'id' | 'requirement_id' | 'relation' | 'rationale' | 'confidence'> & {
      requirement?: Pick<Requirement, 'id' | 'code' | 'description'>
    }
  >
}
