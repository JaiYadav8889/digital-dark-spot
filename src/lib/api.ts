/**
 * Data access layer.
 *
 * All reads/writes go through the browser Supabase client and are constrained by
 * Row Level Security. Long-running work (extraction, Gemini analysis) is handed
 * to Edge Functions through asynchronous job records — the browser never calls
 * Gemini or any privileged API directly.
 */

import { supabase, isSupabaseConfigured } from './supabase'
import { hostnameOf } from './utils'
import type {
  AnalysisJob,
  ChecklistItem,
  EvidenceItem,
  EvidenceLink,
  EvidenceWithSource,
  Finding,
  FindingEvidence,
  RequirementWithStatus,
  ResearchSession,
  SessionSummary,
  Source,
  SourceChunk,
  SourceType,
  Importance,
} from './types'

export class ApiError extends Error {
  hint?: string
  constructor(message: string, hint?: string) {
    super(message)
    this.name = 'ApiError'
    this.hint = hint
  }
}

function fail(context: string, error: unknown): never {
  const message =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : String(error)
  const details =
    typeof error === 'object' && error && 'details' in error ? String((error as { details: unknown }).details) : ''
  const hint =
    typeof error === 'object' && error && 'hint' in error ? String((error as { hint: unknown }).hint) : ''
  throw new ApiError(
    `${context}: ${message}${details ? ` (${details})` : ''}`,
    hint || undefined,
  )
}

