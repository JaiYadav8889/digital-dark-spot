import { useMemo } from 'react'
import { CircleAlert, CircleDashed, FileStack, Info, Lightbulb, Target } from 'lucide-react'
import { DISCLAIMERS, STATUS_META, TONE_CLASS } from '../../lib/status'
import type { EvidenceWithSource, Finding, Relation, RequirementWithStatus } from '../../lib/types'
import { cn, formatDate } from '../../lib/utils'
import { Badge, PriorityBadge } from '../ui/primitives'
import { EvidenceCard } from './EvidenceCard'

const SECTION_ORDER: Array<{ relation: Relation; title: string; blurb: string }> = [
  {
    relation: 'SUPPORTS',
    title: 'Supporting evidence',
    blurb: 'Excerpts that directly establish this requirement.',
  },
  {
    relation: 'PARTIAL',
    title: 'Partial evidence',
    blurb: 'Relevant, but an important part of the requirement is conditional, scoped differently or missing.',
  },
  {
    relation: 'CONFLICTS',
    title: 'Apparently conflicting evidence',
    blurb: 'Excerpts that appear inconsistent with other reviewed claims on this requirement.',
  },
  {
    relation: 'OUTDATED',
    title: 'Potentially outdated evidence',
    blurb: 'Excerpts that describe an earlier cycle, period or superseded approval.',
  },
]

export function RequirementDetail({
  requirement,
  evidence,
  findings,
}: {
  requirement: RequirementWithStatus
  evidence: EvidenceWithSource[]
  findings: Finding[]
}) {
  const meta = STATUS_META[requirement.status]
  const tone = TONE_CLASS[meta.tone]

  const grouped = useMemo(() => {
    const relevant = evidence.filter((e) => e.links.some((l) => l.requirement_id === requirement.requirement_id))
    const map: Record<Relation, Array<{ evidence: EvidenceWithSource; rationale: string | null }>> = {
      SUPPORTS: [],
      PARTIAL: [],
      CONFLICTS: [],
      OUTDATED: [],
    }
    for (const item of relevant) {
      for (const link of item.links) {
        if (link.requirement_id !== requirement.requirement_id) continue
        map[link.relation].push({ evidence: item, rationale: link.rationale })
      }
    }
    return map
  }, [evidence, requirement.requirement_id])

  const linkedFindings = findings.filter((f) => f.requirement_id === requirement.requirement_id)

  return (
    <div className="space-y-5">
      <div className={cn('rounded-xl border p-4', tone.border, tone.bg)}>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={meta.tone} dot>
            {meta.label}
          </Badge>
          <PriorityBadge importance={requirement.importance} />
          <span className="font-mono text-[10.5px] text-slatey-400">{requirement.code}</span>
          {requirement.needs_verification ? (
            <Badge tone="amber" icon={<CircleAlert className="h-3 w-3" />}>
              Requires verification
            </Badge>
          ) : null}
        </div>
        <h3 className="mt-2.5 font-display text-[17px] font-semibold leading-snug text-white">
          {requirement.description}
        </h3>
        <p className="mt-1.5 text-[12px] leading-relaxed text-slatey-300">{meta.description}</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'Sources', value: requirement.source_count, icon: <FileStack className="h-3.5 w-3.5" /> },
          { label: 'Excerpts', value: requirement.evidence_count, icon: <Target className="h-3.5 w-3.5" /> },
          { label: 'Conflicts', value: requirement.conflicts, icon: <CircleAlert className="h-3.5 w-3.5" /> },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
            <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-[0.1em] text-slatey-400">
              {s.icon}
              {s.label}
            </span>
            <p className="mt-0.5 font-display text-lg font-semibold tabular-nums text-white">{s.value}</p>
          </div>
        ))}
      </div>

      {(requirement.why_it_matters || requirement.expected_evidence) && (
        <div className="space-y-3 rounded-xl border border-white/[0.07] bg-white/[0.015] p-4">
          {requirement.why_it_matters ? (
            <div>
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-slatey-400">
                <Lightbulb className="h-3 w-3" /> Why this matters
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-slatey-300">{requirement.why_it_matters}</p>
            </div>
          ) : null}
          {requirement.expected_evidence ? (
            <div>
              <p className="flex items-center gap-1.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-slatey-400">
                <Info className="h-3 w-3" /> What would settle it
              </p>
              <p className="mt-1 text-[12px] leading-relaxed text-slatey-300">{requirement.expected_evidence}</p>
            </div>
          ) : null}
        </div>
      )}

      {SECTION_ORDER.map((section) => {
        const rows = grouped[section.relation]
        if (rows.length === 0) return null
        return (
          <section key={section.relation} className="space-y-2">
            <div>
              <h4 className="font-display text-[13px] font-semibold text-white">
                {section.title} <span className="text-slatey-400">({rows.length})</span>
              </h4>
              <p className="mt-0.5 text-[11px] leading-relaxed text-slatey-400">{section.blurb}</p>
            </div>
            <div className="space-y-2.5">
              {rows.map(({ evidence: item, rationale }, i) => (
                <EvidenceCard
                  key={`${item.id}-${section.relation}-${i}`}
                  evidence={item}
                  relation={section.relation}
                  rationale={rationale}
                />
              ))}
            </div>
          </section>
        )
      })}

      {requirement.evidence_count === 0 && (
        <div className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.015] p-4">
          <p className="flex items-center gap-2 font-display text-[13px] font-semibold text-white">
            <CircleDashed className="h-4 w-4 text-violet-soft" />
            Nothing in the reviewed sources addresses this
          </p>
          <p className="mt-1.5 text-[12px] leading-relaxed text-slatey-300">{DISCLAIMERS.notFound}</p>
        </div>
      )}

      {linkedFindings.length > 0 && (
        <section className="space-y-2">
          <h4 className="font-display text-[13px] font-semibold text-white">Related findings</h4>
          <ul className="space-y-1.5">
            {linkedFindings.map((f) => (
              <li key={f.id} className="rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[12px] font-medium leading-snug text-slatey-200">{f.title}</p>
                  <Badge tone={f.severity === 'high' ? 'coral' : f.severity === 'medium' ? 'amber' : 'slate'}>
                    {f.severity}
                  </Badge>
                </div>
                <p className="mt-1 text-[11px] leading-relaxed text-slatey-400">{f.summary}</p>
                <p className="mt-1 text-[10px] text-slatey-400/80">
                  {f.status} · {formatDate(f.created_at)}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="border-t border-white/[0.06] pt-3 text-[10.5px] leading-relaxed text-slatey-400">
        {DISCLAIMERS.aiSignal}
      </p>
    </div>
  )
}
