import { useMemo, useState } from 'react'
import { ArrowUpRight, ChevronRight, Filter, Search, ShieldQuestion } from 'lucide-react'
import { STATUS_META, TONE_CLASS, IMPORTANCE_META } from '../../lib/status'
import type { RequirementStatus, RequirementWithStatus } from '../../lib/types'
import { cn } from '../../lib/utils'
import { Badge, EmptyState, Input, PriorityBadge, Segmented } from '../ui/primitives'
import { Tooltip } from '../ui/overlay'

type StatusFilter = 'all' | RequirementStatus | 'verify'
type SortKey = 'priority' | 'order' | 'coverage'

export function RequirementMatrix({
  requirements,
  onSelect,
  dense,
  initialStatus = 'all',
  hideControls,
  maxRows,
}: {
  requirements: RequirementWithStatus[]
  onSelect: (requirement: RequirementWithStatus) => void
  dense?: boolean
  initialStatus?: StatusFilter
  hideControls?: boolean
  maxRows?: number
}) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(initialStatus)
  const [sort, setSort] = useState<SortKey>('order')
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    let rows = requirements
    if (statusFilter === 'verify') rows = rows.filter((r) => r.needs_verification)
    else if (statusFilter !== 'all') rows = rows.filter((r) => r.status === statusFilter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      rows = rows.filter(
        (r) =>
          r.description.toLowerCase().includes(q) ||
          r.code.toLowerCase().includes(q) ||
          (r.category ?? '').toLowerCase().includes(q),
      )
    }
    const sorted = [...rows]
    if (sort === 'priority') {
      const rank = { high: 0, medium: 1, low: 2 }
      sorted.sort((a, b) => rank[a.importance] - rank[b.importance] || a.order_index - b.order_index)
    } else if (sort === 'coverage') {
      sorted.sort((a, b) => b.evidence_count - a.evidence_count || a.order_index - b.order_index)
    } else {
      sorted.sort((a, b) => a.order_index - b.order_index)
    }
    return maxRows ? sorted.slice(0, maxRows) : sorted
  }, [requirements, statusFilter, query, sort, maxRows])

  const counts = useMemo(() => {
    return {
      all: requirements.length,
      found: requirements.filter((r) => r.status === 'found').length,
      partial: requirements.filter((r) => r.status === 'partial').length,
      conflicting: requirements.filter((r) => r.status === 'conflicting').length,
      outdated: requirements.filter((r) => r.status === 'outdated').length,
      not_found: requirements.filter((r) => r.status === 'not_found').length,
      verify: requirements.filter((r) => r.needs_verification).length,
    }
  }, [requirements])

  if (requirements.length === 0) {
    return (
      <EmptyState
        icon={<ShieldQuestion className="h-5 w-5" />}
        title="No information requirements yet"
        description="Requirements are generated from your research objective. Add at least one source, then run the analysis."
      />
    )
  }

  return (
    <div className="space-y-3">
      {!hideControls && (
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as StatusFilter)}
            options={[
              { value: 'all', label: 'All', count: counts.all },
              { value: 'verify', label: 'To verify', count: counts.verify },
              { value: 'found', label: 'Found', count: counts.found },
              { value: 'conflicting', label: 'Conflicting', count: counts.conflicting },
              { value: 'not_found', label: 'Not found', count: counts.not_found },
            ]}
          />
          <div className="relative ml-auto w-full sm:w-56">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slatey-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter requirements…"
              className="h-8 pl-8 text-[12px]"
              aria-label="Filter requirements"
            />
          </div>
          <Tooltip content="Sort by research priority, by the original decomposition order, or by how much evidence was linked.">
            <div className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-ink-950/50 px-2 py-1">
              <Filter className="h-3 w-3 text-slatey-400" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                aria-label="Sort requirements"
                className="cursor-pointer bg-transparent text-[11.5px] text-slatey-300 focus:outline-none"
              >
                <option value="order">Research order</option>
                <option value="priority">Priority</option>
                <option value="coverage">Most evidence</option>
              </select>
            </div>
          </Tooltip>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-white/[0.07]">
        <div className="hidden grid-cols-[2.6rem_minmax(0,1fr)_8.5rem_4.5rem_4.5rem_2rem] items-center gap-3 border-b border-white/[0.07] bg-white/[0.02] px-3.5 py-2 md:grid">
          <span className="label">Ref</span>
          <span className="label">Requirement</span>
          <span className="label">Status</span>
          <span className="label text-center">Sources</span>
          <span className="label text-center">Priority</span>
          <span />
        </div>

        {filtered.length === 0 ? (
          <div className="px-4 py-8">
            <EmptyState compact title="No requirements match this filter" description="Try a different status or clear the search." />
          </div>
        ) : (
          <ul className="divide-y divide-white/[0.05]">
            {filtered.map((r) => {
              const meta = STATUS_META[r.status]
              const tone = TONE_CLASS[meta.tone]
              return (
                <li key={r.requirement_id}>
                  <button
                    onClick={() => onSelect(r)}
                    className={cn(
                      'group grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-3.5 text-left transition-colors hover:bg-white/[0.035] md:grid-cols-[2.6rem_minmax(0,1fr)_8.5rem_4.5rem_4.5rem_2rem]',
                      dense ? 'py-2' : 'py-2.5',
                    )}
                  >
                    <span className="hidden font-mono text-[10.5px] text-slatey-400 md:block">{r.code}</span>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2">
                        <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full md:hidden', tone.dot)} />
                        <span className="truncate text-[12.5px] font-medium text-slatey-200 group-hover:text-white">
                          {r.description}
                        </span>
                      </span>
                      <span className="mt-0.5 flex items-center gap-2 md:hidden">
                        <Badge tone={meta.tone}>{meta.short}</Badge>
                        <span className="text-[10px] text-slatey-400">{r.source_count} sources</span>
                      </span>
                      {r.category ? (
                        <span className="mt-0.5 hidden truncate text-[10.5px] text-slatey-400 md:block">{r.category}</span>
                      ) : null}
                    </span>

                    <span className="hidden md:block">
                      <Badge tone={meta.tone} dot>
                        {meta.short}
                      </Badge>
                    </span>
                    <span className="hidden text-center text-[11.5px] tabular-nums text-slatey-300 md:block">
                      {r.source_count}
                    </span>
                    <span className="hidden justify-center md:flex">
                      <PriorityBadge importance={r.importance} />
                    </span>
                    <span className="justify-self-end text-slatey-400 group-hover:text-violet-soft md:justify-self-auto">
                      <ChevronRight className="h-4 w-4" />
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 text-[10.5px] text-slatey-400">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {(Object.keys(STATUS_META) as RequirementStatus[]).map((s) => (
            <span key={s} className="flex items-center gap-1.5">
              <span className={cn('h-1.5 w-1.5 rounded-full', TONE_CLASS[STATUS_META[s].tone].dot)} />
              {STATUS_META[s].short}
            </span>
          ))}
        </div>
        <span className="flex items-center gap-1">
          <ArrowUpRight className="h-3 w-3" /> Select a requirement to inspect its evidence
        </span>
      </div>
    </div>
  )
}

export function StatusLegend({ status }: { status: RequirementStatus }) {
  const meta = STATUS_META[status]
  return (
    <Tooltip content={meta.description}>
      <span className={cn('inline-flex cursor-help items-center gap-1 text-[10.5px]', TONE_CLASS[meta.tone].text)}>
        {meta.short}
      </span>
    </Tooltip>
  )
}

export function importanceLabel(importance: 'high' | 'medium' | 'low') {
  return IMPORTANCE_META[importance].label
}