function assertConfigured() {
  if (!isSupabaseConfigured) {
    throw new ApiError(
      'Supabase is not configured.',
      'Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in your environment, then reload.',
    )
  }
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export async function listSessionSummaries(): Promise<SessionSummary[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('v_session_summary')
    .select('*')
    .order('updated_at', { ascending: false })
  if (error) fail('Could not load research sessions', error)
  return (data ?? []) as SessionSummary[]
}

export async function getSession(id: string): Promise<ResearchSession | null> {
  assertConfigured()
  const { data, error } = await supabase.from('research_sessions').select('*').eq('id', id).maybeSingle()
  if (error) fail('Could not load the research session', error)
  return (data as ResearchSession) ?? null
}

export interface NewSessionInput {
  title: string
  question: string
  context?: string
  target_cycle?: string
  domain?: string
}

export async function createSession(input: NewSessionInput): Promise<ResearchSession> {
  assertConfigured()
  const { data: auth } = await supabase.auth.getUser()
  const owner_id = auth?.user?.id ?? null

  const { data, error } = await supabase
    .from('research_sessions')
    .insert({
      title: input.title.trim(),
      question: input.question.trim(),
      context: input.context?.trim() || null,
      target_cycle: input.target_cycle?.trim() || null,
      domain: input.domain?.trim() || null,
      owner_id,
      status: 'collecting',
    })
    .select('*')
    .single()
  if (error) fail('Could not create the research session', error)
  return data as ResearchSession
}

export async function updateSession(id: string, patch: Partial<ResearchSession>) {
  assertConfigured()
  const { error } = await supabase.from('research_sessions').update(patch).eq('id', id)
  if (error) fail('Could not update the research session', error)
}

export async function deleteSession(id: string) {
  assertConfigured()
  // Ask for the deleted rows back: a DELETE that RLS filters out returns zero
  // rows *without* an error. Without this check the UI removed the session
  // locally while the row survived and reappeared on reload.
  const { data, error } = await supabase.from('research_sessions').delete().eq('id', id).select('id')
  if (error) fail('Could not delete the research session', error)
  if (!data || data.length === 0) {
    throw new ApiError(
      'The session was not deleted.',
      'Row Level Security only permits deleting sessions you own, or sessions created without signing in. Sign in as the owner, or create the session in this browser.',
    )
  }
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

export async function listSources(sessionId: string): Promise<Source[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('sources')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) fail('Could not load sources', error)
  return (data ?? []) as Source[]
}

/**
 * The stored text of a source, page by page.
 *
 * This is the same text the analysis was run on — nothing is re-extracted when
 * the reader opens it — so what is shown here is what the app actually read.
 */
export async function listSourceChunks(sourceId: string): Promise<SourceChunk[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('source_chunks')
    .select('*')
    .eq('source_id', sourceId)
    .order('chunk_index', { ascending: true })
  if (error) fail('Could not load the extracted text', error)
  return (data ?? []) as SourceChunk[]
}

const MAX_PDF_BYTES = 25 * 1024 * 1024

export function validatePdf(file: File): string | null {
  if (file.type && file.type !== 'application/pdf') return 'Only PDF files are supported here.'
  if (!file.name.toLowerCase().endsWith('.pdf')) return 'Only files ending in .pdf are supported.'
  if (file.size === 0) return 'That file is empty.'
  if (file.size > MAX_PDF_BYTES) return `PDFs must be 25 MB or smaller (this one is ${Math.round(file.size / 1024 / 1024)} MB).`
  return null
}

export function validateUrl(raw: string): string | null {
  const value = raw.trim()
  if (!value) return 'Enter a URL.'
  let u: URL
  try {
    u = new URL(value)
  } catch {
    return 'That does not look like a valid URL (include https://).'
  }
  if (!['http:', 'https:'].includes(u.protocol)) return 'Only http and https URLs are supported.'
  if (!u.hostname.includes('.')) return 'That hostname does not look valid.'
  if (['localhost', '127.0.0.1', '0.0.0.0', '::1'].includes(u.hostname)) {
    return 'Local and private addresses cannot be fetched for evidence extraction.'
  }
  if (/^(10|127)\./.test(u.hostname) || /^192\.168\./.test(u.hostname) || /^172\.(1[6-9]|2\d|3[01])\./.test(u.hostname)) {
    return 'Private network addresses cannot be fetched for evidence extraction.'
  }
  return null
}

export interface NewUrlSourceInput {
  url: string
  title?: string
  sourceType?: SourceType
  issuer?: string
  publishedDate?: string
  notes?: string
}

export async function addUrlSource(sessionId: string, input: NewUrlSourceInput): Promise<Source> {
  assertConfigured()
  const clean = input.url.trim()
  const domain = hostnameOf(clean)

  // Duplicate guard. The same URL added twice would produce two sources, two
  // copies of every excerpt and doubled counts in the evidence map — while
  // looking like corroboration from two sources.
  const { data: existing, error: lookupError } = await supabase
    .from('sources')
    .select('id,title,url')
    .eq('session_id', sessionId)
  if (lookupError) fail('Could not check existing sources', lookupError)
  const duplicate = (existing ?? []).find((s) => (s.url ?? '').replace(/\/+$/, '') === clean.replace(/\/+$/, ''))
  if (duplicate) {
    throw new ApiError(
      `That URL is already a source in this session (“${duplicate.title}”).`,
      'Remove the existing source first if you want to re-add it with different metadata.',
    )
  }

  const { data, error } = await supabase
    .from('sources')
    .insert({
      session_id: sessionId,
      kind: 'url',
      url: clean,
      domain,
      title: input.title?.trim() || domain || clean,
      issuer: input.issuer?.trim() || null,
      source_type: input.sourceType ?? 'other',
      published_date: input.publishedDate || null,
      extraction_notes: input.notes?.trim() || null,
      status: 'waiting',
    })
    .select('*')
    .single()
  if (error) fail('Could not add the source', error)
  return data as Source
}

export async function addManualNoteSource(
  sessionId: string,
  input: { title: string; content: string; sourceType?: SourceType; issuer?: string; publishedDate?: string },
): Promise<Source> {
  assertConfigured()
  const { data, error } = await supabase
    .from('sources')
    .insert({
      session_id: sessionId,
      kind: 'note',
      title: input.title.trim(),
      url: null,
      domain: 'manual entry',
      issuer: input.issuer?.trim() || null,
      source_type: input.sourceType ?? 'other',
      published_date: input.publishedDate || null,
      status: 'waiting',
      char_count: input.content.length,
      extraction_notes: 'Pasted manually by the researcher.',
    })
    .select('*')
    .single()
  if (error) fail('Could not add the source', error)

  const source = data as Source
  const { error: chunkError } = await supabase.from('source_chunks').insert({
    source_id: source.id,
    session_id: sessionId,
    chunk_index: 0,
    content: input.content,
    char_count: input.content.length,
  })
  if (chunkError) fail('Source saved but its text could not be stored', chunkError)

  await supabase.from('sources').update({ status: 'extracted' }).eq('id', source.id)
  return { ...source, status: 'extracted' }
}

export async function uploadPdfSource(sessionId: string, file: File): Promise<Source> {
  assertConfigured()
  const invalid = validatePdf(file)
  if (invalid) throw new ApiError(invalid)

  const safeName = file.name.replace(/[^\w.\-]+/g, '_').slice(-120)
  const path = `${sessionId}/${crypto.randomUUID()}-${safeName}`

  const { error: uploadError } = await supabase.storage
    .from('source-documents')
    .upload(path, file, { contentType: file.type || 'application/pdf', upsert: false })
  if (uploadError) fail('The PDF could not be uploaded to storage', uploadError)

  const { data, error } = await supabase
    .from('sources')
    .insert({
      session_id: sessionId,
      kind: 'pdf',
      title: file.name.replace(/\.pdf$/i, '').slice(0, 300),
      storage_path: path,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type || 'application/pdf',
      domain: 'uploaded document',
      source_type: 'pdf_document',
      status: 'waiting',
    })
    .select('*')
    .single()
  if (error) fail('The PDF was uploaded but its record could not be saved', error)
  return data as Source
}

export async function removeSource(source: Source) {
  assertConfigured()
  if (source.storage_path) {
    await supabase.storage.from('source-documents').remove([source.storage_path])
  }
  const { error } = await supabase.from('sources').delete().eq('id', source.id)
  if (error) fail('Could not remove the source', error)
}

export async function markSourceFailed(sourceId: string, message: string) {
  await supabase
    .from('sources')
    .update({ status: 'failed', error_message: message.slice(0, 900) })
    .eq('id', sourceId)
}

export async function signedDocumentUrl(storagePath: string): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from('source-documents')
    .createSignedUrl(storagePath, 60 * 60)
  if (error) return null
  return data?.signedUrl ?? null
}

