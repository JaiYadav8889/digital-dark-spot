import { useMemo, useState } from 'react'
import {
  ChevronDown,
  CircleCheck,
  CircleDashed,
  CircleHelp,
  EyeOff,
  GitCompareArrows,
  History,
  Lightbulb,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { DISCLAIMERS, FINDING_META, TONE_CLASS } from '../../lib/status'
import type {
  EvidenceWithSource,
  Finding,
  FindingEvidence,
  FindingKind,
  RequirementWithStatus,
} from '../../lib/types'
import { cn, formatDate, truncate } from '../../lib/utils'
import { Badge, Button, EmptyState } from '../ui/primitives'
import { EvidenceCard } from './EvidenceCard'

const ICONS = {
  gap: CircleDashed,
  conflict: GitCompareArrows,
  outdated: History,
  unanswered: CircleHelp,
  insight: Lightbulb,
} as const

type KindFilter = 'all' | FindingKind

export function FindingsPanel({
  findings,
  findingEvidence,
  evidence,
  requirements,
  onOpenRequirement,
  onStatusChange,
  initialKind = 'all',
  dense,
}: {
  findings: Finding[]
  findingEvidence: FindingEvidence[]
  evidence: EvidenceWithSource[]
  requirements: RequirementWithStatus[]
  onOpenRequirement?: (id: string) => void
  onStatusChange?: (id: string, status: 'open' | 'resolved' | 'dismissed') => void
  initialKind?: KindFilter
  dense?: boolean
}) {
  const [kind, setKind] = useState<KindFilter>(initialKind)
  const [showResolved, setShowResolved] = useState(false)

  const counts = useMemo(() => {
    const open = findings.filter((f) => f.status === 'open')
    return {
      all: open.length,
      gap: open.filter((f) => f.kind === 'gap').length,
      conflict: open.filter((f) => f.kind === 'conflict').length,
      outdated: open.filter((f) => f.kind === 'outdated').length,
      unanswered: open.filter((f) => f.kind === 'unanswered').length,
      insight: open.filter((f) => f.kind === 'insight').length,
    }
  }, [findings])

  const visible = useMemo(() => {
    let rows = showResolved ? findings : findings.filter((f) => f.status === 'open')
    if (kind !== 'all') rows = rows.filter((f) => f.kind === kind)
    const severityRank = { high: 0, medium: 1, low: 2 }
    return [...rows].sort((a, b) => severityRank[a.severity] - severityRank[b.severity])
  }, [findings, kind, showResolved])

  const requirementById = useMemo(
    () => new Map(requirements.map((r) => [r.requirement_id, r])),
    [requirements],
  )
  const evidenceById = useMemo(() => new Map(evidence.map((e) => [e.id, e])), [evidence])

  if (findings.length === 0) {
    return (
      <EmptyState
        icon={<ShieldCheck className="h-5 w-5" />}
        title="No findings yet"
        description="Findings are produced after evidence is mapped against requirements. Run the analysis to generate gaps, conflicts and outdated signals."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ['all', 'All findings'],
            ['gap', 'Potential gaps'],
            ['conflict', 'Conflicts'],
            ['outdated', 'Outdated'],
            ['unanswered', 'Open questions'],
          ] as Array<[KindFilter, string]>
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setKind(value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
              kind === value
                ? 'border-violet-brand/40 bg-violet-brand/12 text-white'
                : 'border-white/[0.08] bg-white/[0.02] text-slatey-400 hover:border-white/20 hover:text-slatey-200',
            )}
          >
            {label}
            <span className="rounded bg-white/[0.07] px-1 text-[10px] tabular-nums">{counts[value] ?? 0}</span>
          </button>
        ))}
        <button
          onClick={() => setShowResolved((s) => !s)}
          className={cn(
            'ml-auto inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] transition-colors',
            showResolved
              ? 'border-white/20 bg-white/[0.06] text-slatey-200'
              : 'border-white/[0.08] text-slatey-400 hover:text-slatey-200',
          )}
        >
          <CircleCheck className="h-3.5 w-3.5" />
          {showResolved ? 'Hiding nothing' : 'Show resolved'}
        </button>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          compact
          title={kind === 'all' ? 'Nothing open in this view' : `No open ${FINDING_META[kind as FindingKind].plural.toLowerCase()}`}
          description="Resolved and dismissed findings are hidden unless you enable them above."
        />
      ) : (
        <div className={cn('grid gap-3', dense ? '' : 'lg:grid-cols-2')}>
          {visible.map((finding) => {
            const kindMeta = FINDING_META[finding.kind]
            const Icon = ICONS[finding.kind]
            const tone = TONE_CLASS[kindMeta.tone]
            const evidenceRows = findingEvidence
              .filter((fe) => fe.finding_id === finding.id)
              .map((fe) => ({ link: fe, item: evidenceById.get(fe.evidence_id) }))
              .filter((row): row is { link: FindingEvidence; item: EvidenceWithSource } => Boolean(row.item))
            const requirement = finding.requirement_id ? requirementById.get(finding.requirement_id) : undefined
            const claims = evidenceRows.filter((r) => r.link.role.startsWith('claim_'))

            return (
              <FindingCard
                key={finding.id}
                finding={finding}
                kindMeta={kindMeta}
                tone={tone}
                Icon={Icon}
                requirement={requirement}
                claims={claims}
                evidenceRows={evidenceRows}
                onOpenRequirement={onOpenRequirement}
                onStatusChange={onStatusChange}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function FindingCard({
  finding,
  kindMeta,
  tone,
  Icon,
  requirement,
  claims,
  evidenceRows,
  onOpenRequirement,
  onStatusChange,
}: {
  finding: Finding
  kindMeta: (typeof FINDING_META)[FindingKind]
  tone: (typeof TONE_CLASS)[keyof typeof TONE_CLASS]
  Icon: (typeof ICONS)[FindingKind]
  requirement?: RequirementWithStatus
  claims: Array<{ link: FindingEvidence; item: EvidenceWithSource }>
  evidenceRows: Array<{ link: FindingEvidence; item: EvidenceWithSource }>
  onOpenRequirement?: (id: string) => void
  onStatusChange?: (id: string, status: 'open' | 'resolved' | 'dismissed') => void
}) {
  const [expanded, setExpanded] = useState(false)
  const isConflict = finding.kind === 'conflict' && claims.length >= 2

  return (
    <article className="surface overflow-hidden">
      <div className="flex items-start justify-between gap-2 px-4 pt-3.5">
        <div className="flex min-w-0 items-center gap-2">
          <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border', tone.border, tone.bg, tone.text)}>
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className={cn('text-[10.5px] font-medium uppercase tracking-[0.1em]', tone.text)}>{kindMeta.label}</span>
          {requirement ? (
            <button
              onClick={() => onOpenRequirement?.(requirement.requirement_id)}
              className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slatey-300 transition-colors hover:text-white"
            >
              {requirement.code}
            </button>
          ) : null}
        </div>
        <Badge tone={finding.severity === 'high' ? 'coral' : finding.severity === 'medium' ? 'amber' : 'slate'}>
          {finding.severity === 'high' ? 'Act soon' : finding.severity === 'medium' ? 'Medium' : 'Low'}
        </Badge>
      </div>

      <div className="px-4 pb-3 pt-2">
        <h3 className="font-display text-[14px] font-semibold leading-snug text-white">{finding.title}</h3>
        <p className={cn('mt-1.5 text-[12px] leading-relaxed text-slatey-300', !expanded && 'line-clamp-3')}>
          {finding.summary}
        </p>

        {isConflict && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {claims.slice(0, 2).map(({ link, item }, idx) => (
              <div
                key={link.id}
                className="rounded-lg border border-coral-soft/20 bg-coral-soft/[0.04] p-2.5"
              >
                <p className="text-[9.5px] font-semibold uppercase tracking-[0.1em] text-coral-soft">
                  Claim {idx === 0 ? 'A' : 'B'}
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slatey-200">
                  “{truncate(item.claim_text, 190)}”
                </p>
                <p className="mt-1.5 truncate text-[10px] text-slatey-400" title={item.source.title}>
                  {item.source.issuer ?? item.source.domain} ·{' '}
                  {item.source.published_date ? formatDate(item.source.published_date) : 'undated'}
                </p>
              </div>
            ))}
          </div>
        )}

        {expanded && (
          <div className="mt-3 space-y-3 animate-fade-in">
            {finding.recommended_verification ? (
              <div className="rounded-lg border border-ice/20 bg-ice/[0.05] p-2.5">
                <p className="flex items-center gap-1.5 text-[9.5px] font-semibold uppercase tracking-[0.1em] text-ice">
                  <Sparkles className="h-3 w-3" /> What to verify
                </p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-slatey-200">
                  {finding.recommended_verification}
                </p>
              </div>
            ) : null}

            {finding.kind === 'conflict' ? (
              <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-[10.5px] leading-relaxed text-slatey-400">
                {DISCLAIMERS.conflict}
              </p>
            ) : null}

            {finding.kind === 'gap' || finding.kind === 'unanswered' ? (
              <p className="rounded-lg border border-white/[0.07] bg-white/[0.02] p-2.5 text-[10.5px] leading-relaxed text-slatey-400">
                {DISCLAIMERS.notFound}
              </p>
            ) : null}

            {evidenceRows.length > 0 ? (
              <div className="space-y-2">
                <p className="label">Referenced excerpts ({evidenceRows.length})</p>
                {evidenceRows.map(({ link, item }) => (
                  <EvidenceCard
                    key={link.id}
                    evidence={item}
                    role={link.role}
                    rationale={link.note}
                    onOpenRequirement={onOpenRequirement}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-white/[0.12] bg-white/[0.015] px-3 py-2.5">
                <p className="text-[11px] leading-relaxed text-slatey-400">
                  <span className="font-medium text-slatey-200">No excerpt is attached to this finding.</span>{' '}
                  {finding.kind === 'gap'
                    ? 'That is expected — a gap records the absence of evidence for a requirement. It is not itself evidence, so nothing is quoted. The requirement it belongs to is linked above.'
                    : 'The analysis recorded this signal without quoting a passage, so it should be treated as a prompt to look at the sources yourself rather than as a supported claim.'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.06] bg-white/[0.015] px-4 py-2">
        <button
          onClick={() => setExpanded((e) => !e)}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-slatey-300 transition-colors hover:text-white"
        >
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', expanded && 'rotate-180')} />
          {expanded ? 'Hide evidence' : `View evidence${evidenceRows.length ? ` (${evidenceRows.length})` : ''}`}
        </button>

        {onStatusChange ? (
          <div className="flex items-center gap-1.5">
            {finding.status === 'open' ? (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10.5px]" onClick={() => onStatusChange(finding.id, 'resolved')}>
                  <CircleCheck className="mr-1 h-3 w-3" /> Verified
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-[10.5px]" onClick={() => onStatusChange(finding.id, 'dismissed')}>
                  <EyeOff className="mr-1 h-3 w-3" /> Dismiss
                </Button>
              </>
            ) : (
              <button
                onClick={() => onStatusChange(finding.id, 'open')}
                className="text-[10.5px] text-slatey-400 underline decoration-white/20 underline-offset-2 hover:text-white"
              >
                Reopen
              </button>
            )}
          </div>
        ) : null}
      </div>
    </article>
  )
}
