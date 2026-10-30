// =============================================================================
// extract-source — turns a URL or an uploaded PDF into stored, page-aware chunks.
//
// Pipeline
//   1. Load the source row (service role; RLS is bypassed server-side only).
//   2. Ask the Python extraction service (Trafilatura / PyMuPDF) for text.
//      Trafilatura and PyMuPDF cannot run in Deno, so they live in a Vercel
//      Python function. That is a deliberate deployment decision, not a
//      substitution of a less reliable extractor.
//   3. If the service is not configured, URLs fall back to a Deno HTML reader
//      and the source records that fact. PDFs do NOT silently fall back: the
//      source is marked failed with an actionable message.
//   4. Chunk the text (~2,000 chars) preserving page spans, store chunks,
//      update the source status and write an analysis_jobs row.
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

const CHUNK_TARGET = 2000
const CHUNK_MAX = 3200
const MIN_USEFUL_CHARS = 200
const MAX_DOWNLOAD_BYTES = 15 * 1024 * 1024
const FETCH_TIMEOUT_MS = 25_000

interface PageText {
  page: number | null
  text: string
}

interface Chunk {
  index: number
  content: string
  pageFrom: number | null
  pageTo: number | null
}

// ------------------------------------------------------------------ text utils

function stripHtml(html: string): string {
  let text = html
  text = text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
  text = text.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
  text = text.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
  text = text.replace(/<!--[\s\S]*?-->/g, ' ')

  // Prefer a semantic container when one exists.
  const article = text.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)
  const main = text.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)
  const body = text.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)
  const scope = article?.[1] ?? main?.[1] ?? body?.[1] ?? text

  let out = scope
  out = out.replace(/<\/(p|div|section|article|li|h[1-6]|tr|blockquote|br)>/gi, '\n')
  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<[^>]+>/g, ' ')
  out = decodeEntities(out)
  out = out.replace(/[ \t\u00a0]+/g, ' ')
  out = out.replace(/\n[ \t]+/g, '\n')
  out = out.replace(/\n{3,}/g, '\n\n')
  return out.trim()
}

function decodeEntities(input: string): string {
  const named: Record<string, string> = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    ndash: '–',
    mdash: '—',
    rsquo: '’',
    lsquo: '‘',
    ldquo: '“',
    rdquo: '”',
    hellip: '…',
    rupee: '₹',
  }
  return input
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name: string) => named[name.toLowerCase()] ?? whole)
}

function extractTitle(html: string): string | null {
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i)
  if (og?.[1]) return decodeEntities(og[1]).trim()
  const title = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)
  if (title?.[1]) return decodeEntities(title[1]).replace(/\s+/g, ' ').trim()
  const h1 = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)
  if (h1?.[1]) return decodeEntities(stripHtml(h1[1])).trim()
  return null
}

function splitLongParagraph(paragraph: string): string[] {
  if (paragraph.length <= CHUNK_MAX) return [paragraph]
  const sentences = paragraph.split(/(?<=[.!?;])\s+/)
  const parts: string[] = []
  let buffer = ''
  for (const sentence of sentences) {
    if ((buffer + ' ' + sentence).length > CHUNK_MAX && buffer.length > 0) {
      parts.push(buffer.trim())
      buffer = sentence
    } else {
      buffer = buffer ? `${buffer} ${sentence}` : sentence
    }
  }
  if (buffer.trim()) parts.push(buffer.trim())
  // Hard split any remaining monster sentence.
  return parts.flatMap((part) =>
    part.length <= CHUNK_MAX ? [part] : part.match(new RegExp(`[\\s\\S]{1,${CHUNK_MAX}}`, 'g')) ?? [part],
  )
}

/** Packs paragraphs into ~2,000 character chunks while keeping page spans. */
function chunkPages(pages: PageText[]): Chunk[] {
  const chunks: Chunk[] = []
  let buffer = ''
  let pageFrom: number | null = null
  let pageTo: number | null = null

  const flush = () => {
    const content = buffer.trim()
    if (!content) return
    chunks.push({ index: chunks.length, content, pageFrom, pageTo })
    buffer = ''
    pageFrom = null
    pageTo = null
  }

  for (const page of pages) {
    const paragraphs = page.text
      .split(/\n{2,}/)
      .map((p) => p.replace(/\s+\n/g, '\n').trim())
      .filter((p) => p.length > 0)

    for (const rawParagraph of paragraphs) {
      for (const paragraph of splitLongParagraph(rawParagraph)) {
        if (buffer.length + paragraph.length + 2 > CHUNK_TARGET && buffer.length > 0) flush()
        if (pageFrom === null) pageFrom = page.page
        pageTo = page.page
        buffer += (buffer ? '\n\n' : '') + paragraph
      }
    }
  }
  flush()
  return chunks
}

// ------------------------------------------------------------ extraction service

interface ServiceResult {
  ok: boolean
  title?: string | null
  siteName?: string | null
  publishedDate?: string | null
  pages?: PageText[]
  text?: string
  pageCount?: number
  extractor?: string
  error?: string
}

