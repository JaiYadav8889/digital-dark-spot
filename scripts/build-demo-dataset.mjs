#!/usr/bin/env node
/**
 * Build the demonstration dataset from the uploaded documents.
 *
 * This is a real pipeline run, not a fixture. It:
 *
 *   1. hashes each uploaded file and refuses duplicates,
 *   2. extracts page text with the extraction service's own PyMuPDF code
 *      (`api/extract.py::_extract_pdf`, invoked through scripts/extract_pdf.py),
 *   3. chunks it with the shipped `chunkPages()` from the extract-source function,
 *   4. decomposes the research question with the shipped `heuristicRequirements()`,
 *   5. maps evidence with the shipped `buildHeuristicEvidence()`,
 *   6. examines dates and academic cycles with the shipped `examineCycles()`,
 *   7. derives requirement status with the app's own `deriveStatus()`,
 *   8. builds findings and the checklist with the shipped pure builders.
 *
 * Nothing about the expected outcome is written into this file: the gaps,
 * conflicts and outdated signals below are whatever those functions produce from
 * the extracted text. If a document said nothing, the output says nothing.
 *
 * Output: an idempotent SQL file (supabase/seed/csss_source_driven.sql) plus a
 * machine-readable summary (demo/build-summary.json) that records what each
 * stage produced.
 *
 *   node scripts/build-demo-dataset.mjs
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { loadAnalysisHelpers, loadAppStatus, loadExtractUtils } from './lib/load-shipped.mjs'

const SESSION_ID = '00000000-0000-4000-8000-000000000001'
const manifest = JSON.parse(readFileSync('demo/manifest.json', 'utf8'))

// Deterministic, readable UUIDs per entity class so the seed is idempotent.
const id = (prefix, n) => `00000000-0000-4000-8000-${String(prefix).padStart(4, '0').slice(-4)}${String(n).padStart(8, '0')}`


/** Minimal CSV field reader (handles quoted commas and doubled quotes). */
function parseCsvLine(line) {
  const cells = []
  let current = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"'
        i += 1
      } else if (ch === '"') {
        quoted = false
      } else {
        current += ch
      }
    } else if (ch === '"') {
      quoted = true
    } else if (ch === ',') {
      cells.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current)
  return cells.map((c) => c.trim())
}

/** Category drives whether a passage can be called outdated for the target cycle. */
function categoryForTitle(title) {
  const t = title.toLowerCase()
  if (/deadline|date|timing|valid|current/.test(t)) return 'timing'
  if (/amount|limit|seats|reservation|figure|percentile/.test(t)) return 'figures'
  if (/document/.test(t)) return 'documents'
  if (/procedure|process|verification|change of/.test(t)) return 'process'
  if (/renewal|continuation/.test(t)) return 'continuation'
  if (/eligib|income|other scholarship|course/.test(t)) return 'eligibility'
  return 'general'
}

function importanceForTitle(title) {
  const t = title.toLowerCase()
  if (/deadline|valid|eligib|income|document/.test(t)) return 'high'
  if (/amount|renewal|procedure|verification/.test(t)) return 'medium'
  return 'low'
}

const summary = { generated_at: new Date().toISOString(), requirement_source: process.argv.includes('--generate-requirements') ? 'generated' : 'inventory', engine: 'heuristic', sources: [], requirements: [], evidence: [], findings: [], checklist: [], skipped: [] }