/**
 * Where the reader can actually open a document: the uploaded copy that ships
 * with the app when there is one, otherwise a short-lived link to the object in
 * Storage. Returns null when neither exists, so callers can say so honestly.
 */
export async function documentUrlFor(source: {
  storage_path: string | null
  document_path: string | null
}): Promise<string | null> {
  if (source.document_path) return source.document_path
  if (source.storage_path) return signedDocumentUrl(source.storage_path)
  return null
}

// ---------------------------------------------------------------------------
// Analysis pipeline (Edge Functions)
// ---------------------------------------------------------------------------

export type FunctionResult<T = Record<string, unknown>> =
  | { ok: true; data: T }
  | { ok: false; message: string; hint?: string }

async function invoke<T>(name: string, body: Record<string, unknown>): Promise<FunctionResult<T>> {
  assertConfigured()
  try {
    const { data, error } = await supabase.functions.invoke(name, { body })
    if (error) {
      // FunctionsHttpError hides the response body; try to surface it.
      let message = error.message || 'The backend function failed.'
      const ctx = (error as unknown as { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } })
        .context
      if (ctx?.json) {
        try {
          const payload = (await ctx.json()) as { error?: string; detail?: string }
          if (payload?.error) message = payload.error
          if (payload?.detail) message = `${message} — ${payload.detail}`
        } catch {
          /* keep the original message */
        }
      }
      return { ok: false, message }
    }
    if (data && typeof data === 'object' && 'error' in data) {
      return { ok: false, message: String((data as { error: unknown }).error) }
    }
    return { ok: true, data: data as T }
  } catch (err) {
    return {
      ok: false,
      message:
        err instanceof Error
          ? err.message
          : 'Could not reach the Supabase Edge Function. Check that it has been deployed.',
    }
  }
}

export async function extractSource(sourceId: string, mode: 'fetch' | 'retry' = 'fetch') {
  return invoke<{ status?: string; message?: string; extractor?: string }>('extract-source', {
    source_id: sourceId,
    mode,
  })
}

export async function runAnalysis(
  sessionId: string,
  stage: 'requirements' | 'evidence' | 'findings' | 'checklist' | 'full',
  options?: { batchSize?: number },
) {
  return invoke<{ stage?: string; status?: string; message?: string; engine?: string }>('analyse', {
    session_id: sessionId,
    stage,
    batch_size: options?.batchSize,
  })
}

export interface SystemStatus {
  gemini_configured: boolean
  extraction_service_configured: boolean
  gemini_model: string | null
  extraction_service_reachable: boolean | null
  notes: string[]
}

