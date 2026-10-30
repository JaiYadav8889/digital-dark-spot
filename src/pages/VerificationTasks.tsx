import { useEffect, useMemo, useState } from 'react'
import { ClipboardList, Search, TriangleAlert } from 'lucide-react'
import { useShellHeader } from '../components/layout/AppShell'
import { ChecklistPanel } from '../components/session/ChecklistPanel'
import { EmptyState, Input, Segmented, Skeleton } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { listAllTasks, toggleChecklistItem, type TaskRow } from '../lib/api'
import { pct } from '../lib/utils'

export default function VerificationTasks() {
  const [tasks, setTasks] = useState<TaskRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [scope, setScope] = useState<'all' | 'high' | 'session'>('all')
  const toast = useToast()

  useShellHeader({ title: 'Verification tasks', subtitle: 'What to confirm before relying on the reviewed information' })

  useEffect(() => {
    listAllTasks()
      .then(setTasks)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load verification tasks.'))
      .finally(() => setLoading(false))
  }, [])

  const sessionTitles = useMemo(() => {
    const map = new Map<string, string>()
    tasks.forEach((t) => map.set(t.session_id, t.session_title))
    return map
  }, [tasks])

  const visible = useMemo(() => {
    let list = tasks
    if (scope === 'high') list = list.filter((t) => t.priority === 'high')
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (t) => t.title.toLowerCase().includes(q) || t.session_title.toLowerCase().includes(q) || (t.why_it_matters ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [tasks, scope, query])

  async function handleToggle(id: string, completed: boolean) {
    const previous = tasks
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)))
    try {
      await toggleChecklistItem(id, completed)
    } catch (err) {
      setTasks(previous)
      toast.error('Could not update the task', err instanceof Error ? err.message : undefined)
    }
  }

  const done = tasks.filter((t) => t.completed).length

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl space-y-3">
        <Skeleton className="h-24" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-16" />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-coral-soft/25 bg-coral-soft/[0.07] px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral-soft" />
          <p className="text-[11.5px] text-slatey-300">{error}</p>
        </div>
      ) : null}

      <div className="surface flex flex-wrap items-end justify-between gap-3 px-4 py-3.5">
        <div>
          <p className="label">Across all sessions</p>
          <p className="mt-1 font-display text-2xl font-semibold tabular-nums text-white">
            {done}
            <span className="text-base text-slatey-400">/{tasks.length}</span>
            <span className="ml-2 text-sm font-normal text-slatey-400">verified ({pct(done, tasks.length)}%)</span>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmented
            size="sm"
            value={scope}
            onChange={(v) => setScope(v as typeof scope)}
            options={[
              { value: 'all', label: 'All', count: tasks.length },
              { value: 'high', label: 'High priority', count: tasks.filter((t) => t.priority === 'high').length },
              { value: 'session', label: 'Grouped by session', count: sessionTitles.size },
            ]}
          />
          <div className="relative w-full sm:w-52">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slatey-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search tasks…"
              className="h-8 pl-8 text-[12px]"
              aria-label="Search verification tasks"
            />
          </div>
        </div>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          icon={<ClipboardList className="h-5 w-5" />}
          title="No verification tasks yet"
          description="Checklist items are generated from the findings of a completed analysis. Open a session and run the analysis to create them."
        />
      ) : scope === 'session' ? (
        <div className="space-y-5">
          {Array.from(sessionTitles.entries()).map(([id, title]) => {
            const items = visible.filter((t) => t.session_id === id)
            if (items.length === 0) return null
            return (
              <section key={id} className="space-y-2">
                <h3 className="font-display text-[13px] font-semibold text-white">{title}</h3>
                <ChecklistPanel items={items} onToggle={(itemId, v) => void handleToggle(itemId, v)} />
              </section>
            )
          })}
        </div>
      ) : (
        <ChecklistPanel
          items={visible}
          onToggle={(id, v) => void handleToggle(id, v)}
          showSessionLink
          sessionTitles={sessionTitles}
        />
      )}
    </div>
  )
}
