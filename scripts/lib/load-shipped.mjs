/**
 * Load a slice of a *shipped* source file and import it.
 *
 * Tests and the demo importer must exercise the code that actually runs in the
 * Edge Functions, not a copy that can drift. This helper slices a block out of a
 * function source, strips its types with esbuild, writes it to a temp module and
 * imports it, exporting exactly the symbols asked for.
 */
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { transformSync } from 'esbuild'

export async function loadSlice({ file, from, to, exports, tag = 'slice' }) {
  const raw = readFileSync(file, 'utf8')
  const start = raw.indexOf(from)
  if (start < 0) throw new Error(`Marker not found in ${file}: ${from}`)
  const end = to ? raw.indexOf(to, start) : raw.length
  if (end < 0) throw new Error(`End marker not found in ${file}: ${to}`)

  // The shipped files already `export` the pure helpers; only re-export the ones
  // that are still internal, so esbuild does not see a duplicate name.
  const slice = raw.slice(start, end)
  const already = new Set([...slice.matchAll(/^export\s+(?:async\s+)?(?:function|const|type|interface)\s+(\w+)/gm)].map((m) => m[1]))
  const needed = exports.filter((name) => !already.has(name))
  const body = `${slice}${needed.length ? `\nexport { ${needed.join(', ')} }` : ''}`
  const js = transformSync(body, { loader: 'ts', format: 'esm', target: 'es2022' }).code
  const dir = mkdtempSync(join(tmpdir(), 'dds-'))
  const path = join(dir, `${tag}.mjs`)
  writeFileSync(path, js)
  return import(pathToFileURL(path).href)
}

/** The pure analysis helpers exported by supabase/functions/analyse/index.ts. */
export function loadAnalysisHelpers() {
  return loadSlice({
    file: 'supabase/functions/analyse/index.ts',
    from: 'function parseJsonLoose',
    to: '// ---------------------------------------------------------------------------\n// Entry point',
    exports: [
      'parseJsonLoose',
      'str',
      'oneOf',
      'num',
      'asArray',
      'tokenize',
      'sentences',
      'heuristicRequirements',
      'scoreChunk',
      'buildHeuristicEvidence',
      'buildHeuristicFindings',
      'buildHeuristicChecklist',
    ],
    tag: 'analyse-helpers',
  })
}

/** The text utilities exported by supabase/functions/extract-source/index.ts. */
export function loadExtractUtils() {
  return loadSlice({
    file: 'supabase/functions/extract-source/index.ts',
    from: 'const CHUNK_TARGET',
    to: '// ------------------------------------------------------------ extraction service',
    exports: ['chunkPages', 'stripHtml', 'decodeEntities', 'extractTitle', 'splitLongParagraph', 'CHUNK_TARGET', 'CHUNK_MAX'],
    tag: 'extract-utils',
  })
}

/** The status vocabulary + derivations from the app's own lib. */
export function loadAppStatus() {
  return loadSlice({
    file: 'src/lib/status.ts',
    from: 'export type Tone',
    exports: ['COVERAGE_WEIGHTS', 'computeCoverage', 'deriveStatus'],
    tag: 'app-status',
  })
}