export async function fetchSystemStatus() {
  return invoke<SystemStatus>('system-status', {})
}

// ---------------------------------------------------------------------------
// Requirements / evidence / findings / checklist
// ---------------------------------------------------------------------------

export async function listRequirements(sessionId: string): Promise<RequirementWithStatus[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('v_requirement_status')
    .select('*')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: true })
  if (error) fail('Could not load requirements', error)
  return (data ?? []) as RequirementWithStatus[]
}

export async function listFindings(sessionId: string): Promise<Finding[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('findings')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: true })
  if (error) fail('Could not load findings', error)
  return (data ?? []) as Finding[]
}

export async function listChecklist(sessionId: string): Promise<ChecklistItem[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .eq('session_id', sessionId)
    .order('order_index', { ascending: true })
  if (error) fail('Could not load the verification checklist', error)
  return (data ?? []) as ChecklistItem[]
}

export async function toggleChecklistItem(id: string, completed: boolean) {
  assertConfigured()
  const { error } = await supabase
    .from('checklist_items')
    .update({ completed, completed_at: completed ? new Date().toISOString() : null })
    .eq('id', id)
  if (error) fail('Could not update the checklist item', error)
}

export async function setFindingStatus(id: string, status: 'open' | 'resolved' | 'dismissed') {
  assertConfigured()
  const { error } = await supabase.from('findings').update({ status }).eq('id', id)
  if (error) fail('Could not update the finding', error)
}

/**
 * Evidence with provenance.
 *
 * Stitched from four small queries rather than one deep join so the payload
 * stays predictable and each table's RLS is enforced independently.
 */
export async function listEvidenceWithSource(sessionId: string): Promise<EvidenceWithSource[]> {
  assertConfigured()
  const [{ data: evidence, error: e1 }, { data: links, error: e2 }, { data: sources, error: e3 }, { data: reqs, error: e4 }] =
    await Promise.all([
      supabase.from('evidence_items').select('*').eq('session_id', sessionId).order('created_at', { ascending: true }),
      supabase.from('evidence_links').select('*').eq('session_id', sessionId),
      supabase.from('sources').select('*').eq('session_id', sessionId),
      supabase.from('requirements').select('id,code,description').eq('session_id', sessionId),
    ])
  if (e1) fail('Could not load evidence', e1)
  if (e2) fail('Could not load evidence links', e2)
  if (e3) fail('Could not load source references', e3)
  if (e4) fail('Could not load requirements', e4)

  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]))
  const reqById = new Map((reqs ?? []).map((r) => [r.id, r]))
  const linksByEvidence = new Map<string, EvidenceLink[]>()
  for (const link of (links ?? []) as EvidenceLink[]) {
    const list = linksByEvidence.get(link.evidence_id) ?? []
    list.push(link)
    linksByEvidence.set(link.evidence_id, list)
  }

  return ((evidence ?? []) as EvidenceItem[]).map((item) => {
    const src = sourceById.get(item.source_id)
    return {
      ...item,
      source: {
        id: src?.id ?? item.source_id,
        title: src?.title ?? 'Unknown source',
        url: src?.url ?? null,
        domain: src?.domain ?? null,
        issuer: src?.issuer ?? null,
        source_type: src?.source_type ?? 'other',
        kind: src?.kind ?? 'url',
        published_date: src?.published_date ?? null,
        updated_date: src?.updated_date ?? null,
        page_count: src?.page_count ?? null,
        storage_path: src?.storage_path ?? null,
        document_path: src?.document_path ?? null,
        file_name: src?.file_name ?? null,
        status: src?.status ?? 'failed',
      },
      links: (linksByEvidence.get(item.id) ?? []).map((l) => ({
        id: l.id,
        requirement_id: l.requirement_id,
        relation: l.relation,
        rationale: l.rationale,
        confidence: l.confidence,
        requirement: reqById.get(l.requirement_id),
      })),
    }
  })
}

export async function listFindingEvidence(sessionId: string): Promise<FindingEvidence[]> {
  assertConfigured()
  const { data: findings, error } = await supabase.from('findings').select('id').eq('session_id', sessionId)
  if (error) fail('Could not load findings', error)
  const ids = (findings ?? []).map((f) => f.id)
  if (ids.length === 0) return []
  const { data, error: linkError } = await supabase.from('finding_evidence').select('*').in('finding_id', ids)
  if (linkError) fail('Could not load finding evidence', linkError)
  return (data ?? []) as FindingEvidence[]
}

