#!/usr/bin/env node
/**
 * End-to-end smoke test — Digital Dark Spot
 *
 * Walks the real user journey against the real backend: create a session, add a
 * source, extract it, run every analysis stage, read the derived statuses, tick a
 * checklist item, then read it back to prove persistence.
 *
 * Nothing here is stubbed. If a step fails, it prints the backend's own error.
 *
 *   node scripts/smoke-test.mjs                       # uses .env
 *   node scripts/smoke-test.mjs --url https://…       # source to ingest
 *   node scripts/smoke-test.mjs --keep                # do not delete the session
 *
 * Requires VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (read from the
 * environment or .env). The anon key is enough: RLS allows a session with no
 * owner, and Edge Functions verify the JWT.
 *
 * Exit code 0 = every probe passed, 1 = at least one failed.
 */
import { readFileSync, existsSync } from 'node:fs'

// ----------------------------------------------------------------- env
function loadEnv() {
  const file = existsSync('.env') ? readFileSync('.env', 'utf8') : ''
  const fromFile = {}
  for (const line of file.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m) fromFile[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
  return { ...fromFile, ...process.env }
}

const env = loadEnv()
const BASE = (process.env.SUPABASE_URL ?? env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '')
const KEY = process.env.SUPABASE_ANON_KEY ?? env.VITE_SUPABASE_PUBLISHABLE_KEY ?? ''

const args = process.argv.slice(2)
const keep = args.includes('--keep')
const urlIndex = args.indexOf('--url')
const SOURCE_URL = urlIndex >= 0 ? args[urlIndex + 1] : 'https://www.education.gov.in/scholarships-education-loan'

if (!BASE || !KEY) {
  console.error('Missing configuration: set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.')
  process.exit(1)
}

const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }
const results = []

function record(step, ok, detail) {
  results.push({ step, ok, detail })
  const mark = ok === null ? '–' : ok ? '✓' : '✗'
  console.log(`  ${mark} ${step}${detail ? ` — ${detail}` : ''}`)
}

