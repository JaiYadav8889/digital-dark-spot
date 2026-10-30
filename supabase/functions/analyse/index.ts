// =============================================================================
// analyse — evidence-first analysis stages.
//
//   stage=requirements  objective  → prioritised information requirements
//   stage=evidence      chunks     → claims + requirement relationships
//   stage=findings      links      → gaps / conflicts / outdated / open questions
//   stage=checklist     findings   → prioritised verification checklist
//
// Design notes
//   * Gemini is called ONLY here, with the key held in Edge Function secrets.
//   * Every AI response is schema-validated; an invalid response is retried once
//     and then the stage falls back to the labelled heuristic engine rather than
//     storing unvalidated output.
//   * Work is bounded per invocation (chunk batches + wall-clock budget) and the
//     cursor is persisted in analysis_jobs.payload, so a long source resumes on
//     the next call instead of silently truncating.
//   * The heuristic engine is deterministic and clearly labelled: it never
//     claims to be an AI conclusion.
// =============================================================================
import { createClient } from 'npm:@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
}

type SupabaseClient = ReturnType<typeof createClient>

const CHUNKS_PER_BATCH = 5
const MAX_CHUNKS_PER_SOURCE = 40
const TIME_BUDGET_MS = 60_000

// ---------------------------------------------------------------------------
// Gemini
// ---------------------------------------------------------------------------

interface GeminiResult {
  ok: boolean
  data?: unknown
  error?: string
  raw?: string
}

function parseJsonLoose(text: string): unknown | null {
  const cleaned = text.replace(/```json/gi, '```').replace(/```/g, '').trim()
  try {
    return JSON.parse(cleaned)
  } catch {
    /* try to locate the outermost object */
  }
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(cleaned.slice(start, end + 1))
    } catch {
      return null
    }
  }
  return null
}

async function callGemini(prompt: string, maxTokens = 4096): Promise<GeminiResult> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return { ok: false, error: 'GEMINI_API_KEY is not configured' }
  const model = Deno.env.get('GEMINI_MODEL') ?? 'gemini-2.5-flash'
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 55_000)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.15,
          topP: 0.9,
          maxOutputTokens: maxTokens,
          responseMimeType: 'application/json',
        },
        safetySettings: [],
      }),
    })
    clearTimeout(timer)

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `Gemini HTTP ${res.status}: ${detail.slice(0, 400)}` }
    }

    const payload = (await res.json()) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> }; finishReason?: string }>
      promptFeedback?: { blockReason?: string }
    }

    if (payload.promptFeedback?.blockReason) {
      return { ok: false, error: `Gemini blocked the request (${payload.promptFeedback.blockReason}).` }
    }

    const text = (payload.candidates?.[0]?.content?.parts ?? [])
      .map((p) => p.text ?? '')
      .join('')
      .trim()

    if (!text) return { ok: false, error: 'Gemini returned an empty response.' }

    const parsed = parseJsonLoose(text)
    if (parsed === null) return { ok: false, error: 'Gemini returned text that was not valid JSON.', raw: text.slice(0, 500) }
    return { ok: true, data: parsed }
  } catch (error) {
    clearTimeout(timer)
    return { ok: false, error: `Gemini request failed: ${error instanceof Error ? error.message : String(error)}` }
  } finally {
    clearTimeout(timer)
  }
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const IMPORTANCE = ['high', 'medium', 'low'] as const
const RELATIONS = ['SUPPORTS', 'PARTIAL', 'CONFLICTS', 'OUTDATED'] as const

function str(value: unknown, max = 1200): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  return trimmed.length > max ? `${trimmed.slice(0, max - 1)}…` : trimmed
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback
}

function num(value: unknown, fallback: number, min = 0, max = 1): number {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : []
}