export async function listJobs(sessionId: string): Promise<AnalysisJob[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('analysis_jobs')
    .select('*')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(25)
  if (error) fail('Could not load analysis activity', error)
  return (data ?? []) as AnalysisJob[]
}

// ---------------------------------------------------------------------------
// Cross-session views (Evidence Library / Verification Tasks)
// ---------------------------------------------------------------------------

export interface EvidenceLibraryRow extends EvidenceWithSource {
  session_title: string
}

export async function listAllEvidence(): Promise<EvidenceLibraryRow[]> {
  assertConfigured()
  const { data: evidence, error } = await supabase
    .from('evidence_items')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(500)
  if (error) fail('Could not load the evidence library', error)
  const rows = (evidence ?? []) as EvidenceItem[]
  if (rows.length === 0) return []

  const sessionIds = Array.from(new Set(rows.map((r) => r.session_id)))
  const [{ data: sources }, { data: sessions }, { data: links }, { data: reqs }] = await Promise.all([
    supabase.from('sources').select('*').in('id', Array.from(new Set(rows.map((r) => r.source_id)))),
    supabase.from('research_sessions').select('id,title').in('id', sessionIds),
    supabase.from('evidence_links').select('*').in('evidence_id', rows.map((r) => r.id)),
    supabase.from('requirements').select('id,code,description').in('session_id', sessionIds),
  ])

  const sourceById = new Map((sources ?? []).map((s) => [s.id, s]))
  const sessionById = new Map((sessions ?? []).map((s) => [s.id, s]))
  const reqById = new Map((reqs ?? []).map((r) => [r.id, r]))
  const linksByEvidence = new Map<string, EvidenceLink[]>()
  for (const link of (links ?? []) as EvidenceLink[]) {
    const list = linksByEvidence.get(link.evidence_id) ?? []
    list.push(link)
    linksByEvidence.set(link.evidence_id, list)
  }

  return rows.map((item) => {
    const src = sourceById.get(item.source_id)
    return {
      ...item,
      session_title: sessionById.get(item.session_id)?.title ?? 'Unknown session',
      source: {
        id: src?.id ?? item.source_id,
        title: src?.title ?? 'Unknown source',
        url: src?.url ?? null,
        domain: src?.domain ?? null,
        issuer: src?.issuer ?? null,
        source_type: src?.source_type ?? 'other',
        kind: src?.kind ?? 'url',
        published_date: src?.published_date ?? null,
        updated_date: src?.updated_date ?? null,
        page_count: src?.page_count ?? null,
        storage_path: src?.storage_path ?? null,
        document_path: src?.document_path ?? null,
        file_name: src?.file_name ?? null,
        status: src?.status ?? 'failed',
      },
      links: (linksByEvidence.get(item.id) ?? []).map((l) => ({
        id: l.id,
        requirement_id: l.requirement_id,
        relation: l.relation,
        rationale: l.rationale,
        confidence: l.confidence,
        requirement: reqById.get(l.requirement_id),
      })),
    }
  })
}

export interface TaskRow extends ChecklistItem {
  session_title: string
}

export async function listAllTasks(): Promise<TaskRow[]> {
  assertConfigured()
  const { data, error } = await supabase
    .from('checklist_items')
    .select('*')
    .order('completed', { ascending: true })
    .order('order_index', { ascending: true })
    .limit(300)
  if (error) fail('Could not load verification tasks', error)
  const rows = (data ?? []) as ChecklistItem[]
  if (rows.length === 0) return []
  const { data: sessions } = await supabase
    .from('research_sessions')
    .select('id,title')
    .in('id', Array.from(new Set(rows.map((r) => r.session_id))))
  const titles = new Map((sessions ?? []).map((s) => [s.id, s.title]))
  return rows.map((r) => ({ ...r, session_title: titles.get(r.session_id) ?? 'Unknown session' }))
}

// ---------------------------------------------------------------------------
// Small helpers used by create/edit forms
// ---------------------------------------------------------------------------

export const IMPORTANCE_OPTIONS: Importance[] = ['high', 'medium', 'low']