async function callExtractionService(body: Record<string, unknown>): Promise<ServiceResult | null> {
  const base = Deno.env.get('EXTRACTION_SERVICE_URL')
  if (!base) return null
  const secret = Deno.env.get('EXTRACTION_SHARED_SECRET') ?? ''
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 55_000)
    const res = await fetch(base.replace(/\/$/, '') + '/api/extract', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { 'x-dds-secret': secret } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
    clearTimeout(timer)
    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      return { ok: false, error: `Extraction service HTTP ${res.status}: ${detail.slice(0, 300)}` }
    }
    return (await res.json()) as ServiceResult
  } catch (error) {
    return { ok: false, error: `Extraction service unreachable: ${error instanceof Error ? error.message : String(error)}` }
  }
}

// ------------------------------------------------------------------- main

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
  if (!supabaseUrl || !serviceKey) return json({ error: 'Backend is not configured (missing service role credentials).' }, 500)

  let body: { source_id?: string; mode?: string }
  try {
    body = await req.json()
  } catch {
    return json({ error: 'Invalid JSON body.' }, 400)
  }
  const sourceId = body.source_id
  if (!sourceId || typeof sourceId !== 'string') return json({ error: 'source_id is required.' }, 400)

  const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  const { data: source, error: sourceError } = await db.from('sources').select('*').eq('id', sourceId).maybeSingle()
  if (sourceError) return json({ error: sourceError.message }, 500)
  if (!source) return json({ error: 'Source not found.' }, 404)

  const { data: job } = await db
    .from('analysis_jobs')
    .insert({
      session_id: source.session_id,
      stage: 'extraction',
      status: 'running',
      progress: 5,
      message: `Extracting “${source.title}”`,
      started_at: new Date().toISOString(),
      payload: { source_id: sourceId, mode: body.mode ?? 'fetch' },
    })
    .select('id')
    .single()

  await db.from('sources').update({ status: 'processing', error_message: null }).eq('id', sourceId)

  const finish = async (payload: Record<string, unknown>, jobStatus: 'succeeded' | 'partial' | 'failed', message: string) => {
    if (job?.id) {
      await db
        .from('analysis_jobs')
        .update({
          status: jobStatus,
          progress: 100,
          message,
          finished_at: new Date().toISOString(),
          error: jobStatus === 'failed' ? message : null,
        })
        .eq('id', job.id)
    }
    return json(payload)
  }

  try {
    let pages: PageText[] = []
    let extractor = ''
    let title: string | null = null
    let publishedDate: string | null = null
    let pageCount: number | null = null
    const notes: string[] = []

    if (source.kind === 'url') {
      const url = String(source.url ?? '')
      if (!/^https?:\/\//i.test(url)) {
        await db.from('sources').update({ status: 'failed', error_message: 'This source has no valid URL.' }).eq('id', sourceId)
        return await finish({ error: 'This source has no valid URL.', status: 'failed' }, 'failed', 'Invalid URL')
      }

      const service = await callExtractionService({ kind: 'url', url })
      if (service?.ok && service.text && service.text.trim().length > 0) {
        pages = [{ page: null, text: service.text }]
        extractor = service.extractor ?? 'trafilatura'
        title = service.title ?? null
        publishedDate = service.publishedDate ?? null
      } else {
        // Deno-native fallback, explicitly labelled in the source record.
        const controller = new AbortController()
        const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
        const res = await fetch(url, {
          signal: controller.signal,
          redirect: 'follow',
          headers: {
            'User-Agent': 'DigitalDarkSpot/1.0 (information completeness research; +https://github.com/JaiYadav8889/digital-dark-spot)',
            Accept: 'text/html,application/xhtml+xml',
          },
        }).catch((error) => {
          throw new Error(`Could not fetch the URL: ${error instanceof Error ? error.message : String(error)}`)
        })
        clearTimeout(timer)

        if (!res.ok) throw new Error(`The server returned HTTP ${res.status} for this URL.`)

        const contentType = res.headers.get('content-type') ?? ''
        if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
          throw new Error(`Unsupported content type “${contentType || 'unknown'}”. Add the document as a PDF instead.`)
        }

        const buffer = await res.arrayBuffer()
        if (buffer.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('The page is too large to process (over 15 MB).')
        const html = new TextDecoder('utf-8').decode(buffer)

        if (/application\/pdf/i.test(contentType)) {
          throw new Error('This URL returned a PDF. Upload the document instead so pages can be cited.')
        }

        const text = stripHtml(html)
        pages = [{ page: null, text }]
        extractor = 'deno-html-fallback'
        title = extractTitle(html)
        notes.push(
          service?.error
            ? `Python extraction service was unavailable (${service.error.slice(0, 160)}); a lighter HTML reader was used. Extraction quality may be lower.`
            : 'Trafilatura was not configured; a lighter HTML reader was used. Extraction quality may be lower.',
        )
      }
    } else if (source.kind === 'pdf') {
      if (!source.storage_path) throw new Error('This PDF has no stored file.')
      const { data: file, error: downloadError } = await db.storage.from('source-documents').download(source.storage_path)
      if (downloadError || !file) throw new Error(`The stored PDF could not be read: ${downloadError?.message ?? 'unknown error'}`)

      const bytes = new Uint8Array(await file.arrayBuffer())
      if (bytes.byteLength > MAX_DOWNLOAD_BYTES) throw new Error('The PDF is larger than the 15 MB processing limit.')

      let binary = ''
      const chunkSize = 0x8000
      for (let i = 0; i < bytes.length; i += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
      }
      const base64 = btoa(binary)

      const service = await callExtractionService({ kind: 'pdf', base64, filename: source.file_name ?? 'document.pdf' })
      if (!service) {
        throw new Error(
          'PDF extraction requires the Python extraction service (PyMuPDF). Set the EXTRACTION_SERVICE_URL and EXTRACTION_SHARED_SECRET secrets, then retry. Scanned-PDF OCR additionally requires Tesseract on that service.',
        )
      }
      if (!service.ok) throw new Error(service.error ?? 'The extraction service could not read this PDF.')

      if (service.pages && service.pages.length > 0) {
        pages = service.pages
      } else if (service.text) {
        pages = [{ page: null, text: service.text }]
        notes.push('The PDF was returned as a single text block, so page numbers are unavailable for its evidence.')
      } else {
        throw new Error('No text could be extracted from this PDF.')
      }

      extractor = service.extractor ?? 'pymupdf'
      title = service.title ?? null
      pageCount = service.pageCount ?? pages.length
      if (service.extractor === 'pymupdf+tesseract') {
        notes.push('Some pages had no embedded text and were processed with OCR. OCR text can contain recognition errors.')
      }
    } else {
      // Manual note: text was pasted by the researcher.
      const { data: chunks } = await db.from('source_chunks').select('content').eq('source_id', sourceId).order('chunk_index')
      const text = (chunks ?? []).map((c) => c.content).join('\n\n')
      if (!text.trim()) {
        await db.from('sources').update({ status: 'failed', error_message: 'This note contains no text.' }).eq('id', sourceId)
        return await finish({ error: 'This note contains no text.', status: 'failed' }, 'failed', 'Empty note')
      }
      pages = [{ page: null, text }]
      extractor = 'manual'
    }

    const totalChars = pages.reduce((sum, p) => sum + p.text.length, 0)
    const chunks = chunkPages(pages.filter((p) => p.text.trim().length > 0))

    if (chunks.length === 0 || totalChars < MIN_USEFUL_CHARS) {
      const message =
        totalChars === 0
          ? 'No readable text could be extracted. The page may render its content with JavaScript or require access permission.'
          : `Only ${totalChars} characters of readable text were extracted. Findings based on this source will be limited.`
      await db
        .from('sources')
        .update({
          status: 'failed',
          extractor,
          error_message: message,
          char_count: totalChars,
          retrieved_at: new Date().toISOString(),
          extraction_notes: notes.join(' ') || source.extraction_notes,
        })
        .eq('id', sourceId)
      return await finish({ status: 'failed', error: message, extractor, chunks: 0 }, 'failed', message)
    }

    const status = totalChars < 800 || notes.some((n) => n.includes('lighter HTML reader')) ? 'partial' : 'extracted'

    // Replace any previous chunks so re-extraction is idempotent.
    await db.from('source_chunks').delete().eq('source_id', sourceId)
    const rows = chunks.map((c) => ({
      source_id: sourceId,
      session_id: source.session_id,
      chunk_index: c.index,
      content: c.content,
      char_count: c.content.length,
      page_from: c.pageFrom,
      page_to: c.pageTo,
    }))
    for (let i = 0; i < rows.length; i += 40) {
      const { error } = await db.from('source_chunks').insert(rows.slice(i, i + 40))
      if (error) throw new Error(`Could not store the extracted text: ${error.message}`)
    }

    const update: Record<string, unknown> = {
      status,
      extractor,
      char_count: totalChars,
      retrieved_at: new Date().toISOString(),
      error_message: null,
      extraction_notes: notes.join(' ') || null,
    }
    if (pageCount) update.page_count = pageCount
    if (publishedDate && /^\d{4}-\d{2}-\d{2}/.test(publishedDate)) update.published_date = publishedDate.slice(0, 10)
    if (title && (!source.title || source.title === source.domain)) update.title = title.slice(0, 300)

    await db.from('sources').update(update).eq('id', sourceId)

    const message =
      status === 'partial'
        ? `Partially extracted ${totalChars.toLocaleString()} characters into ${chunks.length} chunk(s).`
        : `Extracted ${totalChars.toLocaleString()} characters into ${chunks.length} chunk(s).`

    return await finish(
      { status, extractor, chunks: chunks.length, char_count: totalChars, message },
      status === 'partial' ? 'partial' : 'succeeded',
      message,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    await db
      .from('sources')
      .update({ status: 'failed', error_message: message.slice(0, 900), retrieved_at: new Date().toISOString() })
      .eq('id', sourceId)
    return await finish({ status: 'failed', error: message }, 'failed', message)
  }
})
