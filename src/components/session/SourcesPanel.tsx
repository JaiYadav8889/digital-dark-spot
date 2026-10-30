import { useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileSearch,
  FileText,
  Globe,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  Type,
  Upload,
  Link2Off,
} from 'lucide-react'
import {
  addManualNoteSource,
  addUrlSource,
  extractSource,
  markSourceFailed,
  documentUrlFor,
  removeSource,
  uploadPdfSource,
  validatePdf,
  validateUrl,
} from '../../lib/api'
import { SOURCE_STATUS_META, SOURCE_TYPE_LABEL, sourceOrigin } from '../../lib/status'
import type { Source, SourceType } from '../../lib/types'
import { cn, formatBytes, formatDate, relativeTime } from '../../lib/utils'
import { Badge, Button, Card, CardHeader, EmptyState, Field, Input, Select, Textarea } from '../ui/primitives'
import { Modal, Tooltip } from '../ui/overlay'
import { useToast } from '../ui/toast'
import { OriginBadge } from './ProvenanceBadge'
import { ExtractedTextModal } from './ExtractedTextModal'

const SOURCE_TYPES: SourceType[] = [
  'official_guideline',
  'government_page',
  'parliamentary_record',
  'secondary_guide',
  'other',
]

type AddMode = 'url' | 'pdf' | 'note'

