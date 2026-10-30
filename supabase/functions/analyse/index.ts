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
}

interface HeuristicLink {
  chunk: ChunkRow
  requirement: RequirementRow
  relation: 'SUPPORTS' | 'PARTIAL'
  score: number
  excerpt: string
}

function scoreChunk(chunk: string, requirement: RequirementRow): { score: number; excerpt: string } {
  const requirementTokens = tokenize(`${requirement.description} ${requirement.expected_evidence ?? ''}`)
  const unique = Array.from(new Set(requirementTokens))
  const haystack = chunk.toLowerCase()
  let score = 0
  for (const token of unique) {
    if (haystack.includes(token)) score += token.length > 6 ? 2 : 1
  }
  const matching = sentences(chunk).filter((s) => {
    const lower = s.toLowerCase()
    return unique.some((t) => lower.includes(t))
  })
  const excerpt = (matching[0] ?? sentences(chunk)[0] ?? chunk.slice(0, 300)).slice(0, 600)
  return { score, excerpt }
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
    .select('id,code,description,importance,expected_evidence')
    .eq('session_id', sessionId)
    .order('order_index')
  if (requirementError) throw new Error(requirementError.message)
  const requirements = (requirementsData ?? []) as RequirementRow[]
  if (requirements.length === 0) throw new Error('Generate requirements before mapping evidence.')

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
  const linked: Array<{
    chunk: ChunkRow
    requirement: RequirementRow
    relation: 'SUPPORTS' | 'PARTIAL'
    score: number
    excerpt: string
  }> = []

  for (const requirement of requirements) {
    const scored = chunks
      .map((chunk) => {
        const { score, excerpt } = scoreChunk(chunk.content, requirement)
        return { chunk, requirement, score, excerpt }
      })
      .filter((s) => s.score >= 3)
      .sort((a, b) => b.score - a.score)
      .slice(0, 2)

    for (const s of scored) {
      linked.push({
        chunk: s.chunk,
        requirement: s.requirement,
        relation: s.score >= 8 ? 'SUPPORTS' : 'PARTIAL',
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

  for (const [, items] of byChunk) {
    const chunk = items[0].chunk
    const primary = items.sort((a, b) => b.score - a.score)[0]
    inserted.push({
      chunk_id: chunk.id,
      claim_text: primary.excerpt,
      summary: null,
      context_note:
        'Selected by lexical relevance scoring, not by semantic understanding. Verify that this passage actually addresses the requirement.',
      page_number: chunk.page_from,
      quote_verified: true,
      locator: `chunk ${chunk.chunk_index}`,
      links: items.slice(0, 5).map((item) => ({
        requirement_id: item.requirement.id,
        relation: item.relation,
        rationale: `Heuristic match: ${item.score} shared significant terms between the requirement and this passage.`,
        confidence: Math.min(0.55, 0.2 + item.score / 40),
      })),
    })
  }

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

async function heuristicFindings(
  db: SupabaseClient,
  sessionId: string,
  requirements: Array<Record<string, unknown>>,
  evidence: Array<Record<string, unknown>>,
  sourceById: Map<string, Record<string, unknown>>,
): Promise<number> {
  let created = 0

  const insertFinding = async (
    finding: Record<string, unknown>,
    links: Array<{ evidence_id: string; role: string; note?: string | null }> = [],
  ) => {
    const { data, error } = await db
      .from('findings')
      .insert({ session_id: sessionId, engine: 'heuristic', confidence: finding.confidence ?? 0.4, ...finding })
      .select('id')
      .single()
    if (error || !data) return
    created += 1
    for (const link of links) {
      await db.from('finding_evidence').insert({
        finding_id: data.id,
        evidence_id: link.evidence_id,
        role: link.role,
        note: link.note ?? null,
      })
    }
  }

  for (const requirement of requirements) {
    const status = String(requirement.status)
    const requirementId = String(requirement.requirement_id)
    const linkedEvidence = evidence.filter((e) =>
      asArray(e.evidence_links).some((l) => String((l as Record<string, unknown>).requirement_id) === requirementId),
    )

    if (status === 'not_found') {
      await insertFinding({
        kind: 'gap',
        title: `Not found in reviewed sources: ${String(requirement.description).slice(0, 180)}`,
        summary: `None of the excerpts reviewed addresses this requirement. This does not establish that the information is unavailable elsewhere — only that the sources reviewed here do not settle it.`,
        severity: requirement.importance === 'high' ? 'high' : 'medium',
        requirement_id: requirementId,
        recommended_verification:
          'Consult the authoritative publisher directly (the issuing ministry, department or agency) for the current cycle.',
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
      await insertFinding(
        {
          kind: 'conflict',
          title: `Sources appear inconsistent: ${String(requirement.description).slice(0, 150)}`,
          summary: `Two reviewed excerpts make different statements about this requirement. Dates, academic years and application stages may explain the difference; treat this as a possible inconsistency requiring verification rather than proof that either source is wrong.`,
          severity: 'high',
          requirement_id: requirementId,
          recommended_verification:
            'Compare the publication dates and scope of both sources, then confirm the current position with the issuing authority.',
        },
        [
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
      )
    }

    if (outdated.length > 0 && status !== 'found') {
      const first = outdated[0]
      await insertFinding(
        {
          kind: 'outdated',
          title: `May describe an earlier period: ${String(requirement.description).slice(0, 150)}`,
          summary: `The reviewed excerpt refers to an earlier cycle or a period that may have lapsed. Its current validity is unknown, so it should not be relied upon for the target cycle without confirmation.`,
          severity: requirement.importance === 'high' ? 'high' : 'medium',
          requirement_id: requirementId,
          recommended_verification: 'Confirm the current cycle and validity directly with the issuing authority.',
        },
        [{ evidence_id: String(first.id), role: 'context', note: null }],
      )
    }
  }

  return created
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
    const inserts: Array<Record<string, unknown>> = []
    findings.slice(0, 14).forEach((f, index) => {
      inserts.push({
        session_id: sessionId,
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
      })
    })

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
