import { AlertTriangle, Check, CircleDashed, Loader2, Minus, Sparkles, X } from 'lucide-react'
import type { PipelineStep } from '../../hooks/useAnalysisRunner'
import { cn } from '../../lib/utils'
import { Badge, Button, ProgressBar } from '../ui/primitives'

export function AnalysisProgress({
  steps,
  running,
  error,
  engine,
  onRun,
  onDismiss,
  label = 'Run analysis',
  disabled,
}: {
  steps: PipelineStep[]
  running: boolean
  error?: string | null
  engine?: string | null
  onRun: () => void
  onDismiss?: () => void
  label?: string
  disabled?: boolean
}) {
  const completed = steps.filter((s) => s.state === 'done' || s.state === 'skipped').length
  const pct = Math.round((completed / steps.length) * 100)
  const failed = steps.some((s) => s.state === 'failed')
  const active = steps.find((s) => s.state === 'active')

  return (
    <div className="surface overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border',
              failed
                ? 'border-coral-soft/30 bg-coral-soft/10 text-coral-soft'
                : running
                  ? 'border-violet-brand/30 bg-violet-brand/10 text-violet-soft'
                  : 'border-white/10 bg-white/[0.03] text-slatey-300',
            )}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : failed ? <AlertTriangle className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium text-white">
              {running ? active?.label ?? 'Analysing…' : failed ? 'Analysis stopped early' : 'Analysis pipeline'}
            </p>
            <p className="truncate text-[11px] text-slatey-400">
              {running
                ? active?.detail ?? 'Working through the evidence…'
                : engine
                  ? `Last run used the ${engine} engine · ${completed}/${steps.length} stages complete`
                  : `${completed}/${steps.length} stages complete`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {engine ? <Badge tone={engine === 'gemini' ? 'violet' : 'amber'}>{engine === 'gemini' ? 'Gemini analysis' : `${engine} engine`}</Badge> : null}
          <Button variant="primary" size="sm" onClick={onRun} loading={running} disabled={disabled}>
            {running ? 'Running…' : label}
          </Button>
          {onDismiss && !running ? (
            <button onClick={onDismiss} className="rounded p-1 text-slatey-400 hover:text-white" aria-label="Hide pipeline details">
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-4">
        <ProgressBar value={running ? Math.max(pct, 8) : pct} tone={failed ? 'coral' : pct === 100 ? 'emerald' : 'violet'} />
      </div>

      <ol className="grid gap-x-4 gap-y-1.5 px-4 pb-3 pt-3 sm:grid-cols-2 xl:grid-cols-5">
        {steps.map((step, i) => {
          const icon =
            step.state === 'done' ? (
              <Check className="h-3 w-3" />
            ) : step.state === 'active' ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : step.state === 'failed' ? (
              <X className="h-3 w-3" />
            ) : step.state === 'skipped' ? (
              <Minus className="h-3 w-3" />
            ) : (
              <CircleDashed className="h-3 w-3" />
            )
          const tone =
            step.state === 'done'
              ? 'border-emerald-muted/30 bg-emerald-muted/10 text-emerald-muted'
              : step.state === 'active'
                ? 'border-violet-brand/40 bg-violet-brand/12 text-violet-soft'
                : step.state === 'failed'
                  ? 'border-coral-soft/30 bg-coral-soft/10 text-coral-soft'
                  : 'border-white/10 bg-white/[0.03] text-slatey-400'

          return (
            <li key={step.key} className="flex items-start gap-2">
              <span className={cn('mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border', tone)}>
                {icon}
              </span>
              <div className="min-w-0">
                <p className={cn('truncate text-[11px] font-medium', step.state === 'pending' ? 'text-slatey-400' : 'text-slatey-200')}>
                  <span className="mr-1 text-slatey-400/70">{i + 1}.</span>
                  {step.label}
                </p>
                {step.message ? (
                  <p className="mt-0.5 line-clamp-2 text-[10px] leading-relaxed text-slatey-400">{step.message}</p>
                ) : null}
              </div>
            </li>
          )
        })}
      </ol>

      {error ? (
        <div className="border-t border-coral-soft/20 bg-coral-soft/[0.06] px-4 py-2.5">
          <p className="text-[11px] leading-relaxed text-coral-soft">{error}</p>
        </div>
      ) : null}
    </div>
  )
}
