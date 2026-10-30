#!/usr/bin/env node
/**
 * Benchmark runner — Digital Dark Spot
 *
 * Scores predicted requirement statuses against the authored cases in
 * benchmark/cases.jsonl and reports a confusion matrix.
 *
 * What this deliberately refuses to do
 * ------------------------------------
 *   * It will not print a headline accuracy figure unless every case it scored
 *     is "locked": two independent human reviews that agree on the expected
 *     result. Unreviewed cases are reported as diagnostics only.
 *   * It will not invent predictions. You must supply them (--predictions) or
 *     read them from a real analysed session (--session).
 *
 * Usage
 *   node scripts/benchmark.mjs --cases benchmark/cases.jsonl --predictions preds.json
 *   node scripts/benchmark.mjs --session 00000000-0000-4000-8000-000000000001
 *   node scripts/benchmark.mjs --self-check          # plumbing only, loudly labelled
 *
 * Predictions file shape:
 *   [{ "case_id": "A-01", "status": "not_found", "evidence_ids": ["…"] }]
 */
import { readFileSync } from 'node:fs'

const STATUSES = ['found', 'partial', 'conflicting', 'outdated', 'not_found']

function arg(name, fallback = null) {
  const i = process.argv.indexOf(`--${name}`)
  if (i === -1) return fallback
  const next = process.argv[i + 1]
  return next && !next.startsWith('--') ? next : true
}

function loadCases(path) {
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line, i) => {
      try {
        return JSON.parse(line)
      } catch (error) {
        console.error(`cases.jsonl line ${i + 1} is not valid JSON: ${error.message}`)
        process.exit(1)
      }
    })
}

function isLocked(c) {
  const reviews = Array.isArray(c.reviews) ? c.reviews : []
  if (reviews.length < 2) return false
  const statuses = new Set(reviews.map((r) => r.status))
  return statuses.size === 1 && statuses.has(c.expected_status)
}

/** Read requirement statuses straight out of a real analysed session. */
async function predictionsFromSession(sessionId) {
  const url = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY
  if (!url || !key) {
    console.error('SUPABASE_URL / anon key are not set; cannot read a live session.')
    process.exit(1)
  }
  const res = await fetch(
    `${url}/rest/v1/v_requirement_status?session_id=eq.${sessionId}&select=code,status,requirement_id`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  )
  if (!res.ok) {
    console.error(`Could not read the session (HTTP ${res.status}): ${await res.text()}`)
    process.exit(1)
  }
  const rows = await res.json()
  return rows.map((r) => ({ _code: r.code, status: r.status, requirement_id: r.requirement_id }))
}

function main() {
  const casesPath = arg('cases', 'benchmark/cases.jsonl')
  const selfCheck = arg('self-check', false) === true
  const sessionId = arg('session', null)
  const predictionsPath = arg('predictions', null)

  const cases = loadCases(casesPath)
  if (cases.length === 0) {
    console.error('No cases found.')
    process.exit(1)
  }

  let predictions = []
  let sourceLabel = ''

  if (selfCheck) {
    // Plumbing check: predict the expected label for every case. This proves the
    // loader, matcher and reporter work. It is NOT a benchmark result.
    predictions = cases.map((c) => ({ case_id: c.case_id, status: c.expected_status, _synthetic: true }))
    sourceLabel = 'SELF-CHECK (expected labels replayed — plumbing only)'
  } else if (sessionId) {
    sourceLabel = `live session ${sessionId}`
    // Session predictions are keyed by requirement code, so map them onto cases.
    const rowsPromise = predictionsFromSession(String(sessionId))
    return rowsPromise.then((rows) => {
      predictions = cases
        .map((c) => {
          const row = rows.find((r) => r._code === c.requirement_code)
          return row ? { case_id: c.case_id, status: row.status } : null
        })
        .filter(Boolean)
      finish(cases, predictions, sourceLabel, selfCheck)
    })
  } else if (predictionsPath) {
    sourceLabel = String(predictionsPath)
    predictions = JSON.parse(readFileSync(String(predictionsPath), 'utf8'))
  } else {
    console.error('Nothing to score. Pass --predictions, --session or --self-check.')
    process.exit(1)
  }

  finish(cases, predictions, sourceLabel, selfCheck)
}

