/**
 * Tests the real analysis helpers shipped inside
 * supabase/functions/analyse/index.ts: JSON recovery, schema validation,
 * domain-agnostic requirement generation and lexical scoring.
 *
 * The module is sliced (pure helpers only), type-stripped with esbuild and
 * imported, so this suite exercises the shipped code rather than a copy.
 *
 *   node scripts/test-analysis.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { transformSync } from 'esbuild'

const SOURCE = 'supabase/functions/analyse/index.ts'
const raw = readFileSync(SOURCE, 'utf8')

const start = raw.indexOf('function parseJsonLoose')
const end = raw.indexOf('const SYSTEM_RULES')
if (start < 0 || end < 0) {
  console.error('Could not locate the helper block in', SOURCE)
  process.exit(1)
}

const sliced = `${raw.slice(start, end)}
export { parseJsonLoose, str, oneOf, num, asArray, tokenize, sentences, heuristicRequirements, scoreChunk }`

const js = transformSync(sliced, { loader: 'ts', format: 'esm', target: 'es2022' }).code
const dir = mkdtempSync(join(tmpdir(), 'dds-'))
const file = join(dir, 'analyse-helpers.mjs')
writeFileSync(file, js)
const mod = await import(pathToFileURL(file).href)
const { parseJsonLoose, str, oneOf, num, asArray, tokenize, sentences, heuristicRequirements, scoreChunk } = mod

let passed = 0
let failed = 0
function check(name, condition, detail = '') {
  if (condition) {
    passed += 1
    console.log(`  ✓ ${name}`)
  } else {
    failed += 1
    console.log(`  ✗ ${name}${detail ? ` — ${detail}` : ''}`)
  }
}

console.log('\nanalyse helpers\n')

// --- JSON recovery ---------------------------------------------------------
check('parses plain JSON', parseJsonLoose('{"a":1}').a === 1)
check(
  'parses fenced JSON',
  parseJsonLoose('```json\n{"requirements":[]}\n```').requirements.length === 0,
)
check('recovers JSON wrapped in prose', parseJsonLoose('Here you go:\n{"ok":true}\nThanks').ok === true)
check('returns null instead of throwing', parseJsonLoose('not json at all') === null)

// --- schema validation -----------------------------------------------------
check('trims and keeps a string', str('  hello  ') === 'hello')
check('rejects non-strings', str(42) === null)
check('rejects empty strings', str('   ') === null)
check('truncates very long strings', str('x'.repeat(5000), 100).length <= 100)
check('oneOf keeps allowed value', oneOf('high', ['high', 'medium', 'low'], 'medium') === 'high')
check('oneOf falls back on junk', oneOf('urgent', ['high', 'medium', 'low'], 'medium') === 'medium')
check('num clamps to range', num(5, 0.5) === 1 && num(-3, 0.5) === 0)
check('num falls back on NaN', num('abc', 0.42) === 0.42)
check('asArray rejects objects', asArray({ a: 1 }).length === 0)

// --- tokenisation ----------------------------------------------------------
{
  const tokens = tokenize('The deadline for the 2026–27 application is 31 October 2026.')
  check('drops stopwords', !tokens.includes('the') && !tokens.includes('for'))
  check('keeps significant terms', tokens.includes('deadline') && tokens.includes('application'))
  check('keeps numbers', tokens.includes('2026'))
}

// --- sentence splitting ----------------------------------------------------
{
  const out = sentences('This is a long enough sentence about eligibility and income. Short one. Another sentence that is definitely long enough to be kept by the splitter.')
  check('keeps substantive sentences only', out.length >= 1 && out.every((s) => s.length > 40))
}

// --- heuristic requirements are domain agnostic ----------------------------
{
  const scholarship = heuristicRequirements('Is the CSSS scholarship available for 2026-27?', 'AY 2026–27')
  const medical = heuristicRequirements('Which statutory approvals does a generic injectable need before launch?', '2027')
  check('produces a complete set', scholarship.length === 8, `n=${scholarship.length}`)
  check('codes are sequential', scholarship.every((r, i) => r.code === `R${i + 1}`))
  check('importances are valid', scholarship.every((r) => ['high', 'medium', 'low'].includes(r.importance)))
  check('every requirement explains why it matters', scholarship.every((r) => r.why_it_matters.length > 10))
  check('every requirement names expected evidence', scholarship.every((r) => r.expected_evidence.length > 20))
  check('the target cycle is carried into the requirements', scholarship.some((r) => r.description.includes('2026')))
  check(
    'no requirement is hardcoded to a scholarship',
    !medical.some((r) => /scholarship|student|institute/i.test(r.description)),
    medical.map((r) => r.description).join(' | '),
  )
  check(
    'the objective subject appears in expected evidence',
    medical.every((r) => r.expected_evidence.toLowerCase().includes('statutory approvals')),
  )
}

// --- lexical scoring -------------------------------------------------------
{
  const requirement = {
    id: 'r1',
    code: 'R1',
    description: 'The closing date for applications in the target cycle',
    importance: 'high',
    expected_evidence: 'An official schedule naming the closing date.',
  }
  const relevant =
    'Applications for the 2026–27 cycle close on 31 October 2026. The closing date for applications is fixed by the ministry and is not extended without a notice.'
  const irrelevant =
    'The institute maintains a hostel, a library and a sports ground for students residing on campus throughout the year.'
  const a = scoreChunk(relevant, requirement)
  const b = scoreChunk(irrelevant, requirement)
  check('relevant passage scores higher', a.score > b.score, `${a.score} vs ${b.score}`)
  check('excerpt comes from the matching sentence', /closing date|close on/i.test(a.excerpt))
  check('irrelevant passage scores below the linking threshold', b.score < 3, `score=${b.score}`)
}

console.log(`\n${passed} analysis assertions passed${failed ? `, ${failed} failed` : ''}\n`)
process.exit(failed ? 1 : 0)
