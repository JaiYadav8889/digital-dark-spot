import { Info } from 'lucide-react'
import { ORIGIN_META, type OriginCategory } from '../../lib/status'
import { cn } from '../../lib/utils'
import { Badge } from '../ui/primitives'
import { Tooltip } from '../ui/overlay'

/**
 * The provenance of a source, excerpt or finding, always shown as a numbered
 * category. The number matters: an uploaded document is category 1 and is
 * never allowed to look like a live retrieval (category 2).
 */
export function OriginBadge({
  category,
  className,
  showLabel = true,
}: {
  category: OriginCategory
  className?: string
  showLabel?: boolean
}) {
  const meta = ORIGIN_META[category]
  return (
    <Tooltip content={meta.description}>
      <Badge tone={meta.tone} className={cn('font-normal', className)}>
        <span className="font-mono text-[10px] opacity-70">{category}</span>
        {showLabel ? meta.short : null}
        <Info className="h-2.5 w-2.5 opacity-60" />
      </Badge>
    </Tooltip>
  )
}

/** The legend that explains the four categories in one place. */
export function ProvenanceLegend({ className }: { className?: string }) {
  const entries = [1, 2, 3, 4] as OriginCategory[]
  return (
    <div className={cn('grid gap-2 sm:grid-cols-2', className)}>
      {entries.map((entry) => {
        const meta = ORIGIN_META[entry]
        return (
          <div
            key={entry}
            className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2"
          >
            <span className="mt-[3px] font-mono text-[10px] text-slatey-400/70">{entry}</span>
            <div className="min-w-0">
              <p className="text-[11.5px] font-medium text-slatey-200">{meta.label}</p>
              <p className="mt-0.5 text-[10.5px] leading-relaxed text-slatey-400">{meta.description}</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}
