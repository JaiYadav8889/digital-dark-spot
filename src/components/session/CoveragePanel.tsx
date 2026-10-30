import { useMemo } from 'react'
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { ChartPie, Info } from 'lucide-react'
import { Card, CardHeader, EmptyState } from '../ui/primitives'
import { Tooltip } from '../ui/overlay'
import { COVERAGE_WEIGHTS, STATUS_META, STATUS_ORDER, TONE_CLASS } from '../../lib/status'
import type { CoverageResult } from '../../lib/status'
import type { RequirementWithStatus } from '../../lib/types'
import { cn, truncate } from '../../lib/utils'

function FormulaTooltip() {
  return (
    <div className="space-y-2">
      <p className="font-medium text-white">How this score is calculated</p>
      <p className="font-mono text-[10.5px] leading-relaxed text-slatey-300">
        Σ(status credit × importance) ÷ Σ(importance) × 100
      </p>
      <ul className="space-y-1">
        <li>Found: 1.0 credit</li>
        <li>Partially supported: 0.5</li>
        <li>Potentially outdated: 0.4</li>
        <li>Conflicting: 0.25</li>
        <li>Not found in reviewed sources: 0</li>
      </ul>
      <p>Importance weights: high ×3, medium ×2, low ×1.</p>
      <p className="text-slatey-400">
        It describes only the sources reviewed in this session — not the completeness of the internet.
      </p>
    </div>
  )
}

