import { Link } from 'react-router-dom'
import type { ReactNode } from 'react'
import {
  CircleDashed,
  FileStack,
  GitCompareArrows,
  ListChecks,
  ShieldQuestion,
  Target,
} from 'lucide-react'
import { cn } from '../../lib/utils'
import type { SessionStats } from '../../lib/stats'

interface StatDef {
  key: string
  label: string
  value: number | string
  caption: string
  icon: ReactNode
  accent: string
  href?: string
}

export function StatCards({ stats, sessionId }: { stats: SessionStats; sessionId: string }) {
  const items: StatDef[] = [
    {
      key: 'sources',
      label: 'Sources reviewed',
      value: stats.totalSources,
      caption:
        stats.totalSources === 0
          ? 'No sources added yet'
          : `${stats.processedSources} processed · ${stats.failedSources} failed`,
      icon: <FileStack className="h-4 w-4" />,
      accent: 'text-ice',
      href: '?tab=sources',
    },
    {
      key: 'requirements',
      label: 'Requirements identified',
      value: stats.totalRequirements,
      caption: stats.totalRequirements === 0 ? 'Decomposition not run yet' : 'Generated from the objective',
      icon: <Target className="h-4 w-4" />,
      accent: 'text-violet-soft',
    },
    {
      key: 'supported',
      label: 'Evidence-backed',
      value: stats.found,
      caption: `${stats.evidenceCount} linked excerpts in total`,
      icon: <ShieldQuestion className="h-4 w-4" />,
      accent: 'text-emerald-muted',
      href: '?tab=requirements&status=found',
    },
    {
      key: 'gaps',
      label: 'Potential gaps',
      value: Math.max(stats.notFound, stats.gaps),
      caption: 'Not established by reviewed evidence',
      icon: <CircleDashed className="h-4 w-4" />,
      accent: 'text-violet-soft',
      href: '?tab=findings&kind=gap',
    },
    {
      key: 'conflicts',
      label: 'Possible conflicts',
      value: stats.conflicts,
      caption: stats.conflicting > 0 ? `${stats.conflicting} requirement(s) affected` : 'No inconsistencies flagged',
      icon: <GitCompareArrows className="h-4 w-4" />,
      accent: 'text-coral-soft',
      href: '?tab=findings&kind=conflict',
    },
    {
      key: 'tasks',
      label: 'Items to verify',
      value: Math.max(0, stats.tasksTotal - stats.tasksDone),
      caption: `${stats.tasksDone}/${stats.tasksTotal} checklist items complete`,
      icon: <ListChecks className="h-4 w-4" />,
      accent: 'text-amber-warm',
      href: '?tab=checklist',
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
      {items.map((item) => {
        const inner = (
          <>
            <div className="flex items-start justify-between">
              <span className={cn('rounded-lg border border-white/[0.08] bg-white/[0.03] p-1.5', item.accent)}>
                {item.icon}
              </span>
              <span className="font-display text-[26px] font-semibold leading-none tabular-nums text-white">
                {item.value}
              </span>
            </div>
            <p className="mt-3 text-[12px] font-medium leading-tight text-slatey-200">{item.label}</p>
            <p className="mt-1 line-clamp-2 text-[10.5px] leading-relaxed text-slatey-400">{item.caption}</p>
          </>
        )
        const base = 'surface group px-3.5 py-3 text-left transition-all'
        return item.href ? (
          <Link
            key={item.key}
            to={`/app/session/${sessionId}${item.href}`}
            className={cn(base, 'hover:border-white/[0.15] hover:bg-ink-900/90')}
          >
            {inner}
          </Link>
        ) : (
          <div key={item.key} className={base}>
            {inner}
          </div>
        )
      })}
    </div>
  )
}
