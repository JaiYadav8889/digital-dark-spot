import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowUpRight,
  BookOpenCheck,
  CircleDashed,
  FileStack,
  GitCompareArrows,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { useShellHeader } from '../components/layout/AppShell'
import { SessionStatusBadge } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, EmptyState, Skeleton } from '../components/ui/primitives'
import { Tooltip } from '../components/ui/overlay'
import { useToast } from '../components/ui/toast'
import { listAllTasks, listSessionSummaries, toggleChecklistItem, type TaskRow } from '../lib/api'
import { STATUS_META, TONE_CLASS } from '../lib/status'
import type { SessionSummary } from '../lib/types'
import { cn, formatDate, pct, relativeTime } from '../lib/utils'

export default function Overview() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  useShellHeader({ title: 'Overview', subtitle: 'Workspace activity and outstanding verification work' })

  useEffect(() => {
    let active = true
    Promise.all([listSessionSummaries(), listAllTasks()])
      .then(([s, t]) => {
        if (!active) return
        setSessions(s)
        setTasks(t)
        setError(null)
      })
      .catch((err) => active && setError(err instanceof Error ? err.message : 'Could not load the workspace.'))
      .finally(() => active && setLoading(false))
    return () => {
      active = false
    }
  }, [])

  const totals = useMemo(() => {
    return sessions.reduce(
      (acc, s) => ({
        sources: acc.sources + s.total_sources,
        requirements: acc.requirements + s.total_requirements,
        found: acc.found + s.found_requirements,
        gaps: acc.gaps + s.not_found_requirements,
        conflicts: acc.conflicts + s.open_conflicts,
        openTasks: acc.openTasks + s.open_tasks,
      }),
      { sources: 0, requirements: 0, found: 0, gaps: 0, conflicts: 0, openTasks: 0 },
    )
  }, [sessions])

  const demo = sessions.find((s) => s.is_demo)
  const openTasks = tasks.filter((t) => !t.completed).slice(0, 5)

  async function completeTask(task: TaskRow) {
    try {
      await toggleChecklistItem(task.id, true)
      setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, completed: true } : t)))
      toast.success('Verification recorded', task.title)
    } catch (err) {
      toast.error('Could not update the task', err instanceof Error ? err.message : undefined)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-40" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-coral-soft/25 bg-coral-soft/[0.07] px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral-soft" />
          <div>
            <p className="text-[12.5px] font-medium text-coral-soft">The workspace could not be loaded</p>
            <p className="mt-0.5 text-[11.5px] leading-relaxed text-slatey-300">{error}</p>
          </div>
        </div>
      ) : null}

      {/* summary strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          { label: 'Research sessions', value: sessions.length, icon: <Target className="h-4 w-4" />, accent: 'text-violet-soft', caption: `${sessions.filter((s) => s.status === 'ready').length} with completed analysis` },
          { label: 'Sources reviewed', value: totals.sources, icon: <FileStack className="h-4 w-4" />, accent: 'text-ice', caption: 'Across all sessions' },
          { label: 'Requirement statuses', value: totals.requirements, icon: <CircleDashed className="h-4 w-4" />, accent: 'text-amber-warm', caption: `${totals.found} found · ${totals.gaps} not found` },
          { label: 'Open verification', value: totals.openTasks, icon: <ListChecks className="h-4 w-4" />, accent: 'text-coral-soft', caption: `${totals.conflicts} open conflict signal(s)` },
        ].map((item) => (
          <div key={item.label} className="surface px-4 py-3.5">
            <div className="flex items-start justify-between">
              <span className={cn('rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5', item.accent)}>{item.icon}</span>
              <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-white">{item.value}</span>
            </div>
            <p className="mt-3 text-[12px] font-medium text-slatey-200">{item.label}</p>
            <p className="mt-0.5 text-[10.5px] text-slatey-400">{item.caption}</p>
          </div>
        ))}
      </div>

      {/* demo spotlight */}
      {demo ? (
        <section className="relative overflow-hidden rounded-xl border border-violet-brand/25 bg-gradient-to-br from-violet-brand/[0.13] via-ink-900 to-ink-900 p-5">
          <div className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full bg-ice/[0.07] blur-3xl" aria-hidden />
          <div className="relative flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 max-w-2xl">
              <div className="flex items-center gap-2">
                <Badge tone="violet" icon={<Sparkles className="h-3 w-3" />}>
                  Demonstration case
                </Badge>
                <span className="text-[10.5px] text-slatey-400">Central Sector Scheme of Scholarships · AY 2026–27</span>
              </div>
              <h2 className="mt-2 font-display text-[17px] font-semibold leading-snug text-white">
                {demo.title}
              </h2>
              <p className="mt-1.5 text-[12px] leading-relaxed text-slatey-300">
                A real investigation over official guidelines, a government scheme page, a parliamentary reference and
                four secondary guides — showing what the evidence settles, where sources disagree, and which approvals
                lapse before the 2026–27 cycle.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px] text-slatey-300">
                <span className="flex items-center gap-1.5">
                  <FileStack className="h-3.5 w-3.5 text-ice" /> {demo.total_sources} sources
                </span>
                <span className="flex items-center gap-1.5">
                  <Target className="h-3.5 w-3.5 text-violet-soft" /> {demo.total_requirements} requirements
                </span>
                <span className="flex items-center gap-1.5">
                  <GitCompareArrows className="h-3.5 w-3.5 text-coral-soft" /> {demo.open_conflicts} conflicts
                </span>
                <span className="flex items-center gap-1.5">
                  <CircleDashed className="h-3.5 w-3.5 text-amber-warm" /> {demo.not_found_requirements} not found
                </span>
              </div>
            </div>
            <Link to={`/app/session/${demo.session_id}`}>
              <Button variant="primary" icon={<ArrowUpRight className="h-3.5 w-3.5" />}>
                Open case
              </Button>
            </Link>
          </div>
          <div className="relative mt-4">
            <DistributionBar summary={demo} />
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,340px)]">
        {/* sessions */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-[15px] font-semibold text-white">Research sessions</h2>
            <div className="flex items-center gap-2">
              <Link to="/app/history">
                <Button size="sm" variant="ghost">
                  History
                </Button>
              </Link>
              <Link to="/app/new">
                <Button size="sm" variant="secondary" icon={<Plus className="h-3.5 w-3.5" />}>
                  New
                </Button>
              </Link>
            </div>
          </div>

          {sessions.length === 0 ? (
            <EmptyState
              icon={<Target className="h-5 w-5" />}
              title="No research sessions yet"
              description="Frame an objective, add the sources you trust, and let the platform show you what your evidence does not settle."
              action={
                <Link to="/app/new">
                  <Button size="sm" variant="primary" className="mt-1">
                    Start your first investigation
                  </Button>
                </Link>
              }
            />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {sessions.slice(0, 6).map((s) => (
                <Link
                  key={s.session_id}
                  to={`/app/session/${s.session_id}`}
                  className="surface group flex flex-col p-4 transition-all hover:border-white/[0.15] hover:bg-ink-900/90"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate font-display text-[13.5px] font-semibold text-white">{s.title}</p>
                      <p className="mt-0.5 text-[10.5px] text-slatey-400">
                        {s.target_cycle ? `${s.target_cycle} · ` : ''}
                        updated {relativeTime(s.updated_at)}
                      </p>
                    </div>
                    <SessionStatusBadge status={s.status} />
                  </div>

                  <div className="mt-3 grid grid-cols-4 gap-2 text-center">
                    {[
                      { k: 'Sources', v: s.total_sources },
                      { k: 'Reqs', v: s.total_requirements },
                      { k: 'Found', v: s.found_requirements },
                      { k: 'To verify', v: s.open_tasks },
                    ].map((m) => (
                      <div key={m.k} className="rounded-md border border-white/[0.06] bg-white/[0.02] py-1.5">
                        <p className="font-display text-[14px] font-semibold tabular-nums text-white">{m.v}</p>
                        <p className="text-[9px] uppercase tracking-[0.08em] text-slatey-400">{m.k}</p>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3">
                    <DistributionBar summary={s} compact />
                  </div>

                  <span className="mt-3 inline-flex items-center gap-1 text-[10.5px] font-medium text-violet-soft opacity-0 transition-opacity group-hover:opacity-100">
                    Open workspace <ArrowUpRight className="h-3 w-3" />
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* verification queue */}
        <aside className="space-y-3">
          <Card>
            <CardHeader
              title="Verification queue"
              subtitle="Highest-value open actions"
              icon={<BookOpenCheck className="h-4 w-4" />}
              action={
                <Link to="/app/tasks">
                  <Button size="sm" variant="ghost">
                    All
                  </Button>
                </Link>
              }
            />
            <div className="divide-y divide-white/[0.05]">
              {openTasks.length === 0 ? (
                <div className="p-4">
                  <EmptyState
                    compact
                    icon={<ListChecks className="h-5 w-5" />}
                    title="Nothing outstanding"
                    description="Run an analysis to generate a verification checklist."
                  />
                </div>
              ) : (
                openTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-2.5 px-4 py-2.5">
                    <button
                      onClick={() => void completeTask(task)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border border-white/20 transition-colors hover:border-violet-brand hover:bg-violet-brand/30"
                      aria-label={`Mark “${task.title}” verified`}
                    />
                    <div className="min-w-0">
                      <p className="line-clamp-2 text-[11.5px] font-medium leading-snug text-slatey-200">{task.title}</p>
                      <div className="mt-1 flex items-center gap-1.5">
                        <Badge tone={task.priority === 'high' ? 'coral' : task.priority === 'medium' ? 'amber' : 'slate'}>
                          {task.priority}
                        </Badge>
                        <Link
                          to={`/app/session/${task.session_id}`}
                          className="truncate text-[10px] text-slatey-400 hover:text-ice"
                        >
                          {task.session_title.slice(0, 34)}
                        </Link>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Reading a status" icon={<TriangleAlert className="h-4 w-4" />} />
            <div className="space-y-2 p-4">
              {(Object.keys(STATUS_META) as Array<keyof typeof STATUS_META>).map((key) => (
                <Tooltip key={key} content={STATUS_META[key].description}>
                  <div className="flex w-full cursor-help items-start gap-2">
                    <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE_CLASS[STATUS_META[key].tone].dot)} />
                    <div>
                      <p className={cn('text-[11.5px] font-medium', TONE_CLASS[STATUS_META[key].tone].text)}>
                        {STATUS_META[key].label}
                      </p>
                    </div>
                  </div>
                </Tooltip>
              ))}
              <p className="border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-slatey-400">
                “Not found” always means not found in the sources reviewed here.
              </p>
            </div>
          </Card>
        </aside>
      </div>

      <p className="text-[10.5px] text-slatey-400">
        Workspace generated {formatDate(new Date().toISOString())} · evidence-first by design.
      </p>
    </div>
  )
}

export function DistributionBar({ summary, compact }: { summary: SessionSummary; compact?: boolean }) {
  const total = summary.total_requirements
  const segments = [
    { key: 'found', value: summary.found_requirements, tone: TONE_CLASS.emerald.solid, label: 'Found' },
    { key: 'partial', value: summary.partial_requirements, tone: TONE_CLASS.amber.solid, label: 'Partial' },
    { key: 'conflicting', value: summary.conflicting_requirements, tone: TONE_CLASS.coral.solid, label: 'Conflicting' },
    { key: 'outdated', value: summary.outdated_requirements, tone: '#B9843A', label: 'Outdated' },
    { key: 'not_found', value: summary.not_found_requirements, tone: 'rgba(255,255,255,0.12)', label: 'Not found' },
  ]

  if (total === 0) {
    return (
      <div className={cn('h-1.5 w-full rounded-full bg-white/[0.07]', !compact && 'h-2')}>
        <div className="h-full w-full rounded-full bg-white/[0.03]" />
      </div>
    )
  }

  return (
    <div>
      <div className={cn('flex w-full overflow-hidden rounded-full bg-white/[0.05]', compact ? 'h-1.5' : 'h-2')}>
        {segments.map((s) =>
          s.value > 0 ? (
            <Tooltip key={s.key} content={`${s.label}: ${s.value} of ${total} requirements (${pct(s.value, total)}%)`}>
              <span
                className="h-full transition-[width] duration-500"
                style={{ width: `${(s.value / total) * 100}%`, background: s.tone }}
              />
            </Tooltip>
          ) : null,
        )}
      </div>
      {!compact ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
          {segments.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5 text-[9.5px] text-slatey-400">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.tone }} />
              {s.label} {s.value}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  )
}
