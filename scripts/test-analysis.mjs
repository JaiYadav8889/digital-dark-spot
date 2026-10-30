/**
 * Executable tests for the analysis engine's pure logic: JSON tolerance,
 * schema coercion and the deterministic heuristic requirement/matching rules.
 *
 * As with the extraction tests, the shipped Edge Function source is sliced and
 * executed directly so the assertions cover the deployed code.
 *
 * Run: node scripts/test-analysis.mjs
 */
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../supabase/functions/analyse/index.ts', import.meta.url), 'utf8')
const start = source.indexOf('function parseJsonLoose')
const end = source.indexOf('const SYSTEM_RULES')
assert.ok(start > 0 && end > start, 'could not locate the pure analysis helpers')

const slice = source.slice(start, end)
const js = transformSync(
  `${slice}\nmodule.exports = { parseJsonLoose, str, oneOf, num, asArray, tokenize, sentences, heuristicRequirements, scoreChunk }`,
  { loader: 'ts', format: 'cjs' },
).code

const module_ = { exports: {} }
new Function('module', 'exports', js)(module_, module_.exports)
const { parseJsonLoose, str, oneOf, num, asArray, tokenize, sentences, heuristicRequirements, scoreChunk } =
  module_.exports

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

console.log('analysis engine helpers')

test('parses plain JSON', () => {
  assert.deepEqual(parseJsonLoose('{"a":1}'), { a: 1 })
})

test('parses JSON wrapped in markdown fences', () => {
  const raw = '```json\n{"requirements":[{"code":"R1"}]}\n```'
  assert.deepEqual(parseJsonLoose(raw), { requirements: [{ code: 'R1' }] })
})

test('recovers JSON surrounded by prose', () => {
  const raw = 'Here is the analysis you asked for:\n{"findings":[]}\nHope that helps.'
  assert.deepEqual(parseJsonLoose(raw), { findings: [] })
})

test('returns null for unusable output rather than throwing', () => {
  assert.equal(parseJsonLoose('I could not complete this request.'), null)
  assert.equal(parseJsonLoose('{"broken": '), null)
})

test('coerces and bounds model output', () => {
  assert.equal(str('  hello  '), 'hello')
  assert.equal(str('', 10), null)
  assert.equal(str(42), null)
  assert.equal(str('x'.repeat(40), 10).length, 10)
  assert.equal(oneOf('high', ['high', 'medium', 'low'], 'medium'), 'high')
  assert.equal(oneOf('nonsense', ['high', 'medium', 'low'], 'medium'), 'medium')
  assert.equal(oneOf(undefined, ['high', 'low'], 'low'), 'low')
  assert.equal(num('0.8', 0.5), 0.8)
  assert.equal(num(2.4, 0.5), 1, 'clamped to the maximum')
  assert.equal(num(-1, 0.5), 0, 'clamped to the minimum')
  assert.equal(num('abc', 0.5), 0.5, 'falls back on NaN')
  assert.deepEqual(asArray([1, 2]), [1, 2])
  assert.deepEqual(asArray({ not: 'an array' }), [])
})

test('tokenizer removes stopwords and short words', () => {
  const tokens = tokenize('What should the student verify before applying?')
  assert.ok(tokens.includes('student'))
  assert.ok(tokens.includes('verify'))
  assert.ok(!tokens.includes('the'))
  assert.ok(!tokens.includes('should'))
})

test('sentence splitter keeps substantive sentences', () => {
  const list = sentences(
    'Renewal requires at least 50% marks in the annual examination and at least 75% attendance. Short one. Students must apply through the institute portal before the closing date.',
  )
  assert.equal(list.length, 2)
  assert.ok(list[0].startsWith('Renewal requires'))
})

test('heuristic requirements are domain-agnostic and complete', () => {
  const reqs = heuristicRequirements('What should I verify before applying for the scheme?', 'AY 2026–27')
  assert.ok(reqs.length >= 8, 'produces a full requirement set')
  assert.deepEqual(
    reqs.map((r) => r.code),
    reqs.map((_, i) => `R${i + 1}`),
    'codes are sequential',
  )
  for (const r of reqs) {
    assert.ok(r.description.length > 5)
    assert.ok(['high', 'medium', 'low'].includes(r.importance))
    assert.ok(r.expected_evidence.includes('AY 2026–27'), 'cycle is threaded into expected evidence')
  }
  const procurement = heuristicRequirements('Which obligations apply to a vendor under the reviewed policy?', null)
  assert.ok(
    procurement.some((r) => /continuation|renewal|extension/i.test(r.description)),
    'covers continuation even outside scholarship domains',
  )
})

test('scoreChunk ranks relevant passages above irrelevant ones', () => {
  const requirement = {
    id: '1',
    code: 'R7',
    description: 'Renewal conditions and attendance requirements',
    importance: 'high',
    expected_evidence: 'A statement of renewal marks and attendance thresholds.',
  }
  const relevant =
    'Continuation of the scholarship for the subsequent year requires at least 50% marks in the annual examination and at least 75% attendance. Renewal applications must be submitted through the institute.'
  const irrelevant =
    'The institute library will remain closed during the winter vacation. Students may borrow up to four books at a time.'

  const good = scoreChunk(relevant, requirement)
  const bad = scoreChunk(irrelevant, requirement)
  assert.ok(good.score > bad.score, `expected ${good.score} > ${bad.score}`)
  assert.ok(good.score >= 3, 'relevant passage clears the linking threshold')
  assert.ok(good.excerpt.toLowerCase().includes('renewal') || good.excerpt.toLowerCase().includes('attendance'))
})

test('scoreChunk does not link on stopwords alone', () => {
  const requirement = {
    id: '2',
    code: 'R1',
    description: 'Eligibility conditions',
    importance: 'high',
    expected_evidence: 'A statement of eligibility.',
  }
  const { score } = scoreChunk('The programme was launched in the year 2013 by the department.', requirement)
  assert.ok(score < 3, `stopword-only overlap should not link (score ${score})`)
})

console.log(`\n${passed} analysis assertions passed`)
