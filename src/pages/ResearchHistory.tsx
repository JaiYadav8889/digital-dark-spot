import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, History, Plus, Search, Trash2, TriangleAlert } from 'lucide-react'
import { SessionStatusBadge, useShellHeader } from '../components/layout/AppShell'
import { Badge, Button, EmptyState, Input, Segmented, Skeleton } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { deleteSession, listSessionSummaries } from '../lib/api'
import type { SessionSummary } from '../lib/types'
import { formatDate, pct, relativeTime } from '../lib/utils'
import { DistributionBar } from './Overview'

export default function ResearchHistory() {
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'ready' | 'in_progress'>('all')
  const toast = useToast()

  useShellHeader({ title: 'Research history', subtitle: 'Every session, with the state of its evidence map' })

  useEffect(() => {
    listSessionSummaries()
      .then(setSessions)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load sessions.'))
      .finally(() => setLoading(false))
  }, [])

  const rows = useMemo(() => {
    let list = sessions
    if (filter === 'ready') list = list.filter((s) => s.status === 'ready')
    if (filter === 'in_progress') list = list.filter((s) => s.status !== 'ready')
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter((s) => s.title.toLowerCase().includes(q) || (s.target_cycle ?? '').toLowerCase().includes(q))
    }
    return list
  }, [sessions, filter, query])

  async function handleDelete(session: SessionSummary) {
    if (!window.confirm(`Delete “${session.title}” with all its sources, evidence and findings? This cannot be undone.`)) return
    try {
      await deleteSession(session.session_id)
      setSessions((prev) => prev.filter((s) => s.session_id !== session.session_id))
      toast.success('Session deleted')
    } catch (err) {
      toast.error(
        'Could not delete this session',
        err instanceof Error ? err.message : 'Guest sessions cannot be deleted. Sign in to remove your own sessions.',
      )
    }
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-coral-soft/25 bg-coral-soft/[0.07] px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral-soft" />
          <p className="text-[11.5px] text-slatey-300">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={filter}
          onChange={(v) => setFilter(v as typeof filter)}
          options={[
            { value: 'all', label: 'All', count: sessions.length },
            { value: 'ready', label: 'Analysed', count: sessions.filter((s) => s.status === 'ready').length },
            { value: 'in_progress', label: 'In progress', count: sessions.filter((s) => s.status !== 'ready').length },
          ]}
        />
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slatey-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sessions…"
            className="h-8 pl-8 text-[12px]"
            aria-label="Search sessions"
          />
        </div>
        <Link to="/app/new">
          <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />}>
            New research
          </Button>
        </Link>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<History className="h-5 w-5" />}
          title={sessions.length === 0 ? 'No research sessions yet' : 'No sessions match this filter'}
          description={
            sessions.length === 0
              ? 'Your investigations will appear here with their coverage, gaps and open verification work.'
              : 'Try a different filter or clear the search.'
          }
          action={
            sessions.length === 0 ? (
              <Link to="/app/new">
                <Button size="sm" variant="primary" className="mt-1">
                  Start research
                </Button>
              </Link>
            ) : null
          }
        />
      ) : (
        <ul className="space-y-2.5">
          {rows.map((s) => (
            <li key={s.session_id} className="surface group p-4 transition-colors hover:border-white/[0.14]">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link
                      to={`/app/session/${s.session_id}`}
                      className="truncate font-display text-[14px] font-semibold text-white hover:text-violet-soft"
                    >
                      {s.title}
                    </Link>
                    <SessionStatusBadge status={s.status} />
                    {s.is_demo ? <Badge tone="amber">Demo</Badge> : null}
                    {s.target_cycle ? <Badge tone="ice">{s.target_cycle}</Badge> : null}
                  </div>
                  <p className="mt-1 text-[10.5px] text-slatey-400">
                    Created {formatDate(s.created_at)} · updated {relativeTime(s.updated_at)} ·{' '}
                    {s.analysis_engine ? `${s.analysis_engine} engine` : 'not analysed'}
                  </p>

                  <div className="mt-3 max-w-xl">
                    <DistributionBar summary={s} compact />
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-slatey-400">
                    <span>{s.total_sources} sources</span>
                    <span>{s.total_requirements} requirements</span>
                    <span className="text-emerald-muted">{s.found_requirements} found</span>
                    <span className="text-coral-soft">{s.open_conflicts} conflicts</span>
                    <span>{s.not_found_requirements} not found</span>
                    <span>
                      {s.total_tasks - s.open_tasks}/{s.total_tasks} verified (
                      {pct(s.total_tasks - s.open_tasks, s.total_tasks)}%)
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <Link to={`/app/session/${s.session_id}`}>
                    <Button size="sm" variant="secondary">
                      Open <ArrowUpRight className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                  <button
                    onClick={() => void handleDelete(s)}
                    className="rounded-lg p-2 text-slatey-400 transition-colors hover:bg-coral-soft/10 hover:text-coral-soft"
                    aria-label={`Delete ${s.title}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
