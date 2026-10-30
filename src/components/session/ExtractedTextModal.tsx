import { useEffect, useState } from 'react'
import { AlertCircle, FileText, Loader2 } from 'lucide-react'
import { listSourceChunks } from '../../lib/api'
import { sourceOrigin } from '../../lib/status'
import type { Source, SourceChunk } from '../../lib/types'
import { Modal } from '../ui/overlay'
import { OriginBadge } from './ProvenanceBadge'

/**
 * The text this app actually extracted from a source, page by page.
 *
 * It exists so a reader can check the analysis against the raw material: if a
 * requirement was reported as not settled, the thing to read is this. When
 * extraction produced nothing, the modal says so instead of showing an empty box
 * that could be mistaken for "the document says nothing".
 */
export function ExtractedTextModal({
  source,
  onClose,
}: {
  source: Source | null
  onClose: () => void
}) {
  const [chunks, setChunks] = useState<SourceChunk[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!source) return
    let cancelled = false
    setChunks(null)
    setError(null)
    setLoading(true)
    listSourceChunks(source.id)
      .then((rows) => {
        if (!cancelled) setChunks(rows)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load the extracted text.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [source])

  const totalChars = (chunks ?? []).reduce((sum, c) => sum + c.char_count, 0)

  return (
    <Modal
      open={Boolean(source)}
      onClose={onClose}
      size="lg"
      title={source ? `Extracted text — ${source.title}` : 'Extracted text'}
      description={
        source
          ? `${source.extractor ?? 'unknown extractor'} · ${source.page_count ?? '—'} pages · ${totalChars.toLocaleString()} characters in ${chunks?.length ?? 0} page-preserving chunks`
          : undefined
      }
    >
      {source ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <OriginBadge category={sourceOrigin(source)} />
            <span className="text-[10.5px] text-slatey-400">
              {source.file_name ?? source.domain ?? 'source'} · status:{' '}
              <span className="text-slatey-300">{source.status}</span>
            </span>
          </div>

          {loading ? (
            <p className="flex items-center gap-2 py-6 text-[12px] text-slatey-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading the stored text…
            </p>
          ) : error ? (
            <p className="flex items-start gap-2 rounded-lg border border-coral-soft/25 bg-coral-soft/[0.06] px-3 py-2 text-[11.5px] text-coral-soft">
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
            </p>
          ) : chunks && chunks.length > 0 ? (
            <div className="max-h-[60vh] space-y-3 overflow-y-auto pr-1">
              {chunks.map((chunk) => (
                <section key={chunk.id} className="rounded-lg border border-white/[0.07] bg-ink-950/50">
                  <header className="flex items-center justify-between border-b border-white/[0.05] px-3 py-1.5">
                    <p className="text-[10px] font-medium uppercase tracking-[0.1em] text-slatey-400">
                      {chunk.page_from
                        ? chunk.page_to && chunk.page_to !== chunk.page_from
                          ? `Pages ${chunk.page_from}–${chunk.page_to}`
                          : `Page ${chunk.page_from}`
                        : `Chunk ${chunk.chunk_index + 1}`}
                    </p>
                    <p className="text-[10px] tabular-nums text-slatey-400">{chunk.char_count.toLocaleString()} chars</p>
                  </header>
                  <pre className="whitespace-pre-wrap px-3 py-2 font-sans text-[11.5px] leading-relaxed text-slatey-300">
                    {chunk.content}
                  </pre>
                </section>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-white/[0.08] bg-white/[0.02] px-3 py-4">
              <p className="flex items-center gap-2 text-[12px] text-slatey-200">
                <FileText className="h-3.5 w-3.5" /> No text is stored for this source.
              </p>
              <p className="mt-1 text-[11px] leading-relaxed text-slatey-400">
                Extraction produced nothing, or has not run yet. Nothing was analysed from it, so
                requirements cannot be treated as settled or unsettled on its basis — retry extraction
                first.
              </p>
            </div>
          )}
        </div>
      ) : null}
    </Modal>
  )
}