async function rest(path, init = {}) {
  const res = await fetch(`${BASE}/rest/v1/${path}`, { ...init, headers: { ...HEADERS, ...(init.headers ?? {}) } })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${typeof body === 'string' ? body : JSON.stringify(body)}`.slice(0, 400))
  return body
}

async function fn(name, payload) {
  const res = await fetch(`${BASE}/functions/v1/${name}`, {
    method: 'POST',
    headers: HEADERS,
    body: JSON.stringify(payload),
  })
  const text = await res.text()
  let body = null
  try {
    body = text ? JSON.parse(text) : null
  } catch {
    body = text
  }
  if (!res.ok) {
    const message = (body && (body.error || body.message)) || (typeof body === 'string' ? body : 'unknown error')
    throw new Error(`${name}: ${String(message).slice(0, 300)}`)
  }
  return body
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19)

let sessionId = null

async function main() {
  console.log(`\nDigital Dark Spot — end-to-end smoke test\n  backend ${BASE}\n`)

  // 1 — capabilities -------------------------------------------------------
  try {
    const health = await fn('system-status', {})
    record(
      'system-status answers',
      Boolean(health),
      `gemini=${health?.gemini_configured ? 'configured' : 'NOT configured'} extraction=${
        health?.extraction_service_configured ? (health?.extraction_service_reachable ? 'reachable' : 'unreachable') : 'NOT configured'
      }`,
    )
  } catch (error) {
    record('system-status answers', false, error.message)
  }

  // 2 — create the session -------------------------------------------------
  try {
    const rows = await rest('research_sessions', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        title: `Smoke test ${stamp}`,
        question:
          'What should a student verify before relying on published information about the Central Sector Scheme of Scholarships for the target academic year?',
        context: 'Automated end-to-end check. This session is safe to delete.',
        target_cycle: 'AY 2026–27',
        domain: 'Smoke test',
        status: 'collecting',
      }),
    })
    sessionId = Array.isArray(rows) ? rows[0]?.id : null
    record('session created in Postgres', Boolean(sessionId), sessionId ?? 'no id returned')
  } catch (error) {
    record('session created in Postgres', false, error.message)
    report()
    return
  }

  // 3 — add a source -------------------------------------------------------
  let sourceId = null
  try {
    const rows = await rest('sources', {
      method: 'POST',
      headers: { Prefer: 'return=representation' },
      body: JSON.stringify({
        session_id: sessionId,
        kind: 'url',
        title: 'Smoke test source',
        url: SOURCE_URL,
        domain: new URL(SOURCE_URL).hostname,
        source_type: 'government_page',
        status: 'waiting',
      }),
    })
    sourceId = Array.isArray(rows) ? rows[0]?.id : null
    record('source added', Boolean(sourceId), SOURCE_URL)
  } catch (error) {
    record('source added', false, error.message)
  }

  // 4 — extraction ---------------------------------------------------------
  if (sourceId) {
    try {
      const result = await fn('extract-source', { source_id: sourceId, mode: 'fetch' })
      const [source] = await rest(`sources?id=eq.${sourceId}&select=status,char_count,extractor,extraction_notes,error_message`)
      record(
        'source extracted',
        source?.status === 'extracted' || source?.status === 'partial',
        `status=${source?.status} chars=${source?.char_count} extractor=${source?.extractor}${
          source?.error_message ? ` error=${source.error_message}` : ''
        }`,
      )
      record('extraction message', true, String(result?.message ?? '').slice(0, 160))
    } catch (error) {
      record('source extracted', false, error.message)
    }
  }

  // 5 — requirements -------------------------------------------------------
  try {
    const result = await fn('analyse', { session_id: sessionId, stage: 'requirements' })
    const reqs = await rest(`requirements?session_id=eq.${sessionId}&select=code,description,importance`)
    record('requirements generated', reqs.length > 0, `${reqs.length} requirement(s), engine=${result?.engine ?? '?'}`)
  } catch (error) {
    record('requirements generated', false, error.message)
  }

  // 6 — evidence mapping (bounded, resumable) ------------------------------
  try {
    let rounds = 0
    let remaining = 1
    let last = null
    while (remaining > 0 && rounds < 8) {
      last = await fn('analyse', { session_id: sessionId, stage: 'evidence', batch_size: 4 })
      remaining = Number(last?.remaining ?? 0)
      rounds += 1
      if (remaining > 0) await sleep(500)
    }
    const evidence = await rest(`evidence_items?session_id=eq.${sessionId}&select=id`)
    record('evidence extracted and mapped', evidence.length > 0, `${evidence.length} claim(s) after ${rounds} batch(es)`)
    if (last?.message) record('evidence stage message', true, String(last.message).slice(0, 160))
  } catch (error) {
    record('evidence extracted and mapped', false, error.message)
  }

  // 7 — findings -----------------------------------------------------------
  try {
    const result = await fn('analyse', { session_id: sessionId, stage: 'findings' })
    const findings = await rest(`findings?session_id=eq.${sessionId}&select=kind,title`)
    const kinds = findings.reduce((acc, f) => ({ ...acc, [f.kind]: (acc[f.kind] ?? 0) + 1 }), {})
    record('findings generated', findings.length > 0, JSON.stringify(kinds))
    record('findings message', true, String(result?.message ?? '').slice(0, 160))
  } catch (error) {
    record('findings generated', false, error.message)
  }

  // 8 — checklist ----------------------------------------------------------
  let checklistId = null
  try {
    await fn('analyse', { session_id: sessionId, stage: 'checklist' })
    const items = await rest(`checklist_items?session_id=eq.${sessionId}&select=id,title,priority,completed&order=order_index`)
    checklistId = items[0]?.id ?? null
    record('checklist generated', items.length > 0, `${items.length} item(s), first priority=${items[0]?.priority ?? '?'}`)
  } catch (error) {
    record('checklist generated', false, error.message)
  }

  // 9 — persistence of a user action --------------------------------------
  if (checklistId) {
    try {
      await rest(`checklist_items?id=eq.${checklistId}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ completed: true, completed_at: new Date().toISOString() }),
      })
      const [row] = await rest(`checklist_items?id=eq.${checklistId}&select=completed`)
      record('checklist completion persists', row?.completed === true, `completed=${row?.completed}`)
    } catch (error) {
      record('checklist completion persists', false, error.message)
    }
  }

  // 10 — derived statuses --------------------------------------------------
  try {
    const rows = await rest(`v_requirement_status?session_id=eq.${sessionId}&select=code,status,needs_verification`)
    const byStatus = rows.reduce((acc, r) => ({ ...acc, [r.status]: (acc[r.status] ?? 0) + 1 }), {})
    record('requirement status derived', rows.length > 0, JSON.stringify(byStatus))
    const claims = await rest(`v_claims?session_id=eq.${sessionId}&select=claim_id,quote_verified&limit=200`)
    record('claims projection available', Array.isArray(claims), `${claims.length} claim row(s)`)
  } catch (error) {
    record('requirement status derived', false, error.message)
  }

  // 11 — cleanup -----------------------------------------------------------
  if (sessionId && !keep) {
    try {
      await rest(`research_sessions?id=eq.${sessionId}`, { method: 'DELETE' })
      const check = await rest(`research_sessions?id=eq.${sessionId}&select=id`)
      record('temporary session deleted', check.length === 0, check.length === 0 ? 'gone' : 'still present')
    } catch (error) {
      record(
        'temporary session deleted',
        null,
        `skipped — RLS only lets an owner delete (${error.message.slice(0, 90)}). Delete it from Research history.`,
      )
    }
  }

  report()
}

function report() {
  const failed = results.filter((r) => r.ok === false)
  const skipped = results.filter((r) => r.ok === null)
  console.log(
    `\n${results.filter((r) => r.ok === true).length} passed, ${failed.length} failed${
      skipped.length ? `, ${skipped.length} skipped` : ''
    }\n`,
  )
  if (failed.length) {
    console.log('Failures:')
    for (const f of failed) console.log(`  · ${f.step}: ${f.detail}`)
    console.log('')
  }
  process.exit(failed.length ? 1 : 0)
}

main().catch((error) => {
  console.error('\nUnexpected failure:', error.message)
  report()
})
