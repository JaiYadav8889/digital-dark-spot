/**
 * Executable tests for the extraction helpers that ship inside the
 * `extract-source` Edge Function.
 *
 * The shipped source file is read, the pure text/chunking section is excised and
 * transpiled, then exercised directly. This means the tests guard the real code
 * path rather than a copy of it.
 *
 * Run: node scripts/test-extraction.mjs
 */
import { readFileSync } from 'node:fs'
import { transformSync } from 'esbuild'
import assert from 'node:assert/strict'

const source = readFileSync(new URL('../supabase/functions/extract-source/index.ts', import.meta.url), 'utf8')
const start = source.indexOf('const CHUNK_TARGET')
const end = source.indexOf('// ------------------------------------------------------------ extraction service')
assert.ok(start > 0 && end > start, 'could not locate the pure text helpers in the edge function')

const slice = source.slice(start, end)
const js = transformSync(`${slice}\nmodule.exports = { stripHtml, decodeEntities, chunkPages, splitLongParagraph, extractTitle }`, {
  loader: 'ts',
  format: 'cjs',
}).code

const module_ = { exports: {} }
new Function('module', 'exports', js)(module_, module_.exports)
const { stripHtml, decodeEntities, chunkPages, splitLongParagraph, extractTitle } = module_.exports

let passed = 0
function test(name, fn) {
  fn()
  passed += 1
  console.log(`  ✓ ${name}`)
}

console.log('extraction helpers')

test('strips scripts, styles and tags while keeping paragraph breaks', () => {
  const html = `<html><head><title>Scheme</title><style>.a{color:red}</style></head>
    <body><nav>Home | About</nav><article><h1>Guidelines</h1>
    <p>Scholarship rate is &#8377;12,000 per annum.</p>
    <script>var x = 1 < 2;</script>
    <p>Renewal requires 50% marks &amp; 75% attendance.</p>
    </article><footer>Footer junk</footer></body></html>`
  const text = stripHtml(html)
  assert.ok(text.includes('₹12,000'), 'numeric entity decoded')
  assert.ok(text.includes('& '), 'named entity decoded')
  assert.ok(!text.includes('color:red'), 'style removed')
  assert.ok(!text.includes('var x'), 'script removed')
  assert.ok(text.includes('\n'), 'block elements produce line breaks')
})

test('decodes numeric and hex code points', () => {
  assert.equal(decodeEntities('A &#65; &#x42; &nbsp; &unknown;'), 'A A B   &unknown;')
})

test('prefers og:title, then <title>, then <h1>', () => {
  assert.equal(extractTitle('<meta property="og:title" content="OG Title"><title>Doc</title>'), 'OG Title')
  assert.equal(extractTitle('<title>Plain Title</title>'), 'Plain Title')
  assert.equal(extractTitle('<h1>Heading One</h1>'), 'Heading One')
  assert.equal(extractTitle('<div>no title</div>'), null)
})

test('splits a monster paragraph into bounded pieces', () => {
  const monster = 'word '.repeat(1500)
  const parts = splitLongParagraph(monster)
  assert.ok(parts.length > 1, 'split into several parts')
  for (const part of parts) assert.ok(part.length <= 3200, `part too long: ${part.length}`)
})

test('packs paragraphs into ~2000 character chunks', () => {
  const paragraph = 'The scheme provides a scholarship of twelve thousand rupees per annum. '.repeat(12)
  const pages = [{ page: 1, text: `${paragraph}\n\n${paragraph}` }, { page: 2, text: paragraph }]
  const chunks = chunkPages(pages)
  assert.ok(chunks.length >= 2, 'produced multiple chunks')
  for (const chunk of chunks) {
    assert.ok(chunk.content.length > 0)
    // A chunk may slightly exceed the target, but never the hard ceiling.
    assert.ok(chunk.content.length <= 3300, `chunk ${chunk.index} too long: ${chunk.content.length}`)
  }
  assert.deepEqual(
    chunks.map((c) => c.index),
    chunks.map((_, i) => i),
    'chunk indexes are sequential',
  )
})

test('preserves page spans across pages', () => {
  const text = 'Sentence about eligibility. '.repeat(20)
  const chunks = chunkPages([
    { page: 1, text },
    { page: 2, text },
  ])
  const withPages = chunks.filter((c) => c.pageFrom !== null)
  assert.ok(withPages.length > 0, 'at least one chunk carries a page number')
  for (const chunk of withPages) {
    assert.ok(chunk.pageTo !== null)
    assert.ok(chunk.pageFrom <= chunk.pageTo)
  }
})

test('keeps documents without page numbers valid', () => {
  const chunks = chunkPages([{ page: null, text: 'Eligibility text. '.repeat(80) }])
  assert.ok(chunks.length > 0)
  assert.equal(chunks[0].pageFrom, null)
  assert.equal(chunks[0].pageTo, null)
})

test('produces nothing for empty input', () => {
  assert.deepEqual(chunkPages([{ page: 1, text: '   ' }]), [])
})

console.log(`\n${passed} extraction assertions passed`)
