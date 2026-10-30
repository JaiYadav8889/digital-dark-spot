/**
 * Tests the real text-extraction helpers shipped inside
 * supabase/functions/extract-source/index.ts.
 *
 * The function file is sliced (text utils only), type-stripped with esbuild and
 * imported, so this suite exercises the deployed code rather than a copy.
 *
 *   node scripts/test-extraction.mjs
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { transformSync } from 'esbuild'

const SOURCE = 'supabase/functions/extract-source/index.ts'
const raw = readFileSync(SOURCE, 'utf8')

const start = raw.indexOf('const CHUNK_TARGET')
const end = raw.indexOf('// ------------------------------------------------------------ extraction service')
if (start < 0 || end < 0) {
  console.error('Could not locate the text-utils block in', SOURCE)
  process.exit(1)
}

const sliced = `${raw.slice(start, end)}
export { chunkPages, stripHtml, decodeEntities, extractTitle, splitLongParagraph, CHUNK_TARGET, CHUNK_MAX, MIN_USEFUL_CHARS }`

const js = transformSync(sliced, { loader: 'ts', format: 'esm', target: 'es2022' }).code
const dir = mkdtempSync(join(tmpdir(), 'dds-'))
const file = join(dir, 'extract-utils.mjs')
writeFileSync(file, js)
const mod = await import(pathToFileURL(file).href)

const { chunkPages, stripHtml, decodeEntities, extractTitle, splitLongParagraph, CHUNK_MAX } = mod

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

console.log('\nextract-source text utilities\n')

// 1 — tags and script/style bodies are removed, paragraphs survive
{
  const html = `<html><head><style>.a{color:red}</style><script>var x = 1 < 2</script></head>
  <body><h1>Notice</h1><p>Closing date is 31 October 2026.</p><p>Second paragraph.</p></body></html>`
  const text = stripHtml(html)
  check('removes script, style and tags', !/color:red|var x|<h1>|<p>/.test(text), text.slice(0, 80))
  check('keeps visible sentences', text.includes('Closing date is 31 October 2026'))
  check('keeps paragraph separation', /\n{2,}/.test(text.replace(/[ \t]+\n/g, '\n')))
}

// 2 — entity decoding, including numeric and hex references
{
  const decoded = decodeEntities('Fees &amp; charges &#8377;5,000 &#x20b9; and&nbsp;more')
  check('decodes named and numeric entities', decoded.includes('&') && decoded.includes('₹') && !decoded.includes('&amp;'))
}

// 3 — title preference order
{
  check('prefers og:title', extractTitle('<meta property="og:title" content="Scheme page"><title>Other</title>') === 'Scheme page')
  check('falls back to <title>', extractTitle('<title>Fallback title</title>') === 'Fallback title')
  check('returns null when there is no title', extractTitle('<p>nothing</p>') === null)
}

// 4 — an over-long paragraph is split inside the hard maximum
{
  const long = 'word '.repeat(2000)
  const pieces = splitLongParagraph(long.trim())
  check('splits a long paragraph', pieces.length > 1, `pieces=${pieces.length}`)
  check('no piece exceeds CHUNK_MAX', pieces.every((p) => p.length <= CHUNK_MAX))
  check('no text is lost', pieces.join(' ').replace(/\s+/g, ' ').trim() === long.trim().replace(/\s+/g, ' '))
}

// 5 — chunk packing stays near the target and keeps ordering
{
  const paragraph = 'Sentence about eligibility and income limits. '.repeat(30)
  const pages = [
    { page: 1, text: `${paragraph}\n\n${paragraph}` },
    { page: 2, text: `${paragraph}\n\n${paragraph}` },
  ]
  const chunks = chunkPages(pages)
  check('produces more than one chunk for long text', chunks.length > 1, `chunks=${chunks.length}`)
  check('chunk indexes are sequential', chunks.every((c, i) => c.index === i))
  check('every chunk has content', chunks.every((c) => c.content.trim().length > 0))
  check('Page 1 content maps to page 1', chunks[0].pageFrom === 1)
}

// 6 — page spans survive across page boundaries
{
  // Two short pages fit inside one chunk, so the chunk must record both pages.
  const text = (label) => `${label} `.padEnd(600, 'x')
  const chunks = chunkPages([
    { page: 3, text: text('page three') },
    { page: 4, text: text('page four') },
  ])
  const spanning = chunks.find((c) => c.pageFrom === 3 && c.pageTo === 4)
  check('a chunk spanning pages records both', Boolean(spanning), JSON.stringify(chunks.map((c) => [c.pageFrom, c.pageTo])))
}

// 7 — documents without page numbers remain valid
{
  const chunks = chunkPages([{ page: null, text: 'A single undated note with enough text to keep.' }])
  check('null pages stay null', chunks.length === 1 && chunks[0].pageFrom === null && chunks[0].pageTo === null)
}

// 8 — empty input yields nothing rather than an empty chunk
{
  check('empty input produces no chunks', chunkPages([{ page: 1, text: '   \n\n  ' }]).length === 0)
}

console.log(`\n${passed} extraction assertions passed${failed ? `, ${failed} failed` : ''}\n`)
process.exit(failed ? 1 : 0)
