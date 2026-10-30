import { cn } from '../lib/utils'

/**
 * The mark: a light source with a dark spot at its core — the unexamined gap.
 */
export function BrandMark({ className, size = 28 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      className={className}
      role="img"
      aria-label="Digital Dark Spot"
    >
      <defs>
        <linearGradient id="dds-grad" x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7C5CFF" />
          <stop offset="1" stopColor="#4FD1E5" />
        </linearGradient>
        <mask id="dds-mask">
          <rect width="64" height="64" fill="black" />
          <circle cx="30" cy="32" r="19" fill="white" />
          <circle cx="40" cy="26" r="13.5" fill="black" />
        </mask>
      </defs>
      <circle cx="30" cy="32" r="19" fill="url(#dds-grad)" mask="url(#dds-mask)" />
      <circle cx="40" cy="26" r="4.6" fill="#070A14" stroke="url(#dds-grad)" strokeWidth="1.4" />
      <circle cx="40" cy="26" r="1.6" fill="#4FD1E5" />
    </svg>
  )
}

export function BrandLockup({
  className,
  compact,
  size = 26,
}: {
  className?: string
  compact?: boolean
  size?: number
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <BrandMark size={size} />
      {!compact && (
        <div className="leading-none">
          <p className="font-display text-[13.5px] font-semibold tracking-[-0.01em] text-white">
            Digital Dark Spot
          </p>
          <p className="mt-1 text-[9.5px] font-medium uppercase tracking-[0.18em] text-slatey-400">
            Information Completeness
          </p>
        </div>
      )}
    </div>
  )
}
