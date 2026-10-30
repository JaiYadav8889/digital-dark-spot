import { FileText, Globe, CircleDashed, Library, Scale } from 'lucide-react'
import { TONE_CLASS } from '../../lib/status'

const FRAGMENTS = [
  { icon: FileText, label: 'Guideline PDF', meta: '12 pages · 2022' },
  { icon: Globe, label: 'Scheme page', meta: 'dates unclear' },
  { icon: Scale, label: 'Parliament record', meta: 'figures only' },
]

const ROWS = [
  { label: 'Deadline', cells: ['found', 'conflict', 'settled'] },
  { label: 'Amount', cells: ['found', 'outdated', 'settled'] },
  { label: 'Renewal', cells: ['partial', 'gap', 'settled'] },
]

const CELL_STYLE: Record<string, string> = {
  found: 'bg-emerald-muted/70',
  partial: 'bg-amber-warm/70',
  conflict: 'bg-coral-soft/80',
  outdated: 'bg-amber-warm/40',
  gap: 'border border-dashed border-violet-soft/60 bg-violet-soft/[0.06]',
  settled: 'bg-white/[0.07]',
}

export function EvidenceMapIllustration() {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute -inset-6 rounded-[2rem] bg-violet-brand/[0.07] blur-2xl" aria-hidden />

      <div className="surface-raised relative overflow-hidden p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-white/[0.07] pb-3">
          <div className="flex items-center gap-2 text-[11px] font-medium text-slatey-300">
            <Library className="h-3.5 w-3.5 text-violet-soft" />
            Fragments → evidence map
          </div>
          <span className="rounded-full border border-white/10 bg-white/[0.03] px-2 py-0.5 text-[10px] text-slatey-400">
            live model
          </span>
        </div>

        <div className="mt-4 flex items-stretch gap-2 sm:gap-3">
          {/* fragments */}
          <div className="flex w-[38%] flex-col justify-center gap-2">
            {FRAGMENTS.map((f, i) => {
              const Icon = f.icon
              return (
                <div
                  key={f.label}
                  className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-ink-950/60 px-2.5 py-2 transition-transform hover:-translate-y-0.5"
                  style={{ marginLeft: i === 1 ? 10 : i === 2 ? 4 : 0 }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0 text-slatey-400" />
                  <div className="min-w-0">
                    <p className="truncate text-[11px] font-medium text-slatey-200">{f.label}</p>
                    <p className="truncate text-[9.5px] text-slatey-400">{f.meta}</p>
                  </div>
                </div>
              )
            })}
          </div>

          {/* connections */}
          <div className="relative flex w-[13%] items-center justify-center">
            <svg viewBox="0 0 40 120" className="h-full w-full" fill="none" aria-hidden>
              <path d="M2 22C20 22 18 32 38 32" stroke="#4FD1E5" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="3 3" />
              <path d="M2 60C20 60 18 60 38 60" stroke="#7C5CFF" strokeOpacity="0.45" strokeWidth="1.2" strokeDasharray="3 3" />
              <path d="M2 98C20 98 18 88 38 88" stroke="#8791A8" strokeOpacity="0.35" strokeWidth="1.2" strokeDasharray="3 3" />
              <circle cx="38" cy="32" r="1.8" fill="#4FD1E5" fillOpacity="0.7" />
              <circle cx="38" cy="60" r="1.8" fill="#7C5CFF" fillOpacity="0.8" />
              <circle cx="38" cy="88" r="1.8" fill="#8791A8" fillOpacity="0.6" />
            </svg>
          </div>

          {/* map */}
          <div className="w-[49%] space-y-2">
            {ROWS.map((row) => (
              <div key={row.label} className="rounded-lg border border-white/[0.07] bg-ink-950/40 px-2 py-1.5">
                <div className="flex items-center justify-between">
                  <p className="text-[9.5px] font-medium uppercase tracking-[0.1em] text-slatey-400">{row.label}</p>
                </div>
                <div className="mt-1 flex items-center gap-1">
                  {row.cells.map((cell, idx) => (
                    <span
                      key={`${row.label}-${idx}`}
                      className={`relative h-2 flex-1 rounded-sm ${CELL_STYLE[cell]}`}
                      aria-hidden
                    >
                      {cell === 'gap' && (
                        <span className="absolute inset-0 rounded-sm ring-1 ring-violet-soft/40 animate-pulse-soft" />
                      )}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* dark spot callout */}
        <div className="mt-3 flex items-start gap-2.5 rounded-lg border border-violet-brand/20 bg-violet-brand/[0.06] px-3 py-2.5">
          <CircleDashed className="mt-0.5 h-3.5 w-3.5 shrink-0 text-violet-soft" />
          <p className="text-[10.5px] leading-relaxed text-slatey-300">
            <span className="font-medium text-white">Dark spot detected.</span> Renewal conditions were not found in
            the sources reviewed — that is a gap to close, not proof they do not exist.
          </p>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 border-t border-white/[0.07] pt-3">
          {[
            ['Found', 'emerald'],
            ['Partial', 'amber'],
            ['Conflicting', 'coral'],
            ['Not found', 'violet'],
          ].map(([label, tone]) => (
            <span key={label} className="flex items-center gap-1.5 text-[9.5px] text-slatey-400">
              <span className={`h-1.5 w-1.5 rounded-full ${TONE_CLASS[tone as keyof typeof TONE_CLASS].dot}`} />
              {label}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