export function SourcesPanel({
  sessionId,
  sources,
  onChanged,
  compact,
}: {
  sessionId: string
  sources: Source[]
  onChanged: () => void | Promise<void>
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<AddMode>('url')
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({})
  const [textSource, setTextSource] = useState<Source | null>(null)
  const toast = useToast()

  async function runExtraction(source: Source) {
    setBusyIds((prev) => ({ ...prev, [source.id]: true }))
    const result = await extractSource(source.id, source.status === 'failed' ? 'retry' : 'fetch')
    setBusyIds((prev) => ({ ...prev, [source.id]: false }))
    if (!result.ok) {
      await markSourceFailed(source.id, result.message)
      toast.error('Extraction could not start', result.message)
    } else {
      toast.success(
        source.status === 'failed' ? 'Extraction retried' : 'Extraction requested',
        result.data?.message ?? 'The source is being processed.',
      )
    }
    await onChanged()
  }

  async function handleRemove(source: Source) {
    if (!window.confirm(`Remove “${source.title}” and all evidence extracted from it?`)) return
    try {
      await removeSource(source)
      toast.success('Source removed')
      await onChanged()
    } catch (err) {
      toast.error('Could not remove the source', err instanceof Error ? err.message : undefined)
    }
  }

  async function openPdf(source: Source) {
    const url = await documentUrlFor(source)
    if (url) window.open(url, '_blank', 'noopener,noreferrer')
    else toast.error('No readable copy of this document is available here')
  }

  const failedCount = sources.filter((s) => s.status === 'failed').length

  return (
    <>
      <Card>
        <CardHeader
          title={`Sources (${sources.length})`}
          subtitle="Original documents are preserved in Supabase Storage; extracted text is chunked for analysis."
          icon={<FileText className="h-4 w-4" />}
          action={
            <div className="flex items-center gap-1.5">
              {failedCount > 0 ? (
                <Tooltip content="Retry every source whose extraction failed.">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => sources.filter((s) => s.status === 'failed').forEach((s) => void runExtraction(s))}
                  >
                    <RefreshCw className="mr-1 h-3 w-3" /> Retry failed ({failedCount})
                  </Button>
                </Tooltip>
              ) : null}
              <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => setOpen(true)}>
                Add source
              </Button>
            </div>
          }
        />

        <div className={cn('divide-y divide-white/[0.05]', compact && 'max-h-[420px] overflow-y-auto')}>
          {sources.length === 0 ? (
            <div className="p-4">
              <EmptyState
                compact
                icon={<Globe className="h-5 w-5" />}
                title="No sources yet"
                description="Add an official PDF, a government page or a secondary guide. Nothing is analysed until at least one source is extracted."
                action={
                  <Button size="sm" variant="primary" className="mt-1" onClick={() => setOpen(true)}>
                    Add your first source
                  </Button>
                }
              />
            </div>
          ) : (
            sources.map((source) => {
              const statusMeta = SOURCE_STATUS_META[source.status]
              const processing = busyIds[source.id] || source.status === 'processing'
              return (
                <div key={source.id} className="flex items-start gap-3 px-4 py-3">
                  <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-slatey-300">
                    {source.kind === 'pdf' ? (
                      <FileText className="h-4 w-4" />
                    ) : source.kind === 'note' ? (
                      <Type className="h-4 w-4" />
                    ) : (
                      <Globe className="h-4 w-4" />
                    )}
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="min-w-0 truncate text-[12.5px] font-medium text-slatey-100" title={source.title}>
                        {source.title}
                      </p>
                      <Badge tone={statusMeta.tone} dot>
                        {processing ? 'Processing' : statusMeta.label}
                      </Badge>
                      <OriginBadge category={sourceOrigin(source)} />
                    </div>

                    <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 text-[10.5px] text-slatey-400">
                      <span>{SOURCE_TYPE_LABEL[source.source_type]}</span>
                      {source.issuer ? <span>· {source.issuer}</span> : null}
                      {source.domain ? <span>· {source.domain}</span> : null}
                      {source.published_date ? <span>· published {formatDate(source.published_date)}</span> : null}
                      {source.updated_date ? <span>· updated {formatDate(source.updated_date)}</span> : null}
                      {source.page_count ? <span>· {source.page_count} pages</span> : null}
                      {source.file_size ? <span>· {formatBytes(source.file_size)}</span> : null}
                      {source.char_count > 0 ? (
                        <span>· {source.char_count.toLocaleString()} chars extracted</span>
                      ) : null}
                      {source.retrieved_at ? <span>· fetched {relativeTime(source.retrieved_at)}</span> : null}
                    </div>

                    {source.extraction_notes ? (
                      <p className="mt-1 text-[10.5px] leading-relaxed text-slatey-400/90">{source.extraction_notes}</p>
                    ) : null}

                    {source.status === 'failed' && source.error_message ? (
                      <p className="mt-1 flex items-start gap-1 text-[10.5px] leading-relaxed text-coral-soft">
                        <AlertCircle className="mt-[2px] h-3 w-3 shrink-0" /> {source.error_message}
                      </p>
                    ) : null}

                    <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                      <button
                        onClick={() => setTextSource(source)}
                        className="flex items-center gap-1 text-[10.5px] font-medium text-slatey-200 hover:text-white"
                      >
                        <FileSearch className="h-3 w-3" /> Extracted text
                      </button>
                      {source.kind === 'pdf' && (source.document_path || source.storage_path) ? (
                        <button
                          onClick={() => void openPdf(source)}
                          className="flex items-center gap-1 text-[10.5px] font-medium text-ice hover:text-white"
                        >
                          <ExternalLink className="h-3 w-3" />{' '}
                          {source.document_path ? 'Uploaded PDF' : 'Original PDF'}
                        </button>
                      ) : source.url ? (
                        <a
                          href={source.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex max-w-[16rem] items-center gap-1 truncate text-[10.5px] font-medium text-ice hover:text-white"
                        >
                          <ExternalLink className="h-3 w-3 shrink-0" />
                          <span className="truncate">{source.url}</span>
                        </a>
                      ) : (
                        <span className="flex items-center gap-1 text-[10.5px] text-slatey-400/80">
                          <Link2Off className="h-3 w-3 shrink-0" />
                          URL unavailable for verification
                        </span>
                      )}

                      {(source.status === 'failed' || source.status === 'partial') ? (
                        <button
                          onClick={() => void runExtraction(source)}
                          disabled={processing}
                          className="flex items-center gap-1 text-[10.5px] font-medium text-amber-warm hover:text-white disabled:opacity-50"
                        >
                          {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          {source.status === 'failed' ? 'Retry extraction' : 'Re-extract'}
                        </button>
                      ) : null}

                      {source.status === 'waiting' ? (
                        <button
                          onClick={() => void runExtraction(source)}
                          disabled={processing}
                          className="flex items-center gap-1 text-[10.5px] font-medium text-violet-soft hover:text-white disabled:opacity-50"
                        >
                          {processing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Clock className="h-3 w-3" />}
                          Start extraction
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-0.5">
                    {source.status === 'extracted' ? (
                      <Tooltip content="Full text extracted">
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5 text-emerald-muted" />
                      </Tooltip>
                    ) : null}
                    <button
                      onClick={() => void handleRemove(source)}
                      className="rounded p-1.5 text-slatey-400 transition-colors hover:bg-coral-soft/10 hover:text-coral-soft"
                      aria-label={`Remove ${source.title}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>

        <p className="border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] leading-relaxed text-slatey-400">
          Failed extractions are never presented as successful. A source that could not be read contributes no
          evidence — findings will make that limitation visible.
        </p>
      </Card>

      <AddSourceModal
        open={open}
        mode={mode}
        onModeChange={setMode}
        onClose={() => setOpen(false)}
        sessionId={sessionId}
        onAdded={async (source) => {
          setOpen(false)
          await runExtraction(source)
        }}
      />

      <ExtractedTextModal source={textSource} onClose={() => setTextSource(null)} />
    </>
  )
}

function AddSourceModal({
  open,
  onClose,
  sessionId,
  mode,
  onModeChange,
  onAdded,
}: {
  open: boolean
  onClose: () => void
  sessionId: string
  mode: AddMode
  onModeChange: (m: AddMode) => void
  onAdded: (source: Source) => void | Promise<void>
}) {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [issuer, setIssuer] = useState('')
  const [sourceType, setSourceType] = useState<SourceType>('government_page')
  const [publishedDate, setPublishedDate] = useState('')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteBody, setNoteBody] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const [files, setFiles] = useState<File[]>([])
  const toast = useToast()

  function reset() {
    setUrl('')
    setTitle('')
    setIssuer('')
    setPublishedDate('')
    setNoteTitle('')
    setNoteBody('')
    setFiles([])
    setError(null)
  }

  async function submit() {
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'url') {
        const invalid = validateUrl(url)
        if (invalid) throw new Error(invalid)
        const source = await addUrlSource(sessionId, {
          url,
          title,
          issuer,
          sourceType,
          publishedDate: publishedDate || undefined,
        })
        reset()
        await onAdded(source)
      } else if (mode === 'pdf') {
        if (files.length === 0) throw new Error('Choose at least one PDF.')
        for (const file of files) {
          const invalid = validatePdf(file)
          if (invalid) throw new Error(`${file.name}: ${invalid}`)
        }
        let last: Source | null = null
        for (const file of files) {
          const source = await uploadPdfSource(sessionId, file)
          last = source
          await onAdded(source)
        }
        reset()
        if (files.length > 1 && last) {
          toast.info(`${files.length} PDFs added`, 'Each document is extracted independently.')
        }
      } else {
        if (noteTitle.trim().length < 3) throw new Error('Give the note a short title.')
        if (noteBody.trim().length < 40) throw new Error('Paste at least a few sentences of source text.')
        const source = await addManualNoteSource(sessionId, {
          title: noteTitle,
          content: noteBody,
          sourceType,
          issuer,
          publishedDate: publishedDate || undefined,
        })
        reset()
        await onAdded(source)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not add the source.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Add a source"
      description="Only sources you deliberately add are analysed. Nothing is fetched from the open web beyond the URLs you provide."
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void submit()} loading={submitting}>
            {mode === 'pdf' ? `Upload ${files.length || ''} PDF${files.length === 1 ? '' : 's'}`.trim() : 'Add source'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-ink-950/50 p-1">
          {(
            [
              ['url', 'Website URL', Globe],
              ['pdf', 'PDF upload', Upload],
              ['note', 'Paste text', Type],
            ] as Array<[AddMode, string, typeof Globe]>
          ).map(([value, label, Icon]) => (
            <button
              key={value}
              onClick={() => {
                onModeChange(value)
                setError(null)
              }}
              className={cn(
                'flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-[12px] font-medium transition-colors',
                mode === value ? 'bg-white/[0.09] text-white' : 'text-slatey-400 hover:text-slatey-200',
              )}
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </button>
          ))}
        </div>

        {mode === 'url' && (
          <div className="space-y-3">
            <Field label="Source URL" required hint="Fetched server-side and extracted with Trafilatura where available.">
              <Input
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.education.gov.in/…"
                inputMode="url"
                autoFocus
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Display title" hint="Optional — taken from the page if omitted.">
                <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Scheme page" />
              </Field>
              <Field label="Issuer" hint="Who published it?">
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="Ministry of Education" />
              </Field>
              <Field label="Source type">
                <Select value={sourceType} onChange={(e) => setSourceType(e.target.value as SourceType)}>
                  {SOURCE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {SOURCE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Published / updated" hint="Leave blank if unknown — undated sources are not assumed outdated.">
                <Input type="date" value={publishedDate} onChange={(e) => setPublishedDate(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {mode === 'pdf' && (
          <div className="space-y-3">
            <div
              onClick={() => fileRef.current?.click()}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                const dropped = Array.from(e.dataTransfer.files).filter((f) => f.name.toLowerCase().endsWith('.pdf'))
                setFiles((prev) => [...prev, ...dropped])
              }}
              className="cursor-pointer rounded-xl border border-dashed border-white/[0.14] bg-white/[0.015] px-4 py-8 text-center transition-colors hover:border-violet-brand/40 hover:bg-violet-brand/[0.04]"
            >
              <Upload className="mx-auto h-6 w-6 text-violet-soft" />
              <p className="mt-2 text-[13px] font-medium text-slatey-200">Drop PDFs here or click to browse</p>
              <p className="mt-1 text-[11px] text-slatey-400">Up to 25 MB per file. Stored privately in Supabase Storage.</p>
              <input
                ref={fileRef}
                type="file"
                accept="application/pdf,.pdf"
                multiple
                className="hidden"
                onChange={(e) => {
                  const picked = Array.from(e.target.files ?? [])
                  setFiles((prev) => [...prev, ...picked])
                  e.target.value = ''
                }}
              />
            </div>

            {files.length > 0 && (
              <ul className="space-y-1.5">
                {files.map((f, i) => (
                  <li
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      <FileText className="h-3.5 w-3.5 shrink-0 text-slatey-400" />
                      <span className="truncate text-[12px] text-slatey-200">{f.name}</span>
                      <span className="shrink-0 text-[10px] text-slatey-400">{formatBytes(f.size)}</span>
                    </span>
                    <button
                      onClick={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
                      className="text-slatey-400 hover:text-coral-soft"
                      aria-label={`Remove ${f.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'note' && (
          <div className="space-y-3">
            <Field label="Note title" required>
              <Input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)} placeholder="Extract from ministry letter" />
            </Field>
            <Field label="Source text" required hint="Paste text you have already obtained. It is stored as a chunk and analysed like an extracted source.">
              <Textarea
                value={noteBody}
                onChange={(e) => setNoteBody(e.target.value)}
                className="min-h-[160px]"
                placeholder="Paste the relevant passage…"
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Issuer">
                <Input value={issuer} onChange={(e) => setIssuer(e.target.value)} placeholder="State nodal agency" />
              </Field>
              <Field label="Published / updated">
                <Input type="date" value={publishedDate} onChange={(e) => setPublishedDate(e.target.value)} />
              </Field>
            </div>
          </div>
        )}

        {error ? (
          <p className="flex items-start gap-1.5 rounded-lg border border-coral-soft/25 bg-coral-soft/[0.07] px-3 py-2 text-[11.5px] leading-relaxed text-coral-soft">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {error}
          </p>
        ) : null}
      </div>
    </Modal>
  )
}
