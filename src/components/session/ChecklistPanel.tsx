import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, CheckCircle2, ListChecks, RotateCcw } from 'lucide-react'
import type { ChecklistItem, RequirementWithStatus } from '../../lib/types'
import { cn, pct } from '../../lib/utils'
import { Badge, Checkbox, EmptyState, ProgressBar } from '../ui/primitives'
import { Tooltip } from '../ui/overlay'

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export function ChecklistPanel({
  items,
  requirements,
  onToggle,
  showSessionLink,
  sessionTitles,
}: {
  items: ChecklistItem[]
  requirements?: RequirementWithStatus[]
  onToggle: (id: string, completed: boolean) => void
  showSessionLink?: boolean
  sessionTitles?: Map<string, string>
}) {
  const [filter, setFilter] = useState<'open' | 'done' | 'all'>('open')

  const requirementById = useMemo(
    () => new Map((requirements ?? []).map((r) => [r.requirement_id, r])),
    [requirements],
  )

  const done = items.filter((i) => i.completed).length
  const progress = pct(done, items.length)
  const openByPriority = {
    high: items.filter((i) => !i.completed && i.priority === 'high').length,
    medium: items.filter((i) => !i.completed && i.priority === 'medium').length,
    low: items.filter((i) => !i.completed && i.priority === 'low').length,
  }

  const visible = useMemo(() => {
    let rows = items
    if (filter === 'open') rows = rows.filter((i) => !i.completed)
    if (filter === 'done') rows = rows.filter((i) => i.completed)
    return [...rows].sort(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
        a.order_index - b.order_index,
    )
  }, [items, filter])

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ListChecks className="h-5 w-5" />}
        title="No verification checklist yet"
        description="Once the analysis identifies gaps, conflicts and outdated signals, they are converted into a prioritised checklist of what to confirm before you rely on the information."
      />
    )
  }

  return (
    <div className="space-y-4">
      <div className="surface p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="label">Verification progress</p>
            <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
              {done}
              <span className="text-base text-slatey-400">/{items.length}</span>
              <span className="ml-2 text-sm font-normal text-slatey-400">verified</span>
            </p>
          </div>
          <div className="flex items-center gap-1.5">
            {(['high', 'medium', 'low'] as const).map((p) => (
              <Tooltip key={p} content={`${openByPriority[p]} open ${p} priority item(s)`}>
                <span className="flex items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.02] px-2 py-1 text-[10.5px] text-slatey-300">
                  <span
                    className={cn(
                      'h-1.5 w-1.5 rounded-full',
                      p === 'high' ? 'bg-coral-soft' : p === 'medium' ? 'bg-amber-warm' : 'bg-slatey-400',
                    )}
                  />
                  {openByPriority[p]}
                </span>
              </Tooltip>
            ))}
          </div>
        </div>
        <ProgressBar value={progress} tone={progress === 100 ? 'emerald' : 'violet'} className="mt-3" label="Checklist completion" />
        <div className="mt-2 flex items-center justify-between text-[10.5px] text-slatey-400">
          <span>{progress}% of verification actions complete</span>
          <span className="flex items-center gap-1">
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as typeof filter)}
              className="cursor-pointer bg-transparent text-[10.5px] text-slatey-300 focus:outline-none"
              aria-label="Filter checklist"
            >
              <option value="open">Open items</option>
              <option value="done">Completed</option>
              <option value="all">All items</option>
            </select>
          </span>
        </div>
      </div>

      {visible.length === 0 ? (
        <EmptyState
          compact
          icon={<CheckCircle2 className="h-5 w-5 text-emerald-muted" />}
          title={filter === 'open' ? 'Every verification action is complete' : 'Nothing here yet'}
          description={
            filter === 'open'
              ? 'You have worked through the checklist. Re-run the analysis if you add new sources.'
              : 'Switch the filter to see other items.'
          }
        />
      ) : (
        <ul className="space-y-2">
          {visible.map((item) => {
            const requirement = item.requirement_id ? requirementById.get(item.requirement_id) : undefined
            return (
              <li
                key={item.id}
                className={cn(
                  'surface group flex items-start gap-3 px-4 py-3 transition-colors',
                  item.completed && 'opacity-60',
                )}
              >
                <Checkbox
                  checked={item.completed}
                  onChange={(v) => onToggle(item.id, v)}
                  label={<span className="sr-only">Mark “{item.title}” as verified</span>}
                  className="mt-0.5"
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <Badge tone={item.priority === 'high' ? 'coral' : item.priority === 'medium' ? 'amber' : 'slate'} dot>
                      {item.priority === 'high' ? 'High priority' : item.priority === 'medium' ? 'Medium' : 'Low'}
                    </Badge>
                    {requirement ? (
                      <span className="rounded border border-white/10 bg-white/[0.03] px-1.5 py-0.5 font-mono text-[10px] text-slatey-400">
                        {requirement.code}
                      </span>
                    ) : null}
                    {showSessionLink && sessionTitles?.get(item.session_id) ? (
                      <Link
                        to={`/app/session/${item.session_id}`}
                        className="flex items-center gap-0.5 text-[10px] text-slatey-400 hover:text-ice"
                      >
                        {sessionTitles.get(item.session_id)?.slice(0, 40)}
                        <ArrowUpRight className="h-2.5 w-2.5" />
                      </Link>
                    ) : null}
                  </div>

                  <p className={cn('mt-1.5 text-[12.5px] font-medium leading-snug text-slatey-100', item.completed && 'line-through decoration-white/30')}>
                    {item.title}
                  </p>

                  {item.why_it_matters ? (
                    <p className="mt-1 text-[11px] leading-relaxed text-slatey-400">{item.why_it_matters}</p>
                  ) : null}

                  {item.recommended_source ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-[10.5px] leading-relaxed text-ice/90">
                      <span className="mt-[3px] h-1 w-1 shrink-0 rounded-full bg-ice/70" />
                      Consult: {item.recommended_source}
                    </p>
                  ) : null}
                </div>

                {item.completed && item.completed_at ? (
                  <Tooltip content="Marked as verified">
                    <RotateCcw
                      className="mt-1 h-3.5 w-3.5 shrink-0 cursor-pointer text-slatey-400 opacity-0 transition-opacity hover:text-white group-hover:opacity-100"
                      onClick={() => onToggle(item.id, false)}
                    />
                  </Tooltip>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