export function CoveragePanel({
  coverage,
  requirements,
}: {
  coverage: CoverageResult
  requirements: RequirementWithStatus[]
}) {
  const donutData = useMemo(
    () =>
      STATUS_ORDER.map((status) => ({
        status,
        name: STATUS_META[status].short,
        value: coverage.byStatus[status],
        fill: TONE_CLASS[STATUS_META[status].tone].solid,
      })).filter((d) => d.value > 0),
    [coverage],
  )

  const barData = useMemo(
    () =>
      requirements
        .filter((r) => r.supports + r.partial + r.conflicts + r.outdated > 0 || r.status === 'not_found')
        .slice(0, 11)
        .map((r) => ({
          name: r.code,
          label: truncate(r.description, 34),
          supports: r.supports,
          partial: r.partial,
          conflicts: r.conflicts,
          outdated: r.outdated,
          status: r.status,
        })),
    [requirements],
  )

  if (requirements.length === 0) {
    return (
      <Card>
        <CardHeader title="Information coverage" icon={<ChartPie className="h-4 w-4" />} />
        <div className="p-5">
          <EmptyState
            compact
            title="Coverage appears once requirements exist"
            description="Run requirement decomposition to see which parts of the objective the evidence actually settles."
          />
        </div>
      </Card>
    )
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <Card>
        <CardHeader
          title="Information coverage"
          subtitle="Requirement status distribution"
          icon={<ChartPie className="h-4 w-4" />}
          action={
            <Tooltip content={<FormulaTooltip />}>
              <span className="flex h-6 w-6 items-center justify-center rounded-md text-slatey-400 hover:text-violet-soft">
                <Info className="h-4 w-4" />
              </span>
            </Tooltip>
          }
        />
        <div className="flex items-center gap-4 p-4">
          <div className="relative h-[152px] w-[152px] shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={52}
                  outerRadius={72}
                  paddingAngle={donutData.length > 1 ? 3 : 0}
                  stroke="none"
                  isAnimationActive
                  animationDuration={650}
                >
                  {donutData.map((entry) => (
                    <Cell key={entry.status} fill={entry.fill} fillOpacity={0.85} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{
                    background: '#0D1220',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    fontSize: 11,
                    color: '#C8CEDC',
                  }}
                  itemStyle={{ color: '#C8CEDC' }}
                  formatter={(value: number, name: string) => [`${value} requirement(s)`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-display text-2xl font-semibold tabular-nums text-white">
                {coverage.score ?? '—'}
                <span className="text-sm text-slatey-400">%</span>
              </span>
              <span className="mt-0.5 text-[9.5px] uppercase tracking-[0.12em] text-slatey-400">weighted</span>
            </div>
          </div>

          <ul className="min-w-0 flex-1 space-y-1.5">
            {STATUS_ORDER.map((status) => {
              const meta = STATUS_META[status]
              const count = coverage.byStatus[status]
              return (
                <li key={status} className="flex items-center gap-2">
                  <span className={cn('h-2 w-2 shrink-0 rounded-sm', TONE_CLASS[meta.tone].dot)} />
                  <span className={cn('min-w-0 flex-1 truncate text-[11.5px]', count > 0 ? 'text-slatey-200' : 'text-slatey-400/70')}>
                    {meta.short}
                  </span>
                  <span className="text-[11.5px] font-medium tabular-nums text-slatey-300">{count}</span>
                  <span className="w-8 text-right text-[10px] tabular-nums text-slatey-400">
                    ×{COVERAGE_WEIGHTS[status]}
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
        <p className="border-t border-white/[0.06] px-4 py-2.5 text-[10.5px] leading-relaxed text-slatey-400">
          {coverage.needsVerification} of {coverage.total} requirements still need verification. A coverage score is
          never a statement about information that exists elsewhere.
        </p>
      </Card>

      <Card>
        <CardHeader
          title="Evidence by requirement"
          subtitle="Excerpts linked to each requirement, by relationship"
          icon={<ChartPie className="h-4 w-4" />}
        />
        <div className="px-2 pb-3 pt-4">
          {barData.length === 0 ? (
            <div className="px-3 py-6">
              <EmptyState compact title="No evidence linked yet" description="Evidence mapping has not produced links for this session." />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={Math.min(300, Math.max(140, barData.length * 30))}>
              <BarChart data={barData} layout="vertical" margin={{ left: 4, right: 12, top: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={38}
                  tick={{ fill: '#8791A8', fontSize: 10.5 }}
                  axisLine={false}
                  tickLine={false}
                />
                <RechartsTooltip
                  cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                  contentStyle={{
                    background: '#0D1220',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 10,
                    fontSize: 11,
                    color: '#C8CEDC',
                  }}
                  formatter={(value: number, name: string) => {
                    const labels: Record<string, string> = {
                      supports: 'Supporting',
                      partial: 'Partial',
                      conflicts: 'Conflicting',
                      outdated: 'Outdated',
                    }
                    return [`${value} excerpt(s)`, labels[name] ?? name]
                  }}
                  labelFormatter={(label: string) => {
                    const row = barData.find((d) => d.name === label)
                    return row ? `${label} · ${row.label}` : label
                  }}
                />
                <Bar dataKey="supports" stackId="a" fill={TONE_CLASS.emerald.solid} radius={[0, 0, 0, 0]} barSize={12} />
                <Bar dataKey="partial" stackId="a" fill={TONE_CLASS.amber.solid} barSize={12} />
                <Bar dataKey="conflicts" stackId="a" fill={TONE_CLASS.coral.solid} barSize={12} />
                <Bar dataKey="outdated" stackId="a" fill="#B9843A" radius={[0, 3, 3, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-white/[0.06] px-4 py-2.5">
          {[
            { label: 'Supporting', color: TONE_CLASS.emerald.solid },
            { label: 'Partial', color: TONE_CLASS.amber.solid },
            { label: 'Conflicting', color: TONE_CLASS.coral.solid },
            { label: 'Outdated', color: '#B9843A' },
          ].map((l) => (
            <span key={l.label} className="flex items-center gap-1.5 text-[10px] text-slatey-400">
              <span className="h-1.5 w-1.5 rounded-full" style={{ background: l.color }} />
              {l.label}
            </span>
          ))}
        </div>
      </Card>
    </div>
  )
}