// ---------------------------------------------------------------------------
// Heuristic engine
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  'the a an of for to and or in on with by from is are was were be been being this that these those what which who whom whose how when where why should must can could may might will would do does did not no nor but if then than as at it its their there here about into over under between within before after during such other same more most less least very also only all any each both few many some own same so too s t'.split(
    ' ',
  ),
)

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2 && !STOPWORDS.has(t))
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+(?=[A-Z0-9“"(])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 40)
}

interface RequirementDraft {
  code: string
  description: string
  category: string
  importance: 'high' | 'medium' | 'low'
  why_it_matters: string
  expected_evidence: string
}

/**
 * Domain-agnostic requirement template. Deliberately generic: it asks the same
 * eight structural questions of any objective (who qualifies, what figures,
 * when, what documents, how, continuation, current validity, authority) rather
 * than assuming a scholarship.
 */
function heuristicRequirements(question: string, cycle: string | null): RequirementDraft[] {
  const subject = question.replace(/\?+$/, '').replace(/^(what|which|how|when|who)\s+/i, '').slice(0, 120)
  const cycleLabel = cycle ? ` for ${cycle}` : ''
  const drafts: Array<[string, string, string, 'high' | 'medium' | 'low', string]> = [
    ['Eligibility and qualifying conditions', 'eligibility', 'high', 'Determines whether the situation is in scope at all.'],
    ['Quantitative figures, limits and thresholds', 'figures', 'high', 'Numbers are where sources most often diverge or carry an earlier cycle forward.'],
    [`Dates and deadlines${cycleLabel}`, 'timing', 'high', 'A date that has passed or belongs to another cycle changes the decision entirely.'],
    ['Required documents and formalities', 'documents', 'high', 'Missing documents are the most common cause of a failed application or claim.'],
    ['Procedure, channel and responsible authority', 'process', 'medium', 'Establishes where an authoritative answer can be obtained.'],
    ['Continuation, renewal or extension conditions', 'continuation', 'high', 'A scheme or rule can lapse even when its documentation is still online.'],
    ['Whether the governing document is still current', 'validity', 'high', 'Superseded documents frequently remain published and are easy to rely on by mistake.'],
    ['Conditions that appear to differ between sources', 'consistency', 'medium', 'Inconsistencies must be examined before anything is relied upon.'],
  ]

  return drafts.map(([description, category, importance, why], i) => ({
    code: `R${i + 1}`,
    description: description.length > 3 ? description : description,
    category,
    importance: importance as 'high' | 'medium' | 'low',
    why_it_matters: why,
    expected_evidence: `An authoritative statement addressing ${subject || 'the objective'} in a document that is current${cycleLabel}.`,
  }))
}

interface ChunkRow {
  id: string
  chunk_index: number
  content: string
  page_from: number | null
}

interface RequirementRow {
  id: string
  code: string
  description: string
  importance: string
  expected_evidence: string | null
  category?: string | null
}

interface HeuristicLink {
  chunk: ChunkRow
  requirement: RequirementRow
  relation: 'SUPPORTS' | 'PARTIAL'
  score: number
  excerpt: string
}

/**
 * Inverse document frequency over the session's own chunks.
 *
 * Without this, a passage containing "student", "scheme" and "scholarship"
 * scores highly against almost any requirement in this domain, and a shared
 * vocabulary gets mistaken for evidence. Weighting each term by how rare it is
 * *within this corpus* makes "percentile", "attendance" and "renewal" count far
 * more than words every document already uses.
 */
function buildIdf(chunks: Array<{ content: string }>): Map<string, number> {
  const df = new Map<string, number>()
  for (const chunk of chunks) {
    for (const token of new Set(tokenize(chunk.content))) {
      df.set(token, (df.get(token) ?? 0) + 1)
    }
  }
  const total = Math.max(1, chunks.length)
  const idf = new Map<string, number>()
  for (const [token, count] of df) idf.set(token, Math.log((total + 1) / (count + 0.5)))
  return idf
}

/**
 * Very small stemmer: compare on a truncated prefix so that "eligibility" meets
 * "eligible" and "documents" meets "document". It is intentionally crude — it
 * only ever widens a match within a word family, never across different words.
 */
function stem(token: string): string {
  if (token.length <= 4) return token
  if (token.endsWith('ies')) return token.slice(0, -3)
  if (token.endsWith('es') && token.length > 5) return token.slice(0, -2)
  if (token.endsWith('s')) return token.slice(0, -1)
  if (token.endsWith('ing') && token.length > 6) return token.slice(0, -3)
  if (token.endsWith('tion')) return token.slice(0, -3)
  if (token.endsWith('ity') && token.length > 6) return token.slice(0, -3)
  if (token.endsWith('ed') && token.length > 5) return token.slice(0, -2)
  return token.length > 6 ? token.slice(0, -2) : token
}

function scoreChunk(
  chunk: string,
  requirement: RequirementRow,
  idf?: Map<string, number>,
): { score: number; matched: number; excerpt: string } {
  // Score against the requirement itself. Expected-evidence boilerplate is shown
  // to the reader but deliberately excluded here: it is prose about what would
  // settle the question, and letting it match would manufacture overlap.
  const requirementTokens = tokenize(requirement.description)
  const unique = Array.from(new Set(requirementTokens))
  const haystack = chunk.toLowerCase()

  let score = 0
  let matched = 0
  for (const token of unique) {
    if (!haystack.includes(stem(token))) continue
    // Terms that appear in most chunks carry almost no discriminating power.
    // Shift the IDF curve so that even a common term carries some weight, while a
    // term unique to one document still clearly outweighs it.
    const weight = idf ? 0.5 + Math.max(0, idf.get(token) ?? 0) : token.length > 6 ? 1.4 : 1
    score += weight
    matched += 1
  }

  // Excerpt = the sentence that shares the most distinctive terms, so a quoted
  // passage is the one that actually carries the match rather than the first
  // sentence that happens to share a word.
  const candidates = sentences(chunk)
  let best = candidates[0] ?? chunk.slice(0, 300)
  let bestScore = -1
  for (const sentence of candidates) {
    const lower = sentence.toLowerCase()
    let local = 0
    for (const token of unique) if (lower.includes(stem(token))) local += idf ? 0.5 + Math.max(0, idf.get(token) ?? 0) : 1
    if (local > bestScore) {
      bestScore = local
      best = sentence
    }
  }
  return { score, matched, excerpt: best.slice(0, 600) }
}

// ---------------------------------------------------------------------------
// Prompts
// ---------------------------------------------------------------------------

const SYSTEM_RULES = `You are the analysis engine inside Digital Dark Spot, an information-completeness research tool.
Absolute rules:
- Report only what the supplied evidence says. Never introduce outside facts.
- Never state or imply that information does not exist. Use language such as "not found in the sources reviewed".
- Clearly hedge uncertainty. Findings are potential signals for human verification, not verdicts.
- Return valid JSON only, with no markdown fences and no commentary.`

function requirementsPrompt(question: string, context: string | null, cycle: string | null): string {
  return `${SYSTEM_RULES}

TASK: Decompose a research objective into the information requirements a careful researcher would need to settle before relying on the answer.

RESEARCH OBJECTIVE:
${question}

RESEARCH CONTEXT:
${context ?? '(none provided)'}

TARGET CYCLE / DATE RANGE:
${cycle ?? '(not specified)'}

RULES
- Produce between 8 and 14 requirements. They must be specific to this objective, not a generic checklist.
- Do not assume the domain is a scholarship, a policy, a product or anything else. Infer it from the objective.
- Each requirement must be something evidence could establish or fail to establish.
- Importance: "high" when the decision would change if this was wrong or missing; "medium" when it materially affects confidence; "low" otherwise.
- expected_evidence should name the kind of authoritative statement that would settle it, including the cycle when relevant.
- Never include facts, figures or answers. Only questions the evidence must answer.

Return JSON exactly in this shape:
{"requirements":[{"code":"R1","description":"...","category":"...","importance":"high|medium|low","why_it_matters":"...","expected_evidence":"..."}]}`
}

function evidencePrompt(
  sourceTitle: string,
  sourceMeta: string,
  requirements: RequirementRow[],
  chunks: ChunkRow[],
): string {
  const requirementBlock = requirements
    .map((r) => `${r.code} [${r.importance}] ${r.description}${r.expected_evidence ? ` | expected: ${r.expected_evidence}` : ''}`)
    .join('\n')
  const chunkBlock = chunks
    .map((c) => `<chunk index="${c.chunk_index}" page="${c.page_from ?? 'n/a'}">\n${c.content}\n</chunk>`)
    .join('\n\n')

  return `${SYSTEM_RULES}

TASK: Extract claim-level evidence from ONE source and map it to the research requirements.

SOURCE TITLE: ${sourceTitle}
SOURCE METADATA: ${sourceMeta}

REQUIREMENTS
${requirementBlock}

SOURCE TEXT (verbatim, chunked)
${chunkBlock}

RULES
- "claim_text" must be copied verbatim from the source text (max 400 characters). Do not paraphrase numbers, dates or conditions.
- Only produce evidence that genuinely addresses a requirement. A shared keyword is not sufficient.
- relation values:
  "SUPPORTS"  the excerpt directly establishes the requirement for the target cycle.
  "PARTIAL"   relevant but conditional, ambiguous, scoped to another group, or only part of the requirement.
  "CONFLICTS" the excerpt appears to contradict a different statement in the reviewed material. Explain in rationale which claim it appears to contradict.
  "OUTDATED"  the excerpt explicitly refers to an earlier cycle, an expired period, or a superseded approval.
- A single excerpt may link to several requirements. Omit requirements nothing addresses.
- Set quote_verified only implicitly: copy text exactly; do not invent page numbers.
- context_note: use it when the excerpt needs a caveat (undated, snippet-only, older cycle).
- Maximum 18 evidence items for this source. Prioritise the most decision-relevant.

Return JSON exactly in this shape:
{"evidence":[{"chunk_index":0,"page_number":null,"claim_text":"...","summary":"...","context_note":null,"links":[{"requirement_code":"R1","relation":"SUPPORTS","rationale":"...","confidence":0.0}]}]}`
}

function findingsPrompt(
  question: string,
  cycle: string | null,
  requirementDigest: string,
  evidenceDigest: string,
): string {
  return `${SYSTEM_RULES}

TASK: Produce findings about the COMPLETENESS and CONSISTENCY of the reviewed evidence for this research objective.

RESEARCH OBJECTIVE: ${question}
TARGET CYCLE: ${cycle ?? '(not specified)'}

REQUIREMENT STATUS (derived from evidence links)
${requirementDigest}

EVIDENCE (numbered)
${evidenceDigest}

RULES
- kind "gap": a requirement the reviewed evidence does not adequately establish. Say "not found in the sources reviewed".
- kind "conflict": two or more excerpts appear inconsistent. Put the competing excerpts in evidence_indices with roles claim_a and claim_b. Consider dates, cycles, stages and conditions before calling it a conflict; if context could explain the difference, say so in the summary and require verification.
- kind "outdated": evidence refers to an earlier cycle, an expired approval or a superseded document.
- kind "unanswered": a precise sub-question the material does not settle, even though the requirement is partly covered.
- kind "insight": a non-obvious contextual observation useful for verification.
- severity: "high" when relying on the current evidence could cause a wrong decision now.
- recommended_verification must name the authoritative source or office to consult. Never invent a URL.
- Produce 4 to 12 findings. Do not repeat the same issue twice.
- evidence_indices must reference the numbers given above. Omit when no excerpt applies.

Return JSON exactly in this shape:
{"findings":[{"kind":"gap","title":"...","summary":"...","severity":"high|medium|low","requirement_code":"R3","recommended_verification":"...","confidence":0.0,"evidence_indices":[{"index":1,"role":"claim_a","note":"..."}]}]}`
}

function checklistPrompt(question: string, requirementDigest: string, findingDigest: string): string {
  return `${SYSTEM_RULES}

TASK: Convert findings into a prioritised verification checklist a person can act on today.

RESEARCH OBJECTIVE: ${question}

REQUIREMENTS
${requirementDigest}

FINDINGS
${findingDigest}

RULES
- Each item must be a concrete action ("Confirm the 2026-27 closing date on the ministry page"), not a restatement of a finding.
- priority "high" when the person should check this before taking any action.
- recommended_source must be a category or named authority ("Ministry of Education scheme page", "state nodal agency"), never an invented URL.
- Produce one item per high-severity finding, then cover remaining requirements that need verification. 5 to 12 items total.
- finding_index refers to the zero-based index of the finding in the list above, or null.

Return JSON exactly in this shape:
{"items":[{"title":"...","why_it_matters":"...","requirement_code":"R1","finding_index":0,"recommended_source":"...","priority":"high|medium|low"}]}`
}

// ---------------------------------------------------------------------------
// Stage: requirements
// ---------------------------------------------------------------------------

async function stageRequirements(db: SupabaseClient, session: Record<string, unknown>): Promise<Record<string, unknown>> {
  const sessionId = String(session.id)
  const engineConfigured = Boolean(Deno.env.get('GEMINI_API_KEY'))
  let drafts: RequirementDraft[] = []
  let engine: 'gemini' | 'heuristic' = 'heuristic'
  let note = ''

  if (engineConfigured) {
    const prompt = requirementsPrompt(
      String(session.question ?? ''),
      (session.context as string | null) ?? null,
      (session.target_cycle as string | null) ?? null,
    )
    let result = await callGemini(prompt)
    let parsedCount = 0
    for (let attempt = 0; attempt < 2 && parsedCount === 0; attempt += 1) {
      if (attempt > 0) result = await callGemini(prompt)
      const payload = result.data as { requirements?: unknown } | undefined
      const rows = asArray(payload?.requirements)
      const parsed: RequirementDraft[] = []
      rows.slice(0, 16).forEach((row, i) => {
        const r = row as Record<string, unknown>
        const description = str(r.description, 500)
        if (!description) return
        parsed.push({
          code: str(r.code, 12) ?? `R${i + 1}`,
          description,
          category: str(r.category, 120) ?? 'general',
          importance: oneOf(r.importance, IMPORTANCE, 'medium'),
          why_it_matters: str(r.why_it_matters, 600) ?? '',
          expected_evidence: str(r.expected_evidence, 600) ?? '',
        })
      })
      if (parsed.length >= 4) {
        drafts = parsed
        parsedCount = parsed.length
        engine = 'gemini'
      }
    }
    if (parsedCount === 0) {
      note = `Gemini did not return usable requirements (${result.error ?? 'invalid schema'}). Heuristic requirements were generated instead.`
    }
  } else {
    note = 'GEMINI_API_KEY is not configured; requirements were generated by the labelled heuristic engine.'
  }

  if (drafts.length === 0) {
    drafts = heuristicRequirements(String(session.question ?? ''), (session.target_cycle as string | null) ?? null)
    engine = 'heuristic'
  }

  // Rebuild requirements for this session (cascade clears dependent links).
  await db.from('requirements').delete().eq('session_id', sessionId)
  await db.from('findings').delete().eq('session_id', sessionId)
  await db.from('checklist_items').delete().eq('session_id', sessionId)
  await db.from('evidence_items').delete().eq('session_id', sessionId)

  const { error } = await db.from('requirements').insert(
    drafts.map((d, i) => ({
      session_id: sessionId,
      code: d.code,
      description: d.description,
      category: d.category,
      importance: d.importance,
      why_it_matters: d.why_it_matters,
      expected_evidence: d.expected_evidence,
      order_index: i,
      engine,
    })),
  )
  if (error) throw new Error(`Could not store requirements: ${error.message}`)

  await db
    .from('research_sessions')
    .update({ analysis_engine: engine, status: 'analysing', analysis_error: note || null })
    .eq('id', sessionId)

  return {
    stage: 'requirements',
    engine,
    message: `${drafts.length} requirement(s) generated${engine === 'heuristic' ? ' (heuristic engine)' : ''}.`,
  }
}

// ---------------------------------------------------------------------------
// Stage: evidence
// ---------------------------------------------------------------------------

interface StageContext {
  db: SupabaseClient
  sessionId: string
  deadline: number
}

async function stageEvidence(ctx: StageContext, batchSize: number): Promise<Record<string, unknown>> {
  const { db, sessionId } = ctx
  const engineConfigured = Boolean(Deno.env.get('GEMINI_API_KEY'))

  const { data: requirementsData, error: requirementError } = await db
    .from('requirements')
    .select('id,code,description,importance,expected_evidence,category')
    .eq('session_id', sessionId)
    .order('order_index')
  if (requirementError) throw new Error(requirementError.message)
  const requirements = (requirementsData ?? []) as RequirementRow[]
  if (requirements.length === 0) throw new Error('Generate requirements before mapping evidence.')

  const { data: sessionRow } = await db
    .from('research_sessions')
    .select('target_cycle')
    .eq('id', sessionId)
    .maybeSingle()
  const targetCycle = (sessionRow?.target_cycle as string | null) ?? null

  const { data: sourcesData } = await db
    .from('sources')
    .select('id,title,issuer,domain,published_date,source_type,status')
    .eq('session_id', sessionId)
    .in('status', ['extracted', 'partial'])
    .order('created_at')
  const sources = (sourcesData ?? []) as Array<Record<string, unknown>>
  if (sources.length === 0) {
    return { stage: 'evidence', processed: 0, remaining: 0, message: 'No successfully extracted sources to map yet.' }
  }

  // How many chunks does each source have? Needed to know when it is finished.
  const totals = new Map<string, number>()
  for (const source of sources) {
    const { count } = await db
      .from('source_chunks')
      .select('id', { count: 'exact', head: true })
      .eq('source_id', String(source.id))
    totals.set(String(source.id), Number(count ?? 0))
  }

  // Cursor persistence so long documents resume instead of truncating silently.
  const { data: lastJob } = await db
    .from('analysis_jobs')
    .select('id,payload')
    .eq('session_id', sessionId)
    .eq('stage', 'evidence')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()
  const cursors: Record<string, number> = {
    ...((lastJob?.payload as { cursors?: Record<string, number> })?.cursors ?? {}),
  }

  const requirementByCode = new Map(requirements.map((r) => [r.code, r]))
  let processed = 0
  let mappedEvidence = 0
  let usedEngine: 'gemini' | 'heuristic' = 'heuristic'
  const notes: string[] = []

  for (const source of sources) {
    if (processed >= batchSize) break
    if (Date.now() > ctx.deadline) break

    const sourceId = String(source.id)
    const total = Math.min(totals.get(sourceId) ?? 0, MAX_CHUNKS_PER_SOURCE)
    const from = Math.min(cursors[sourceId] ?? 0, total)
    if (from >= total) {
      processed += 1
      continue
    }

    const { data: chunksData } = await db
      .from('source_chunks')
      .select('id,chunk_index,content,page_from')
      .eq('source_id', sourceId)
      .order('chunk_index')
      .range(from, from + CHUNKS_PER_BATCH - 1)
    const chunks = (chunksData ?? []) as ChunkRow[]
    if (chunks.length === 0) {
      cursors[sourceId] = total
      processed += 1
      continue
    }

    if (from === 0) {
      // Fresh mapping for this source: clear previous evidence.
      await db.from('evidence_items').delete().eq('source_id', sourceId)
    }

    const mapped = await mapChunksToRequirements(
      ctx,
      source,
      chunks,
      requirements,
      requirementByCode,
      engineConfigured,
      notes,
      targetCycle,
    )
    mappedEvidence += mapped.count
    if (mapped.engine) usedEngine = mapped.engine

    cursors[sourceId] = from + chunks.length
    if (cursors[sourceId] >= total) processed += 1

    if (lastJob?.id) {
      await db.from('analysis_jobs').update({ payload: { cursors } }).eq('id', lastJob.id)
    }

    if (Date.now() > ctx.deadline) break
  }

  const remaining = sources.filter((s) => {
    const sourceId = String(s.id)
    const total = Math.min(totals.get(sourceId) ?? 0, MAX_CHUNKS_PER_SOURCE)
    return (cursors[sourceId] ?? 0) < total
  }).length

  const truncated = sources.filter((s) => (totals.get(String(s.id)) ?? 0) > MAX_CHUNKS_PER_SOURCE)
  if (truncated.length > 0) {
    notes.push(
      `${truncated.length} source(s) exceed the ${MAX_CHUNKS_PER_SOURCE}-chunk per-source analysis limit; only the first ${MAX_CHUNKS_PER_SOURCE} chunks were mapped.`,
    )
  }

  await db
    .from('research_sessions')
    .update({ analysis_engine: usedEngine, status: 'analysing', analysis_error: notes[0] ?? null })
    .eq('id', sessionId)

  return {
    stage: 'evidence',
    engine: usedEngine,
    processed,
    remaining,
    message:
      remaining > 0
        ? `Mapped ${mappedEvidence} excerpt(s) so far; ${remaining} source(s) still to map.`
        : `Mapped ${mappedEvidence} excerpt(s) across ${sources.length} source(s)${
            usedEngine === 'heuristic' ? ' (heuristic engine)' : ''
          }.`,
  }
}

async function mapChunksToRequirements(
  ctx: StageContext,
  source: Record<string, unknown>,
  chunks: ChunkRow[],
  requirements: RequirementRow[],
  requirementByCode: Map<string, RequirementRow>,
  engineConfigured: boolean,
  notes: string[],
  targetCycle: string | null = null,
): Promise<{ count: number; engine: 'gemini' | 'heuristic' | null }> {
  const { db, sessionId } = ctx
  const sourceId = String(source.id)

  interface NewEvidence {
    chunk_id: string
    claim_text: string
    summary: string | null
    context_note: string | null
    page_number: number | null
    quote_verified: boolean
    locator: string
    links: Array<{ requirement_id: string; relation: string; rationale: string; confidence: number }>
  }

  const inserted: NewEvidence[] = []

  if (engineConfigured) {
    const meta = [
      source.issuer ? `issuer: ${source.issuer}` : null,
      source.domain ? `domain: ${source.domain}` : null,
      source.published_date ? `published: ${source.published_date}` : 'publication date: unknown',
      source.source_type ? `type: ${source.source_type}` : null,
    ]
      .filter(Boolean)
      .join(' · ')

    const prompt = evidencePrompt(String(source.title ?? 'Untitled source'), meta, requirements, chunks)
    let result = await callGemini(prompt, 5000)
    let payload = result.data as { evidence?: unknown } | undefined
    if (!result.ok || !Array.isArray(payload?.evidence)) {
      result = await callGemini(prompt, 5000)
      payload = result.data as { evidence?: unknown } | undefined
    }
    if (result.ok && Array.isArray(payload?.evidence)) {
      for (const row of asArray(payload?.evidence).slice(0, 20)) {
        const item = row as Record<string, unknown>
        const claim = str(item.claim_text, 1200)
        if (!claim) continue
        const chunkIndex = Number(item.chunk_index)
        const chunk = chunks.find((c) => c.chunk_index === chunkIndex) ?? chunks[0]
        if (!chunk) continue

        const normalizedChunk = chunk.content.replace(/\s+/g, ' ').toLowerCase()
        const normalizedClaim = claim.replace(/\s+/g, ' ').toLowerCase()
        const quoteVerified = normalizedChunk.includes(normalizedClaim.slice(0, Math.min(120, normalizedClaim.length)))

        const links: NewEvidence['links'] = []
        for (const linkRow of asArray(item.links).slice(0, 6)) {
          const link = linkRow as Record<string, unknown>
          const code = str(link.requirement_code, 12)
          const requirement = code ? requirementByCode.get(code) : undefined
          if (!requirement) continue
          links.push({
            requirement_id: requirement.id,
            relation: oneOf(link.relation, RELATIONS, 'PARTIAL'),
            rationale: str(link.rationale, 700) ?? '',
            confidence: num(link.confidence, 0.5),
          })
        }

        inserted.push({
          chunk_id: chunk.id,
          claim_text: claim,
          summary: str(item.summary, 700),
          context_note: str(item.context_note, 500),
          page_number: Number.isFinite(Number(item.page_number)) ? Number(item.page_number) : chunk.page_from,
          quote_verified: quoteVerified,
          locator: `chunk ${chunk.chunk_index}`,
          links,
        })
      }
      if (inserted.length > 0) {
        await persistEvidence(db, sessionId, sourceId, inserted, 'gemini')
        return { count: inserted.length, engine: 'gemini' }
      }
    }
    notes.push(
      `Gemini evidence extraction failed for “${String(source.title ?? '')}” (${result.error ?? 'no usable items'}); heuristic matching was used for that source.`,
    )
  }

  // ------------------------------------------------------- heuristic mapping
  const drafts = buildHeuristicEvidence(chunks, requirements, requirementByCode)

  // Dates and academic cycles are examined only when the model is unavailable:
  // a deterministic rule is better than leaving the judgement unmade, and it is
  // reported as a labelled heuristic signal rather than as a model conclusion.
  const linksByChunk = new Map<string, string[]>()
  for (const draft of drafts) linksByChunk.set(draft.chunk_id, draft.links.map((l) => l.requirement_id))
  const categoryByRequirement = new Map(requirements.map((r) => [r.id, r.category ?? '']))
  const signals = examineCycles(
    chunks.map((c) => ({ id: c.id, content: c.content, page_from: c.page_from, source_id: sourceId })),
    linksByChunk,
    categoryByRequirement,
    targetCycle,
  )
  inserted.push(...applyCycleSignals(drafts, signals))

  if (inserted.length === 0) return { count: 0, engine: 'heuristic' }
  await persistEvidence(db, sessionId, sourceId, inserted, 'heuristic')
  return { count: inserted.length, engine: 'heuristic' }
}

async function persistEvidence(
  db: SupabaseClient,
  sessionId: string,
  sourceId: string,
  items: Array<{
    chunk_id: string
    claim_text: string
    summary: string | null
    context_note: string | null
    page_number: number | null
    quote_verified: boolean
    locator: string
    links: Array<{ requirement_id: string; relation: string; rationale: string; confidence: number }>
  }>,
  engine: 'gemini' | 'heuristic',
) {
  for (const item of items) {
    const { data: evidenceRow, error } = await db
      .from('evidence_items')
      .insert({
        session_id: sessionId,
        source_id: sourceId,
        chunk_id: item.chunk_id,
        claim_text: item.claim_text,
        summary: item.summary,
        context_note: item.context_note,
        page_number: item.page_number,
        quote_verified: item.quote_verified,
        locator: item.locator,
        engine,
      })
      .select('id')
      .single()
    if (error || !evidenceRow) continue

    if (item.links.length > 0) {
      const seen = new Set<string>()
      const rows = item.links
        .filter((l) => {
          const key = `${l.requirement_id}:${l.relation}`
          if (seen.has(key)) return false
          seen.add(key)
          return true
        })
        .map((l) => ({
          session_id: sessionId,
          evidence_id: evidenceRow.id,
          requirement_id: l.requirement_id,
          relation: l.relation,
          rationale: l.rationale,
          confidence: l.confidence,
          engine,
        }))
      await db.from('evidence_links').insert(rows)
    }
  }
}

interface HeuristicEvidence {
  chunk_id: string
  claim_text: string
  summary: string | null
  context_note: string | null
  page_number: number | null
  quote_verified: boolean
  locator: string
  links: Array<{ requirement_id: string; relation: string; rationale: string; confidence: number }>
}

/**
 * Lexical evidence mapping — PURE.
 *
 * Deliberately conservative: a passage must share at least three significant
 * terms with a requirement before it is linked at all, and it only counts as
 * SUPPORTS when the overlap is strong. Everything weaker is PARTIAL, and the
 * excerpt keeps a context note saying it was selected by term matching rather
 * than by understanding, so a reviewer knows what they are looking at.
 *
 * Never assigns CONFLICTS or OUTDATED: those require a judgement about dates and
 * scope that term overlap cannot make, so they are left to the model or to a
 * human rather than guessed.
 */
export function buildHeuristicEvidence(
  chunks: ChunkRow[],
  requirements: RequirementRow[],
  _requirementByCode?: Map<string, RequirementRow>,
): HeuristicEvidence[] {
  const idf = buildIdf(chunks)
  const linked: Array<{
    chunk: ChunkRow
    requirement: RequirementRow
    relation: 'SUPPORTS' | 'PARTIAL'
    score: number
    excerpt: string
  }> = []

  for (const requirement of requirements) {
    const terms = new Set(tokenize(requirement.description)).size
    // Precision first. A requirement is "supported" only when a single passage
    // contains essentially all of its terms (one may be missing for longer
    // requirements). Partial mention stays PARTIAL — never promoted to found.
    const neededForSupport = terms >= 4 ? terms - 1 : terms
    const neededForMatch = Math.max(1, Math.ceil(terms / 2))

    const scored = chunks
      .map((chunk) => {
        const { score, matched, excerpt } = scoreChunk(chunk.content, requirement, idf)
        return { chunk, requirement, score, matched, excerpt }
      })
      .filter((s) => s.matched >= neededForMatch && s.score >= 1.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)

    for (const s of scored) {
      linked.push({
        chunk: s.chunk,
        requirement: s.requirement,
        relation: s.matched >= neededForSupport && s.score >= 3 ? 'SUPPORTS' : 'PARTIAL',
        score: s.score,
        excerpt: s.excerpt,
      })
    }
  }

  const byChunk = new Map<string, typeof linked>()
  for (const item of linked) {
    const list = byChunk.get(item.chunk.id) ?? []
    list.push(item)
    byChunk.set(item.chunk.id, list)
  }

  const drafts: HeuristicEvidence[] = []
  for (const [, items] of byChunk) {
    const chunk = items[0].chunk
    const primary = items.sort((a, b) => b.score - a.score)[0]
    drafts.push({
      chunk_id: chunk.id,
      claim_text: primary.excerpt,
      summary: null,
      context_note:
        'Selected by weighted term matching over this session\'s documents, not by semantic understanding. Verify that this passage actually addresses the requirement.',
      page_number: chunk.page_from,
      quote_verified: true,
      locator: `chunk ${chunk.chunk_index}`,
      links: items.slice(0, 5).map((item) => ({
        requirement_id: item.requirement.id,
        relation: item.relation,
        rationale: `Heuristic match: ${item.score.toFixed(1)} weighted term overlap with this requirement.`,
        confidence: Math.min(0.5, 0.15 + item.score / 40),
      })),
    })
  }
  return drafts
}

// ---------------------------------------------------------------------------
// Date and cycle examination (deterministic, text-only)
// ---------------------------------------------------------------------------

/** "2026-27", "2026–2027", "AY 2025-26" -> the start year as a number. */
export function parseCycleStart(token: string): number | null {
  const m = token.match(/(20\d{2}|19\d{2})\s*[-–—]\s*(\d{2,4})/)
  if (!m) return null
  const start = Number(m[1])
  const rawEnd = m[2]
  const end = rawEnd.length === 2 ? Math.floor(start / 100) * 100 + Number(rawEnd) : Number(rawEnd)
  // Reject nonsense such as "2026-1999".
  if (!Number.isFinite(end) || end < start || end > start + 10) return null
  return start
}

export function cyclesIn(text: string): number[] {
  const found = new Set<number>()
  for (const m of text.matchAll(/(20\d{2}|19\d{2})\s*[-–—]\s*(\d{2,4})/g)) {
    const start = parseCycleStart(m[0])
    if (start !== null) found.add(start)
  }
  return [...found].sort((a, b) => a - b)
}

const MONTHS = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec'
/** Explicit calendar dates only. Deliberately strict: a vague "November" is not a deadline. */
const DATE_PATTERNS = [
  new RegExp(`\\b(\\d{1,2})[./-](\\d{1,2})[./-](20\\d{2})\\b`, 'g'),
  new RegExp(`\\b(\\d{1,2})\\s+(${MONTHS})[a-z]*\\s+(20\\d{2})\\b`, 'gi'),
]

export function explicitDates(text: string): string[] {
  const out = new Set<string>()
  for (const m of text.matchAll(DATE_PATTERNS[0])) {
    const [, d, mo, y] = m
    out.add(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  for (const m of text.matchAll(DATE_PATTERNS[1])) {
    const [, d, monthName, y] = m
    const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].findIndex((abbr) =>
      String(monthName).toLowerCase().startsWith(abbr),
    )
    if (month >= 0) out.add(`${y}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`)
  }
  return [...out].sort()
}

export interface CycleSignal {
  kind: 'outdated' | 'conflict' | 'earlier-cycle'
  chunk_id: string
  requirement_id: string
  /** Present for conflicts only. */
  other_chunk_id?: string
  rationale: string
  date?: string
}

/**
 * Examine dates and academic cycles in the material that was actually extracted.
 *
 * Rules (deterministic, no guessing):
 *  1. OUTDATED — a passage that discusses timing or validity, whose latest named
 *     cycle ends before the target cycle starts, describes an earlier period. A
 *     passage with no cycle at all is never called outdated: undated is unknown,
 *     not old.
 *  2. CONFLICT — two different sources state *different explicit calendar dates*
 *     for the same requirement. Only real, parsed dates count; a date mentioned
 *     in one source and absent in another is not a conflict.
 *
 * Both rules are conservative by design: they would rather miss a signal than
 * invent one, because a fabricated conflict is worse than no conflict.
 */
export function examineCycles(
  chunks: Array<{ id: string; content: string; page_from: number | null; source_id: string }>,
  requirementIdsByChunk: Map<string, string[]>,
  requirementCategory: Map<string, string>,
  targetCycle: string | null,
): CycleSignal[] {
  const targetStart = targetCycle ? parseCycleStart(targetCycle) : null
  if (targetStart === null) return []

  const signals: CycleSignal[] = []
  const datesByRequirement = new Map<string, Map<string, { chunk_id: string; source_id: string; date: string }[]>>()

  for (const chunk of chunks) {
    const cycles = cyclesIn(chunk.content)
    const latest = cycles.length ? cycles[cycles.length - 1] : null
    const requirementIds = requirementIdsByChunk.get(chunk.id) ?? []

    for (const requirementId of requirementIds) {
      const category = requirementCategory.get(requirementId) ?? ''
      const timingSensitive = category === 'timing' || category === 'validity'
      if (latest !== null && latest < targetStart) {
        signals.push({
          kind: 'earlier-cycle',
          chunk_id: chunk.id,
          requirement_id: requirementId,
          rationale: `This passage refers to ${cycles.map((c) => `${c}–${String(c + 1).slice(2)}`).join(', ')}, not to the target cycle starting ${targetStart}. It cannot establish the position for the target cycle on its own.`,
        })
      }

      if (timingSensitive && latest !== null && latest < targetStart) {
        signals.push({
          kind: 'outdated',
          chunk_id: chunk.id,
          requirement_id: requirementId,
          rationale: `This passage refers to ${cycles.map((c) => `${c}–${String(c + 1).slice(2)}`).join(', ')}. The target cycle starts in ${targetStart}, so the passage describes an earlier period and its current validity is unknown.`,
        })
      }

      // Conflict evidence is gathered from every linked passage, timing-related or not.
      for (const date of explicitDates(chunk.content)) {
        const byDate = datesByRequirement.get(requirementId) ?? new Map()
        const list = byDate.get(date) ?? []
        list.push({ chunk_id: chunk.id, source_id: chunk.source_id, date })
        byDate.set(date, list)
        datesByRequirement.set(requirementId, byDate)
      }
    }
  }

  // Two different sources naming two different dates for one requirement.
  for (const [requirementId, byDate] of datesByRequirement) {
    const dates = [...byDate.keys()]
    if (dates.length < 2) continue
    for (let i = 0; i < dates.length; i += 1) {
      for (let j = i + 1; j < dates.length; j += 1) {
        const a = byDate.get(dates[i])?.[0]
        const b = byDate.get(dates[j])?.[0]
        if (!a || !b || a.source_id === b.source_id) continue
        signals.push({
          kind: 'conflict',
          chunk_id: a.chunk_id,
          other_chunk_id: b.chunk_id,
          requirement_id: requirementId,
          date: dates[i],
          rationale: `Two reviewed sources state different dates for this requirement (${dates[i]} and ${dates[j]}). Dates, stages or cycles may explain the difference, so this is a possible inconsistency requiring verification.`,
        })
        return signals
      }
    }
  }

  return signals
}

/**
 * Fold cycle signals into evidence drafts: re-label linked passages as OUTDATED
 * and, where two sources genuinely disagree on a date, add the second excerpt as
 * a CONFLICTS link on the same evidence row so the UI can show both sides.
 */
export function applyCycleSignals(
  drafts: HeuristicEvidence[],
  signals: CycleSignal[],
): HeuristicEvidence[] {
  if (signals.length === 0) return drafts

  const outdated = new Set(
    signals.filter((s) => s.kind === 'outdated').map((s) => `${s.chunk_id}:${s.requirement_id}`),
  )
  const earlier = new Map<string, string>()
  for (const signal of signals) {
    if (signal.kind === 'earlier-cycle') earlier.set(`${signal.chunk_id}:${signal.requirement_id}`, signal.rationale)
  }
  const conflicts = new Map<string, string>()
  for (const signal of signals) {
    if (signal.kind === 'conflict') {
      conflicts.set(`${signal.chunk_id}:${signal.requirement_id}`, signal.rationale)
    }
  }

  for (const draft of drafts) {
    draft.links = draft.links.map((link) => {
      const outdatedKey = `${draft.chunk_id}:${link.requirement_id}`
      const conflictRationale = conflicts.get(outdatedKey)
      if (conflictRationale) {
        return { ...link, relation: 'CONFLICTS', rationale: conflictRationale, confidence: Math.min(link.confidence, 0.4) }
      }
      const earlierRationale = earlier.get(outdatedKey)
      if (earlierRationale && link.relation === 'SUPPORTS') {
        return { ...link, relation: 'PARTIAL', rationale: earlierRationale, confidence: Math.min(link.confidence, 0.4) }
      }
      if (outdated.has(outdatedKey)) {
        const signal = signals.find((s) => s.chunk_id === draft.chunk_id && s.requirement_id === link.requirement_id)
        return {
          ...link,
          relation: 'OUTDATED',
          rationale: signal?.rationale ?? link.rationale,
          confidence: Math.min(link.confidence, 0.45),
        }
      }
      return link
    })
    if (draft.links.some((l) => l.relation === 'OUTDATED')) {
      draft.context_note =
        'This passage refers to an earlier cycle than the one being researched. Nothing here establishes the position for the target cycle.'
    }
  }

  // De-duplicate: one link per requirement per evidence row.
  for (const draft of drafts) {
    const seen = new Set<string>()
    draft.links = draft.links.filter((l) => {
      if (seen.has(l.requirement_id)) return false
      seen.add(l.requirement_id)
      return true
    })
  }

  return drafts
}

// ---------------------------------------------------------------------------
// Stage: findings
// ---------------------------------------------------------------------------

async function stageFindings(ctx: StageContext): Promise<Record<string, unknown>> {
  const { db, sessionId } = ctx

  const { data: statusRows } = await db.from('v_requirement_status').select('*').eq('session_id', sessionId)
  const requirements = (statusRows ?? []) as Array<Record<string, unknown>>
  if (requirements.length === 0) throw new Error('Generate requirements before producing findings.')

  const { data: evidenceRows } = await db
    .from('evidence_items')
    .select('id,source_id,claim_text,page_number,context_note,evidence_links(requirement_id,relation,rationale)')
    .eq('session_id', sessionId)
    .limit(120)
  const evidence = (evidenceRows ?? []) as Array<Record<string, unknown>>

  const { data: sourceRows } = await db.from('sources').select('id,title,issuer,domain,published_date,source_type').eq('session_id', sessionId)
  const sourceById = new Map((sourceRows ?? []).map((s) => [String(s.id), s]))

  const codeById = new Map(requirements.map((r) => [String(r.requirement_id), String(r.code)]))

  const engineConfigured = Boolean(Deno.env.get('GEMINI_API_KEY'))
  let usedEngine: 'gemini' | 'heuristic' = 'heuristic'
  let note = ''
  let created = 0

  await db.from('findings').delete().eq('session_id', sessionId)
  await db.from('checklist_items').delete().eq('session_id', sessionId)

  if (engineConfigured && evidence.length > 0) {
    const requirementDigest = requirements
      .map(
        (r) =>
          `${r.code} [${r.importance}] ${r.description} → status ${r.status} (supports ${r.supports}, partial ${r.partial}, conflicts ${r.conflicts}, outdated ${r.outdated})`,
      )
      .join('\n')

    const evidenceDigest = evidence
      .map((e, i) => {
        const source = sourceById.get(String(e.source_id))
        const links = asArray(e.evidence_links)
          .map((l) => `${codeById.get(String((l as Record<string, unknown>).requirement_id)) ?? '?'}:${(l as Record<string, unknown>).relation}`)
          .join(', ')
        return `#${i + 1} [${String(source?.source_type ?? 'source')} · ${String(source?.issuer ?? source?.domain ?? 'unknown')} · ${
          source?.published_date ? String(source.published_date) : 'undated'
        }${e.page_number ? ` · p.${String(e.page_number)}` : ''}] links(${links || 'none'}): ${String(e.claim_text).slice(0, 420)}`
      })
      .join('\n')

    const { data: sessionMeta } = await db
      .from('research_sessions')
      .select('question,target_cycle')
      .eq('id', sessionId)
      .maybeSingle()
    const prompt = findingsPrompt(
      String(sessionMeta?.question ?? ''),
      (sessionMeta?.target_cycle as string | null) ?? null,
      requirementDigest,
      evidenceDigest,
    )

    const result = await callGemini(prompt, 6000)
    const payload = result.data as { findings?: unknown } | undefined
    const rows = asArray(payload?.findings)

    if (result.ok && rows.length > 0) {
      for (const row of rows.slice(0, 14)) {
        const f = row as Record<string, unknown>
        const title = str(f.title, 300)
        const summary = str(f.summary, 2000)
        const kind = oneOf(f.kind, ['gap', 'conflict', 'outdated', 'unanswered', 'insight'] as const, 'gap')
        if (!title || !summary) continue
        const code = str(f.requirement_code, 12)
        const requirement = code ? requirements.find((r) => String(r.code) === code) : undefined

        const { data: findingRow, error } = await db
          .from('findings')
          .insert({
            session_id: sessionId,
            kind,
            title,
            summary,
            severity: oneOf(f.severity, IMPORTANCE, 'medium'),
            requirement_id: requirement ? String(requirement.requirement_id) : null,
            recommended_verification: str(f.recommended_verification, 900),
            confidence: num(f.confidence, 0.6),
            engine: 'gemini',
          })
          .select('id')
          .single()
        if (error || !findingRow) continue
        created += 1

        for (const linkRow of asArray(f.evidence_indices).slice(0, 4)) {
          const link = linkRow as Record<string, unknown>
          const idx = Number(link.index) - 1
          const item = evidence[idx]
          if (!item) continue
          await db.from('finding_evidence').insert({
            finding_id: findingRow.id,
            evidence_id: String(item.id),
            role: oneOf(link.role, ['claim_a', 'claim_b', 'claim_c', 'context', 'supporting'] as const, 'context'),
            note: str(link.note, 500),
          })
        }
      }
      if (created > 0) usedEngine = 'gemini'
    }
    if (created === 0) {
      note = `Gemini findings were unusable (${result.error ?? 'invalid schema'}); heuristic findings were generated instead.`
    }
  } else if (!engineConfigured) {
    note = 'GEMINI_API_KEY is not configured; findings were derived from evidence-coverage rules (heuristic engine).'
  }

  if (usedEngine === 'heuristic') {
    created = await heuristicFindings(db, sessionId, requirements, evidence, sourceById)
  }

  await db
    .from('research_sessions')
    .update({
      analysis_engine: usedEngine,
      status: 'analysing',
      last_analysed_at: new Date().toISOString(),
      analysis_error: note || null,
    })
    .eq('id', sessionId)

  return {
    stage: 'findings',
    engine: usedEngine,
    message: `${created} finding(s) generated${usedEngine === 'heuristic' ? ' by the heuristic engine' : ''}.`,
  }
}

interface DraftFinding {
  finding: Record<string, unknown>
  links: Array<{ evidence_id: string; role: string; note?: string | null }>
}

/**
 * Heuristic findings — PURE.
 *
 * Kept free of a database handle so the exact same rules can be exercised by the
 * test suite and by the offline demo importer. A finding derived here is always
 * traceable to the requirement and excerpt that produced it, and a gap quotes
 * nothing because an absence has no excerpt.
 */
export function buildHeuristicFindings(
  requirements: Array<Record<string, unknown>>,
  evidence: Array<Record<string, unknown>>,
  sourceById: Map<string, Record<string, unknown>>,
): DraftFinding[] {
  const drafts: DraftFinding[] = []

  for (const requirement of requirements) {
    const status = String(requirement.status)
    const requirementId = String(requirement.requirement_id)
    const linkedEvidence = evidence.filter((e) =>
      asArray(e.evidence_links).some((l) => String((l as Record<string, unknown>).requirement_id) === requirementId),
    )

    if (status === 'not_found') {
      drafts.push({
        finding: {
          kind: 'gap',
          title: `Not found in reviewed sources: ${String(requirement.description).slice(0, 180)}`,
          summary: `None of the excerpts reviewed addresses this requirement. This does not establish that the information is unavailable elsewhere — only that the sources reviewed here do not settle it.`,
          severity: requirement.importance === 'high' ? 'high' : 'medium',
          requirement_id: requirementId,
          recommended_verification:
            'Consult the authoritative publisher directly (the issuing ministry, department or agency) for the current cycle.',
        },
        links: [],
      })
      continue
    }

    const conflicting = linkedEvidence.filter((e) =>
      asArray(e.evidence_links).some(
        (l) =>
          String((l as Record<string, unknown>).requirement_id) === requirementId &&
          (l as Record<string, unknown>).relation === 'CONFLICTS',
      ),
    )
    const outdated = linkedEvidence.filter((e) =>
      asArray(e.evidence_links).some(
        (l) =>
          String((l as Record<string, unknown>).requirement_id) === requirementId &&
          (l as Record<string, unknown>).relation === 'OUTDATED',
      ),
    )

    if (conflicting.length >= 2) {
      const [a, b] = conflicting
      drafts.push({
        finding: {
          kind: 'conflict',
          title: `Sources appear inconsistent: ${String(requirement.description).slice(0, 150)}`,
          summary: `Two reviewed excerpts make different statements about this requirement. Dates, academic years and application stages may explain the difference; treat this as a possible inconsistency requiring verification rather than proof that either source is wrong.`,
          severity: 'high',
          requirement_id: requirementId,
          recommended_verification:
            'Compare the publication dates and scope of both sources, then confirm the current position with the issuing authority.',
        },
        links: [
          {
            evidence_id: String(a.id),
            role: 'claim_a',
            note: `Source: ${String(sourceById.get(String(a.source_id))?.title ?? 'unknown')}`,
          },
          {
            evidence_id: String(b.id),
            role: 'claim_b',
            note: `Source: ${String(sourceById.get(String(b.source_id))?.title ?? 'unknown')}`,
          },
        ],
      })
    }

    if (outdated.length > 0 && status !== 'found') {
      const first = outdated[0]
      drafts.push({
        finding: {
          kind: 'outdated',
          title: `May describe an earlier period: ${String(requirement.description).slice(0, 150)}`,
          summary: `The reviewed excerpt refers to an earlier cycle or a period that may have lapsed. Its current validity is unknown, so it should not be relied upon for the target cycle without confirmation.`,
          severity: requirement.importance === 'high' ? 'high' : 'medium',
          requirement_id: requirementId,
          recommended_verification: 'Confirm the current cycle and validity directly with the issuing authority.',
        },
        links: [{ evidence_id: String(first.id), role: 'context', note: null }],
      })
    }
  }

  return drafts
}

async function heuristicFindings(
  db: SupabaseClient,
  sessionId: string,
  requirements: Array<Record<string, unknown>>,
  evidence: Array<Record<string, unknown>>,
  sourceById: Map<string, Record<string, unknown>>,
): Promise<number> {
  let created = 0
  for (const draft of buildHeuristicFindings(requirements, evidence, sourceById)) {
    const { data, error } = await db
      .from('findings')
      .insert({
        session_id: sessionId,
        engine: 'heuristic',
        confidence: (draft.finding.confidence as number | undefined) ?? 0.4,
        ...draft.finding,
      })
      .select('id')
      .single()
    if (error || !data) continue
    created += 1
    for (const link of draft.links) {
      await db.from('finding_evidence').insert({
        finding_id: data.id,
        evidence_id: link.evidence_id,
        role: link.role,
        note: link.note ?? null,
      })
    }
  }
  return created
}

/**
 * Rule-based verification checklist — PURE.
 *
 * One actionable item per finding, prioritised by the finding's severity. Gap
 * findings are phrased as a direct confirmation step rather than restating the
 * gap, so the checklist reads as work to do rather than as a conclusion.
 */
export function buildHeuristicChecklist(
  findings: Array<Record<string, unknown>>,
  requirementsNeedingVerification: Array<Record<string, unknown>> = [],
): Array<Record<string, unknown>> {
  const items: Array<Record<string, unknown>> = findings.slice(0, 14).map((f, index) => ({
    title:
      f.kind === 'gap'
        ? `Confirm directly: ${String(f.title).replace(/^Not found in reviewed sources:\s*/i, '').slice(0, 200)}`
        : String(f.title).slice(0, 240),
    why_it_matters: String(f.summary).slice(0, 600),
    requirement_id: f.requirement_id ? String(f.requirement_id) : null,
    finding_id: String(f.id),
    recommended_source:
      (f.recommended_verification as string | null) ??
      'The authoritative publisher for this scheme or rule.',
    priority: f.severity === 'high' ? 'high' : f.severity === 'medium' ? 'medium' : 'low',
    order_index: index,
    engine: 'heuristic',
  }))

  // Requirements that are only partly supported, conflicting or outdated still
  // need a human to look, even when no finding was raised for them.
  const covered = new Set(items.map((i) => i.requirement_id).filter(Boolean))
  for (const requirement of requirementsNeedingVerification) {
    const requirementId = String(requirement.requirement_id ?? requirement.id ?? '')
    if (!requirementId || covered.has(requirementId)) continue
    const status = String(requirement.status ?? '')
    if (!['partial', 'conflicting', 'outdated'].includes(status)) continue
    items.push({
      title: `Verify with the authority: ${String(requirement.description ?? '').slice(0, 180)}`,
      why_it_matters: `The reviewed material only ${status === 'partial' ? 'partly supports' : status === 'conflicting' ? 'disagrees on' : 'describes an earlier period for'} this requirement, so it cannot be relied on without confirmation.`,
      requirement_id: requirementId,
      finding_id: null,
      recommended_source: 'The issuing ministry, department or agency for the current cycle.',
      priority: requirement.importance === 'high' ? 'high' : 'medium',
      order_index: items.length,
      engine: 'heuristic',
    })
  }

  return items.slice(0, 16)
}

// ---------------------------------------------------------------------------
// Stage: checklist
// ---------------------------------------------------------------------------

async function stageChecklist(ctx: StageContext): Promise<Record<string, unknown>> {
  const { db, sessionId } = ctx
  const { data: findingsRows } = await db.from('findings').select('*').eq('session_id', sessionId).order('created_at')
  const findings = (findingsRows ?? []) as Array<Record<string, unknown>>
  const { data: statusRows } = await db.from('v_requirement_status').select('*').eq('session_id', sessionId)
  const requirements = (statusRows ?? []) as Array<Record<string, unknown>>
  const { data: sessionRow } = await db.from('research_sessions').select('question').eq('id', sessionId).maybeSingle()

  await db.from('checklist_items').delete().eq('session_id', sessionId)

  const engineConfigured = Boolean(Deno.env.get('GEMINI_API_KEY'))
  let usedEngine: 'gemini' | 'heuristic' = 'heuristic'
  let created = 0
  let note = ''

  if (engineConfigured && findings.length > 0) {
    const requirementDigest = requirements
      .map((r) => `${r.code} [${r.importance}] ${r.description} → ${r.status}`)
      .join('\n')
    const findingDigest = findings
      .map((f, i) => `${i}. [${f.kind}/${f.severity}] ${f.title} — ${String(f.summary).slice(0, 320)}`)
      .join('\n')

    const result = await callGemini(
      checklistPrompt(String(sessionRow?.question ?? ''), requirementDigest, findingDigest),
      4000,
    )
    const payload = result.data as { items?: unknown } | undefined
    const rows = asArray(payload?.items)

    if (result.ok && rows.length > 0) {
      const inserts: Array<Record<string, unknown>> = []
      rows.slice(0, 14).forEach((row, index) => {
        const item = row as Record<string, unknown>
        const title = str(item.title, 300)
        if (!title) return
        const code = str(item.requirement_code, 12)
        const requirement = code ? requirements.find((r) => String(r.code) === code) : undefined
        const findingIndex = Number(item.finding_index)
        const finding = Number.isInteger(findingIndex) ? findings[findingIndex] : undefined
        inserts.push({
          session_id: sessionId,
          title,
          why_it_matters: str(item.why_it_matters, 700),
          requirement_id: requirement ? String(requirement.requirement_id) : null,
          finding_id: finding ? String(finding.id) : null,
          recommended_source: str(item.recommended_source, 400),
          priority: oneOf(item.priority, IMPORTANCE, 'medium'),
          order_index: index,
          engine: 'gemini',
        })
      })
      if (inserts.length > 0) {
        const { error } = await db.from('checklist_items').insert(inserts)
        if (!error) {
          created = inserts.length
          usedEngine = 'gemini'
        }
      }
    }
    if (created === 0) note = 'Gemini checklist generation failed; a rule-based checklist was built from findings.'
  }

  if (created === 0) {
    const inserts = buildHeuristicChecklist(findings, requirements ?? []).map((item) => ({ session_id: sessionId, ...item }))
    if (inserts.length > 0) {
      const { error } = await db.from('checklist_items').insert(inserts)
      if (!error) created = inserts.length
    }
  }

  await db
    .from('research_sessions')
    .update({ status: 'ready', analysis_engine: usedEngine, analysis_error: note || null })
    .eq('id', sessionId)

  return {
    stage: 'checklist',
    engine: usedEngine,
    message: `${created} verification item(s) created.`,
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Backend credentials are not configured.' }, 500)

  let body: { session_id?: string; stage?: string; batch_size?: number }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }

  const sessionId = body.session_id
  const stage = body.stage ?? 'full'
  if (!sessionId) return json({ error: 'session_id is required.' }, 400)
  if (!['requirements', 'evidence', 'findings', 'checklist', 'full'].includes(stage)) {
    return json({ error: `Unknown stage “${stage}”.` }, 400)
  }

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })
  const { data: session, error: sessionError } = await db
    .from('research_sessions')
    .select('*')
    .eq('id', sessionId)
    .maybeSingle()
  if (sessionError) return json({ error: sessionError.message }, 500)
  if (!session) return json({ error: 'Research session not found.' }, 404)

  const started = Date.now()
  const { data: job } = await db
    .from('analysis_jobs')
    .insert({
      session_id: sessionId,
      stage,
      status: 'running',
      progress: 10,
      message: `Running ${stage} analysis`,
      engine: Deno.env.get('GEMINI_API_KEY') ? 'gemini' : 'heuristic',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single()

  const ctx: StageContext = { db, sessionId, deadline: started + TIME_BUDGET_MS }

  try {
    await db.from('research_sessions').update({ status: 'analysing' }).eq('id', sessionId)

    let result: Record<string, unknown>
    const batchSize = Math.min(4, Math.max(1, Number(body.batch_size) || 2))

    if (stage === 'requirements') result = await stageRequirements(db, session)
    else if (stage === 'evidence') result = await stageEvidence(ctx, batchSize)
    else if (stage === 'findings') result = await stageFindings(ctx)
    else if (stage === 'checklist') result = await stageChecklist(ctx)
    else {
      // "full" runs one bounded pass and reports what remains.
      const requirements = await stageRequirements(db, session)
      const evidenceResult = await stageEvidence(ctx, batchSize)
      let findingsResult: Record<string, unknown> | null = null
      let checklistResult: Record<string, unknown> | null = null
      const remaining = Number(evidenceResult.remaining ?? 0)
      if (remaining === 0) {
        findingsResult = await stageFindings(ctx)
        checklistResult = await stageChecklist(ctx)
      }
      result = {
        stage: 'full',
        engine: evidenceResult.engine ?? requirements.engine,
        requirements: requirements.message,
        evidence: evidenceResult.message,
        findings: findingsResult?.message ?? null,
        checklist: checklistResult?.message ?? null,
        remaining,
        message:
          remaining === 0
            ? 'Full analysis completed.'
            : `Evidence mapping is incomplete; ${remaining} source(s) remain. Call again with stage=evidence.`,
      }
    }

    if (job?.id) {
      await db
        .from('analysis_jobs')
        .update({
          status: 'succeeded',
          progress: 100,
          message: String(result.message ?? 'Done'),
          engine: (result.engine as string) ?? null,
          finished_at: new Date().toISOString(),
        })
        .eq('id', job.id)
    }

    return json({ status: 'succeeded', ...result })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (job?.id) {
      await db
        .from('analysis_jobs')
        .update({ status: 'failed', error: message.slice(0, 900), message: message.slice(0, 400), finished_at: new Date().toISOString() })
        .eq('id', job.id)
    }
    await db
      .from('research_sessions')
      .update({ analysis_error: message.slice(0, 900) })
      .eq('id', sessionId)
    return json({ error: message }, 500)
  }
})