function finish(cases, predictions, sourceLabel, selfCheck) {
  const byId = new Map(predictions.map((p) => [p.case_id, p]))

  const rows = cases.map((c) => {
    const predicted = byId.get(c.case_id)
    const expected = c.expected_status
    const got = predicted?.status ?? null
    const statusValid = got === null || STATUSES.includes(got)
    const evidenceExpected = new Set(c.expected_evidence_ids ?? [])
    const evidencePredicted = new Set(predicted?.evidence_ids ?? [])
    const evidenceOverlap = [...evidenceExpected].filter((id) => evidencePredicted.has(id)).length
    return {
      case_id: c.case_id,
      category: c.category,
      expected,
      predicted: got,
      valid: statusValid,
      correct: got !== null && got === expected,
      locked: isLocked(c),
      evidenceExpected: evidenceExpected.size,
      evidenceOverlap,
      synthetic: Boolean(c.synthetic),
    }
  })

  const scored = rows.filter((r) => r.predicted !== null)
  const covered = scored.length
  const correct = scored.filter((r) => r.correct).length
  const lockedScored = scored.filter((r) => r.locked)

  const matrix = {}
  for (const expected of STATUSES) {
    matrix[expected] = {}
    for (const got of STATUSES) matrix[expected][got] = 0
  }
  for (const r of scored) {
    if (!matrix[r.expected]) continue
    matrix[r.expected][r.predicted] = (matrix[r.expected][r.predicted] ?? 0) + 1
  }
  const unscoredCount = rows.length - covered

  console.log('\nDigital Dark Spot — benchmark report\n')
  console.log(`cases file        ${cases.length} case(s)`)
  console.log(`predictions from  ${sourceLabel}`)
  console.log(`scored            ${covered}/${cases.length}` + (unscoredCount ? ` (${unscoredCount} without a prediction)` : ''))
  console.log(`locked cases      ${rows.filter((r) => r.locked).length} (two agreeing human reviews)`)
  console.log(`synthetic cases   ${rows.filter((r) => r.synthetic).length} (must stay labelled synthetic)\n`)

  // Per-case diagnostics are always safe to print.
  const width = Math.max(...rows.map((r) => r.case_id.length), 7)
  console.log('  case'.padEnd(width + 2) + 'expected'.padEnd(14) + 'predicted'.padEnd(14) + 'result')
  for (const r of rows) {
    const result = r.predicted === null ? 'no prediction' : r.correct ? 'match' : 'MISMATCH'
    console.log(
      `  ${r.case_id.padEnd(width)}  ${r.expected.padEnd(12)}  ${String(r.predicted ?? '—').padEnd(12)}  ${result}` +
        (r.locked ? '' : '  (unreviewed)'),
    )
  }

  if (process.argv.includes('--json')) {
    console.log('\n' + JSON.stringify({ rows, matrix, covered, correct, locked: lockedScored.length }, null, 2))
  }

  console.log('\nConfusion (rows = expected, cols = predicted)')
  const header = ['expected\\pred', ...STATUSES]
  console.log('  ' + header.map((h) => h.padEnd(12)).join(''))
  for (const expected of STATUSES) {
    const cells = STATUSES.map((got) => String(matrix[expected][got]).padEnd(12))
    console.log('  ' + [expected.padEnd(12), ...cells].join(''))
  }

  const lockedCovered = lockedScored.length
  const lockedCorrect = lockedScored.filter((r) => r.correct).length

  console.log('\nVerdict')
  console.log('───────')
  if (selfCheck) {
    console.log('  PLUMBING CHECK ONLY — expected labels were replayed, so this is not evidence of accuracy.')
    console.log('  The harness loads cases, matches statuses, counts evidence overlap and reports a confusion matrix.')
  } else if (covered === 0) {
    console.log('  NOTHING SCORED — no predictions matched the case list. No accuracy is claimed.')
  } else if (lockedCovered < covered) {
    console.log(
      `  INSUFFICIENT REVIEW — ${covered - lockedCovered} of ${covered} scored case(s) lack two agreeing human reviews.`,
    )
    console.log('  Raw agreement on scored cases is shown below for diagnostics only; it is NOT a validated benchmark score.')
    console.log(`  unvalidated agreement: ${correct}/${covered}`)
  } else {
    console.log(`  VALIDATED SCORE: ${lockedCorrect}/${lockedCovered} locked cases matched (${((lockedCorrect / lockedCovered) * 100).toFixed(1)}%).`)
    console.log('  Only locked cases count. Cases without two agreeing reviews are excluded.')
  }
  console.log('')
}

main()
