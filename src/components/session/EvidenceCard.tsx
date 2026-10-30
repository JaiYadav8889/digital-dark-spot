import { useState } from 'react'
import {
  AlertTriangle,
  BadgeCheck,
  ChevronDown,
  ExternalLink,
  FileText,
  Globe,
  Info,
  Loader2,
  Quote,
  Link2Off,
} from 'lucide-react'
import { signedDocumentUrl } from '../../lib/api'
import { RELATION_META, SOURCE_TYPE_LABEL, TONE_CLASS } from '../../lib/status'
import type { EvidenceWithSource, Relation } from '../../lib/types'
import { cn, formatDate, truncate } from '../../lib/utils'
import { Badge } from '../ui/primitives'
import { Tooltip } from '../ui/overlay'

export function EvidenceCard({
  evidence,
  relation,
  rationale,
  role,
  onOpenRequirement,
  className,
}: {
  evidence: EvidenceWithSource
  relation?: Relation
  rationale?: string | null
  role?: string
  onOpenRequirement?: (requirementId: string) => void
  className?: string
}) {
  const [expanded, setExpanded] = useState(false)
  const [opening, setOpening] = useState(false)
  const [openError, setOpenError] = useState<string | null>(null)

  const src = evidence.source
  const isPdf = src.kind === 'pdf' && Boolean(src.storage_path)

  async function openDocument() {
    if (!src.storage_path) return
    setOpening(true)
    setOpenError(null)
    const url = await signedDocumentUrl(src.storage_path)
    setOpening(false)
    if (!url) {
      setOpenError('A signed link could not be created for this document.')
      return
    }
    const target = evidence.page_number ? `${url}#page=${evidence.page_number}` : url
    window.open(target, '_blank', 'noopener,noreferrer')
  }

  const roleLabel: Record<string, string> = {
    claim_a: 'Claim A',
    claim_b: 'Claim B',
    claim_c: 'Claim C',
    context: 'Context',
    supporting: 'Supporting',
  }

  return (
    <article
      className={cn(
        'group relative overflow-hidden rounded-xl border border-white/[0.08] bg-ink-950/50 transition-colors hover:border-white/[0.14]',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b border-white/[0.05] px-3.5 py-2">
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          {relation ? (
            <Badge tone={RELATION_META[relation].tone} dot>
              {RELATION_META[relation].short}
            </Badge>
          ) : null}
          {role && roleLabel[role] ? (
            <Badge tone="ice">{roleLabel[role]}</Badge>
          ) : null}
          <span className="flex min-w-0 items-center gap-1 text-[10.5px] text-slatey-400">
            {src.kind === 'pdf' ? <FileText className="h-3 w-3 shrink-0" /> : <Globe className="h-3 w-3 shrink-0" />}
            <span className="truncate">{src.issuer ?? src.domain ?? SOURCE_TYPE_LABEL[src.source_type]}</span>
          </span>
          {src.published_date ? (
            <span className="whitespace-nowrap rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] tabular-nums text-slatey-400">
              {formatDate(src.published_date)}
            </span>
          ) : (
            <Tooltip content="No publication or last-updated date was available for this source. It is not treated as outdated on that basis alone.">
              <span className="whitespace-nowrap rounded border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 text-[10px] text-slatey-400">
                undated
              </span>
            </Tooltip>
          )}
          {evidence.page_number ? (
            <span className="whitespace-nowrap rounded border border-ice/20 bg-ice/[0.06] px-1.5 py-0.5 text-[10px] tabular-nums text-ice">
              p. {evidence.page_number}
            </span>
          ) : null}
        </div>
        <button
          onClick={() => setExpanded((e) => !e)}
          className="mt-0.5 shrink-0 rounded p-1 text-slatey-400 transition-colors hover:bg-white/[0.06] hover:text-white"
          aria-label={expanded ? 'Collapse evidence detail' : 'Expand evidence detail'}
          aria-expanded={expanded}
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
        </button>
      </div>

      <div className="px-3.5 py-3">
        <blockquote className="relative border-l-2 pl-3" style={{ borderColor: TONE_CLASS[relation ? RELATION_META[relation].tone : 'violet'].solid + '99' }}>
          <Quote className="mb-1 h-3 w-3 text-slatey-400/60" />
          <p className={cn('text-[12.5px] leading-relaxed text-slatey-200', !expanded && 'line-clamp-4')}>
            {evidence.claim_text}
          </p>
        </blockquote>

        {expanded ? (
          <div className="mt-3 space-y-2.5 animate-fade-in">
            {evidence.summary ? (
              <div>
                <p className="label">What this excerpt states</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slatey-300">{evidence.summary}</p>
              </div>
            ) : null}
            {rationale ? (
              <div>
                <p className="label">Why it was linked</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slatey-300">{rationale}</p>
              </div>
            ) : null}
            {evidence.context_note ? (
              <div className="rounded-lg border border-amber-warm/20 bg-amber-warm/[0.06] px-2.5 py-2">
                <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.1em] text-amber-warm">
                  <Info className="h-3 w-3" /> Evidence limitation
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slatey-300">{evidence.context_note}</p>
              </div>
            ) : null}
            {evidence.links.length > 0 ? (
              <div>
                <p className="label">Linked requirements</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {evidence.links.map((link) => (
                    <button
                      key={link.id}
                      onClick={() => link.requirement && onOpenRequirement?.(link.requirement_id)}
                      disabled={!onOpenRequirement}
                      className={cn(
                        'rounded-md border px-2 py-1 text-[10.5px] transition-colors',
                        TONE_CLASS[RELATION_META[link.relation].tone].border,
                        TONE_CLASS[RELATION_META[link.relation].tone].bg,
                        'hover:brightness-125 disabled:cursor-default',
                      )}
                    >
                      <span className={TONE_CLASS[RELATION_META[link.relation].tone].text}>
                        {link.requirement?.code ?? 'Requirement'}
                      </span>
                      <span className="ml-1 text-slatey-400">
                        {truncate(link.requirement?.description ?? '', 40)}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/[0.05] pt-2.5">
          <span className="min-w-0 flex-1 truncate text-[11px] text-slatey-300" title={src.title}>
            {src.title}
          </span>

          {evidence.quote_verified ? (
            <Tooltip content="The excerpt was matched against the extracted source text.">
              <span className="flex items-center gap-1 text-[10px] text-emerald-muted">
                <BadgeCheck className="h-3 w-3" /> verified against text
              </span>
            </Tooltip>
          ) : (
            <Tooltip content="This excerpt could not be verified against extracted full text (for example, it was read from a search snippet). Treat it as a weaker signal.">
              <span className="flex items-center gap-1 text-[10px] text-amber-warm">
                <AlertTriangle className="h-3 w-3" /> unverified snippet
              </span>
            </Tooltip>
          )}

          {isPdf ? (
            <button
              onClick={openDocument}
              className="flex items-center gap-1 text-[10.5px] font-medium text-ice transition-colors hover:text-white"
            >
              {opening ? <Loader2 className="h-3 w-3 animate-spin" /> : <ExternalLink className="h-3 w-3" />}
              {evidence.page_number ? `Open at page ${evidence.page_number}` : 'Open document'}
            </button>
          ) : src.url ? (
            <a
              href={src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10.5px] font-medium text-ice transition-colors hover:text-white"
            >
              <ExternalLink className="h-3 w-3" /> Open source
            </a>
          ) : (
            <span className="flex items-center gap-1 text-[10.5px] text-slatey-400/80">
              <Link2Off className="h-3 w-3" /> Source URL unavailable
            </span>
          )}
        </div>

        {openError ? <p className="mt-1.5 text-[10.5px] text-coral-soft">{openError}</p> : null}
      </div>
    </article>
  )
}