const main = async () => {
  const { chunkPages } = await loadExtractUtils()
  const { heuristicRequirements, buildHeuristicEvidence, buildHeuristicFindings, buildHeuristicChecklist, examineCycles, applyCycleSignals } =
    await loadAnalysisHelpers()
  const { deriveStatus } = await loadAppStatus()

  // ---------------------------------------------------------------- 1 + 2 + 3
  const seenHashes = new Map()
  const sources = []

  for (const entry of manifest.sources) {
    const bytes = readFileSync(entry.file)
    const sha = createHash('sha256').update(bytes).digest('hex')

    if (seenHashes.has(sha)) {
      summary.skipped.push({ file: entry.file, reason: 'duplicate-content', same_as: seenHashes.get(sha) })
      console.log(`  skip (duplicate of ${seenHashes.get(sha)}): ${entry.file}`)
      continue
    }
    seenHashes.set(sha, entry.file)

    const extracted = JSON.parse(
      execFileSync('python3', ['scripts/extract_pdf.py', entry.file], { maxBuffer: 64 * 1024 * 1024 }).toString(),
    )
    if (!extracted.ok) {
      summary.skipped.push({ file: entry.file, reason: 'extraction-failed', error: extracted.error })
      console.log(`  FAILED extraction: ${entry.file}: ${extracted.error}`)
      continue
    }

    const pages = extracted.pages.map((p) => ({ page: p.page, text: p.text }))
    const chunks = chunkPages(pages)
    const usable = pages.reduce((n, p) => n + p.text.trim().length, 0)

    sources.push({
      entry,
      sha,
      pages,
      chunks,
      bytes: bytes.length,
      charCount: usable,
      pageCount: extracted.pageCount ?? pages.length,
      extractor: extracted.extractor,
      status: usable === 0 ? 'failed' : chunks.length === 0 ? 'partial' : 'extracted',
    })
    console.log(
      `  ${entry.original_name}: ${extracted.pageCount} pages, ${chunks.length} chunks, ${usable} chars, extractor=${extracted.extractor}`,
    )
  }

  if (sources.length === 0) throw new Error('No source could be processed; refusing to write an empty demo dataset.')

  // ---------------------------------------------------------------------- 4
  // Requirement decomposition.
  //
  // Two modes. `inventory` reuses the requirement list the researcher already
  // wrote in the Phase 1 inventory CSV — ONLY its requirement id and title; the
  // file's `relation`, `claim_paraphrase` and `verification_status` columns are
  // never read, so no expected answer can leak into the analysis. `generated`
  // decomposes the question with the shipped heuristic generator.
  const requirementMode = process.argv.includes('--generate-requirements') ? 'generated' : 'inventory'
  let requirementDrafts
  if (requirementMode === 'inventory') {
    const csv = readFileSync('demo/inventory/evidence_claim_requirement_map.csv', 'utf8')
    const byCode = new Map()
    for (const line of csv.split('\n').slice(1)) {
      if (!line.trim()) continue
      const cells = parseCsvLine(line)
      // Columns: evidence_id, requirement_id, requirement, …
      const [, requirementId, requirementTitle] = cells
      if (!requirementId || !requirementTitle || byCode.has(requirementId)) continue
      byCode.set(requirementId, { code: requirementId, title: requirementTitle })
    }
    requirementDrafts = [...byCode.values()].map((r, index) => ({
      code: r.code,
      description: r.title,
      category: categoryForTitle(r.title),
      importance: importanceForTitle(r.title),
      why_it_matters: `Named by the researcher as a requirement for this objective; the analysis has to establish it from the reviewed documents.`,
      expected_evidence: `A statement in the reviewed documents that settles “${r.title}” for ${manifest.session.target_cycle}.`,
      order_index: index,
    }))
    console.log(`  requirements: ${requirementDrafts.length} supplied by the researcher (inventory titles only)`)
  } else {
    requirementDrafts = heuristicRequirements(manifest.session.question, manifest.session.target_cycle)
    console.log(`  requirements: ${requirementDrafts.length} generated from the question (heuristic)`)
  }
  const requirements = requirementDrafts.map((draft, index) => ({
    ...draft,
    id: id(101, index + 1),
    order_index: index,
  }))
  summary.requirements = requirements.map((r) => ({ code: r.code, description: r.description, category: r.category, importance: r.importance }))

  // ---------------------------------------------------------------------- 5
  const chunkRows = []
  for (const [sIndex, source] of sources.entries()) {
    const sourceId = id(11, sIndex + 1)
    for (const chunk of source.chunks) {
      chunkRows.push({
        id: `00000000-0000-4000-8000-${String(2000 + sIndex * 100 + chunk.index).padStart(12, '0')}`,
        source_id: sourceId,
        chunk_index: chunk.index,
        content: chunk.content,
        char_count: chunk.content.length,
        page_from: chunk.pageFrom,
        page_to: chunk.pageTo,
      })
    }
  }

  const requirementRows = requirements.map((r) => ({
    id: r.id,
    code: r.code,
    description: r.description,
    importance: r.importance,
    expected_evidence: r.expected_evidence,
    category: r.category,
  }))

  const evidenceDrafts = buildHeuristicEvidence(chunkRows, requirementRows)

  // ---------------------------------------------------------------------- 6
  const linksByChunk = new Map()
  for (const draft of evidenceDrafts) linksByChunk.set(draft.chunk_id, draft.links.map((l) => l.requirement_id))
  const categoryByRequirement = new Map(requirementRows.map((r) => [r.id, r.category ?? '']))
  const signals = examineCycles(
    chunkRows.map((c) => ({ id: c.id, content: c.content, page_from: c.page_from, source_id: c.source_id })),
    linksByChunk,
    categoryByRequirement,
    manifest.session.target_cycle,
  )
  const evidence = applyCycleSignals(evidenceDrafts, signals)
  console.log(`  evidence rows: ${evidence.length}; cycle signals: ${signals.length} (${signals.map((s) => s.kind).join(', ') || 'none'})`)

  // ---------------------------------------------------------------------- 7
  // Status is derived exactly as v_requirement_status does, from the links the
  // pipeline just produced — never from an expected answer.
  const counts = new Map(
    requirements.map((r) => [r.id, { supports: new Set(), partial: new Set(), conflicts: new Set(), outdated: new Set() }]),
  )
  for (const item of evidence) {
    for (const link of item.links) {
      const bucket = counts.get(link.requirement_id)
      if (!bucket) continue
      if (link.relation === 'SUPPORTS') bucket.supports.add(item.chunk_id)
      if (link.relation === 'PARTIAL') bucket.partial.add(item.chunk_id)
      if (link.relation === 'CONFLICTS') bucket.conflicts.add(item.chunk_id)
      if (link.relation === 'OUTDATED') bucket.outdated.add(item.chunk_id)
    }
  }
  const statusRows = requirements.map((r) => {
    const c = counts.get(r.id)
    const status = deriveStatus({
      supports: c.supports.size,
      partial: c.partial.size,
      conflicts: c.conflicts.size,
      outdated: c.outdated.size,
    })
    return { requirement_id: r.id, code: r.code, description: r.description, importance: r.importance, status, ...c }
  })
  summary.requirements = statusRows.map((r) => ({ code: r.code, description: r.description, status: r.status }))

  // ---------------------------------------------------------------------- 8
  const sourceById = new Map(sources.map((s, i) => [id(11, i + 1), { title: s.entry.title }]))
  const evidenceByChunk = new Map()
  evidence.forEach((item, index) => {
    evidenceByChunk.set(item.chunk_id, {
      id: id(201, index + 1),
      ...item,
      evidence_links: item.links.map((l) => ({ requirement_id: l.requirement_id, relation: l.relation })),
    })
  })
  const findingsInput = statusRows.map((r) => ({ ...r, id: r.requirement_id }))
  const findingDrafts = buildHeuristicFindings(findingsInput, [...evidenceByChunk.values()], sourceById)
  summary.findings = findingDrafts.map((d) => ({ kind: d.finding.kind, title: d.finding.title, links: d.links.length }))
  console.log(`  findings: ${findingDrafts.length}`)

  const findingRows = findingDrafts.map((draft, index) => ({ id: id(301, index + 1), ...draft }))
  const checklistDrafts = buildHeuristicChecklist(
    findingRows.map((f) => ({ ...f.finding, id: f.id })),
    statusRows.map((r) => ({ ...r, id: r.requirement_id, needs_verification: r.status !== 'found' })),
  )
  summary.checklist = checklistDrafts.map((c) => ({ title: c.title, priority: c.priority, finding_id: c.finding_id }))
  console.log(`  checklist items: ${checklistDrafts.length}`)

  // ---------------------------------------------------------------------- SQL
  const q = (value) => {
    if (value === null || value === undefined) return 'null'
    if (typeof value === 'number') return String(value)
    return `'${String(value).replace(/'/g, "''")}'`
  }

  const lines = []
  lines.push('-- =============================================================================')
  lines.push('-- CSSS demonstration dataset — GENERATED, do not hand-edit.')
  lines.push('--')
  lines.push('-- Produced by: node scripts/build-demo-dataset.mjs')
  lines.push(`-- Generated at: ${summary.generated_at}`)
  lines.push('--')
  lines.push('-- Every page of text, chunk boundary, excerpt, requirement status, finding and')
  lines.push('-- checklist item below was computed from the uploaded PDFs by the project\'s own')
  lines.push('-- extraction and analysis code. No expected finding is written into this file.')
  lines.push('-- Regenerate rather than edit.')
  lines.push('-- =============================================================================')
  lines.push('')
  lines.push(`delete from public.research_sessions where id = '${SESSION_ID}';`)
  lines.push('')
  lines.push('insert into public.research_sessions')
  lines.push('  (id, title, question, context, target_cycle, domain, status, analysis_engine, analysis_error, owner_id, is_demo, last_analysed_at, analysis_meta, created_at, updated_at)')
  lines.push('values (')
  lines.push(`  '${SESSION_ID}',`)
  lines.push(`  ${q(manifest.session.title)},`)
  lines.push(`  ${q(manifest.session.question)},`)
  lines.push(`  ${q(manifest.session.context)},`)
  lines.push(`  ${q(manifest.session.target_cycle)},`)
  lines.push(`  ${q(manifest.session.domain)},`)
  lines.push(`  'ready', 'heuristic',`)
  lines.push(`  ${q('Analysis ran on the uploaded documents with the heuristic engine: GEMINI_API_KEY is not configured, so no model call was made. Findings are rule-based signals from the extracted text, not AI conclusions.')},`)
  lines.push('  null, true, now(),')
  lines.push(`  '{"dataset":"source-driven","source_files":${sources.length},"generated_by":"scripts/build-demo-dataset.mjs"}'::jsonb,`)
  lines.push("  now(), now()")
  lines.push(');')
  lines.push('')

  lines.push('-- ------------------------------------------------------------------ sources (from the uploads)')
  lines.push('insert into public.sources')
  lines.push('  (id, session_id, kind, title, url, domain, issuer, source_type, storage_path, document_path, file_name, file_size, mime_type, page_count, published_date, updated_date, retrieved_at, status, extractor, extraction_notes, error_message, char_count, created_at, updated_at)')
  lines.push('values')
  const sourceValues = sources.map((source, index) => {
    const e = source.entry
    const notes = [
      e.provenance,
      `Original filename: ${e.original_name}.`,
      `Content hash (sha256): ${source.sha}.`,
      e.url_note,
    ].join(' ')
    return `  (${[
      q(id(11, index + 1)),
      q(SESSION_ID),
      q('pdf'),
      q(e.title),
      q(e.url),
      q('uploaded document'),
      q(e.issuer),
      q(e.source_type),
      'null',
      q(e.document_path),
      q(e.original_name),
      source.bytes,
      q('application/pdf'),
      source.pageCount,
      q(e.published_date),
      'null',
      'now()',
      q(source.status),
      q(source.extractor),
      q(notes),
      'null',
      source.charCount,
      'now()',
      'now()',
    ].join(', ')})`
  })
  lines.push(sourceValues.join(',\n') + ';')
  lines.push('')

  lines.push('-- ------------------------------------------------------------------ chunks (page-preserving)')
  lines.push('insert into public.source_chunks (id, source_id, session_id, chunk_index, content, char_count, page_from, page_to, created_at)')
  lines.push('values')
  lines.push(
    chunkRows
      .map(
        (c) =>
          `  (${q(c.id)}, ${q(c.source_id)}, ${q(SESSION_ID)}, ${c.chunk_index}, ${q(c.content)}, ${c.char_count}, ${c.page_from ?? 'null'}, ${c.page_to ?? 'null'}, now())`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  lines.push('-- ------------------------------------------------------------------ requirements')
  lines.push('insert into public.requirements (id, session_id, code, description, category, importance, why_it_matters, expected_evidence, order_index, engine, created_at)')
  lines.push('values')
  lines.push(
    requirements
      .map(
        (r) =>
          `  (${q(r.id)}, ${q(SESSION_ID)}, ${q(r.code)}, ${q(r.description)}, ${q(r.category)}, ${q(r.importance)}, ${q(r.why_it_matters)}, ${q(r.expected_evidence)}, ${r.order_index}, 'heuristic', now())`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  lines.push('-- ------------------------------------------------------------------ evidence (excerpts from the PDFs)')
  lines.push('insert into public.evidence_items (id, session_id, source_id, chunk_id, claim_text, summary, context_note, page_number, quote_verified, locator, engine, created_at)')
  lines.push('values')
  const chunkById = new Map(chunkRows.map((c) => [c.id, c]))
  lines.push(
    evidence
      .map((item, index) => {
        const chunk = chunkById.get(item.chunk_id)
        return `  (${q(id(201, index + 1))}, ${q(SESSION_ID)}, ${q(chunk.source_id)}, ${q(item.chunk_id)}, ${q(item.claim_text)}, null, ${q(item.context_note)}, ${item.page_number ?? 'null'}, ${item.quote_verified}, ${q(item.locator)}, 'heuristic', now())`
      })
      .join(',\n') + ';',
  )
  lines.push('')

  lines.push('-- ------------------------------------------------------------------ evidence links')
  lines.push('insert into public.evidence_links (session_id, evidence_id, requirement_id, relation, rationale, confidence, engine, created_at)')
  lines.push('values')
  const linkRows = []
  evidence.forEach((item, index) => {
    for (const link of item.links) {
      linkRows.push(
        `  (${q(SESSION_ID)}, ${q(id(201, index + 1))}, ${q(link.requirement_id)}, ${q(link.relation)}, ${q(link.rationale)}, ${link.confidence}, 'heuristic', now())`,
      )
    }
  })
  lines.push(linkRows.join(',\n') + ';')
  lines.push('')

  lines.push('-- ------------------------------------------------------------------ findings')
  lines.push('insert into public.findings (id, session_id, kind, title, summary, severity, requirement_id, recommended_verification, status, confidence, engine, created_at)')
  lines.push('values')
  lines.push(
    findingRows
      .map(
        (f) =>
          `  (${q(f.id)}, ${q(SESSION_ID)}, ${q(f.finding.kind)}, ${q(f.finding.title)}, ${q(f.finding.summary)}, ${q(f.finding.severity)}, ${q(f.finding.requirement_id)}, ${q(f.finding.recommended_verification)}, 'open', 0.4, 'heuristic', now())`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  const findingLinks = []
  findingRows.forEach((f) => {
    for (const link of f.links) {
      findingLinks.push(`  (${q(f.id)}, ${q(link.evidence_id)}, ${q(link.role)}, ${q(link.note)})`)
    }
  })
  if (findingLinks.length > 0) {
    lines.push('insert into public.finding_evidence (finding_id, evidence_id, role, note)')
    lines.push('values')
    lines.push(findingLinks.join(',\n') + ';')
    lines.push('')
  }

  lines.push('-- ------------------------------------------------------------------ verification checklist')
  lines.push('insert into public.checklist_items (session_id, title, why_it_matters, requirement_id, finding_id, recommended_source, priority, completed, order_index, engine)')
  lines.push('values')
  lines.push(
    checklistDrafts
      .map(
        (c) =>
          `  (${q(SESSION_ID)}, ${q(c.title)}, ${q(c.why_it_matters)}, ${q(c.requirement_id)}, ${q(c.finding_id)}, ${q(c.recommended_source)}, ${q(c.priority)}, false, ${c.order_index}, 'heuristic')`,
      )
      .join(',\n') + ';',
  )
  lines.push('')

  lines.push('-- ------------------------------------------------------------------ job history')
  lines.push('insert into public.analysis_jobs (session_id, stage, status, progress, message, engine, started_at, finished_at, payload, created_at)')
  lines.push('values')
  lines.push(
    [
      `  (${q(SESSION_ID)}, 'extraction', 'succeeded', 100, ${q(`Extracted ${sources.length} uploaded document(s) with PyMuPDF, ${sources.reduce((n, s) => n + s.chunks.length, 0)} page-preserving chunks.`)}, 'heuristic', now(), now(), ${q(JSON.stringify({ documents: sources.length, chunks: chunkRows.length }))}::jsonb, now())`,
      `  (${q(SESSION_ID)}, 'requirements', 'succeeded', 100, ${q(`${requirements.length} requirement(s) taken from the researcher's objective checklist (titles only, no expected answer) — heuristic engine, no model call.`)}, 'heuristic', now(), now(), ${q(JSON.stringify({ requirements: requirements.length, source: requirementMode }))}::jsonb, now())`,
      `  (${q(SESSION_ID)}, 'evidence', 'succeeded', 100, ${q(`${evidence.length} excerpt(s) mapped to requirements across ${sources.length} source(s).`)}, 'heuristic', now(), now(), ${q(JSON.stringify({ evidence: evidence.length }))}::jsonb, now())`,
      `  (${q(SESSION_ID)}, 'findings', 'succeeded', 100, ${q(`${findingRows.length} finding(s) derived from requirement status.`)}, 'heuristic', now(), now(), ${q(JSON.stringify({ findings: findingRows.length }))}::jsonb, now())`,
      `  (${q(SESSION_ID)}, 'checklist', 'succeeded', 100, ${q(`${checklistDrafts.length} verification item(s) created.`)}, 'heuristic', now(), now(), ${q(JSON.stringify({ items: checklistDrafts.length }))}::jsonb, now())`,
    ].join(',\n') + ';',
  )
  lines.push('')

  mkdirSync('demo', { recursive: true })
  writeFileSync('supabase/seed/csss_source_driven.sql', lines.join('\n'))
  summary.totals = {
    sources: sources.length,
    chunks: chunkRows.length,
    requirements: requirements.length,
    evidence: evidence.length,
    links: linkRows.length,
    findings: findingRows.length,
    checklist: checklistDrafts.length,
  }
  summary.status_counts = statusRows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
  writeFileSync('demo/build-summary.json', JSON.stringify(summary, null, 2))

  console.log('\n  totals:', JSON.stringify(summary.totals))
  console.log('  requirement statuses:', JSON.stringify(summary.status_counts))
  console.log('  wrote supabase/seed/csss_source_driven.sql and demo/build-summary.json\n')
}

main().catch((error) => {
  console.error('\nBuild failed:', error.message)
  process.exit(1)
})
