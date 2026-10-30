import { forwardRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { AlertTriangle, Check, Loader2 } from 'lucide-react'
import { cn } from '../../lib/utils'
import { TONE_CLASS, type Tone } from '../../lib/status'

// ----------------------------------------------------------------- Button

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline'
type ButtonSize = 'sm' | 'md' | 'lg'

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary:
    'bg-violet-brand text-white hover:bg-violet-soft active:bg-violet-deep shadow-[0_10px_30px_-14px_rgba(124,92,255,0.9)] disabled:bg-violet-brand/50',
  secondary:
    'bg-white/[0.06] text-white border border-white/10 hover:bg-white/[0.1] hover:border-white/20',
  ghost: 'text-slatey-300 hover:text-white hover:bg-white/[0.06]',
  danger: 'bg-coral-soft/15 text-coral-soft border border-coral-soft/30 hover:bg-coral-soft/25',
  outline: 'border border-white/12 text-slatey-200 hover:border-violet-brand/50 hover:text-white',
}

const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-[13px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-sm gap-2 rounded-lg',
  lg: 'h-12 px-6 text-[15px] gap-2.5 rounded-xl',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = 'secondary', size = 'md', loading, icon, children, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={cn(
        'inline-flex select-none items-center justify-center font-medium transition-all duration-150',
        'disabled:cursor-not-allowed disabled:opacity-60',
        BUTTON_VARIANTS[variant],
        BUTTON_SIZES[size],
        className,
      )}
      {...props}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : icon}
      {children}
    </button>
  )
})

export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { label: string; size?: 'sm' | 'md' }
>(function IconButton({ className, label, size = 'md', children, ...props }, ref) {
  return (
    <button
      ref={ref}
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center rounded-lg text-slatey-400 transition-colors',
        'hover:bg-white/[0.07] hover:text-white disabled:opacity-40',
        size === 'sm' ? 'h-7 w-7' : 'h-9 w-9',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  )
})

// ----------------------------------------------------------------- Surfaces

export function Card({
  className,
  children,
  interactive,
  ...rest
}: {
  className?: string
  children: ReactNode
  interactive?: boolean
} & React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'surface',
        interactive &&
          'transition-all duration-200 hover:border-white/[0.14] hover:bg-ink-900/90 hover:shadow-lift',
        className,
      )}
      {...rest}
    >
      {children}
    </div>
  )
}

export function CardHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: {
  title: ReactNode
  subtitle?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div className={cn('panel-header', className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-violet-soft">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="truncate font-display text-[15px] font-semibold text-white">{title}</h2>
          {subtitle ? <p className="mt-0.5 text-xs leading-relaxed text-slatey-400">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

// ----------------------------------------------------------------- Badges

export function Badge({
  children,
  tone = 'slate',
  className,
  dot,
  icon,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
  icon?: ReactNode
}) {
  const t = TONE_CLASS[tone]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium leading-5',
        t.bg,
        t.text,
        t.border,
        className,
      )}
    >
      {dot ? <span className={cn('h-1.5 w-1.5 rounded-full', t.dot)} aria-hidden /> : null}
      {icon}
      {children}
    </span>
  )
}

export function PriorityBadge({ importance }: { importance: 'high' | 'medium' | 'low' }) {
  const map = {
    high: { tone: 'coral' as Tone, label: 'High' },
    medium: { tone: 'amber' as Tone, label: 'Medium' },
    low: { tone: 'slate' as Tone, label: 'Low' },
  }[importance]
  return (
    <Badge tone={map.tone} dot>
      {map.label}
    </Badge>
  )
}

// ----------------------------------------------------------------- Inputs

const FIELD_BASE =
  'w-full rounded-lg border border-white/10 bg-ink-950/60 px-3 text-sm text-white placeholder:text-slatey-400/70 ' +
  'transition-colors focus:border-violet-brand/60 focus:bg-ink-950/80 focus:outline-none focus:ring-2 focus:ring-violet-brand/20'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function Input(
  { className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(FIELD_BASE, 'h-10', className)} {...props} />
})

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function Textarea({ className, ...props }, ref) {
    return <textarea ref={ref} className={cn(FIELD_BASE, 'min-h-[96px] resize-y py-2.5 leading-relaxed', className)} {...props} />
  },
)

export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(function Select(
  { className, children, ...props },
  ref,
) {
  return (
    <select ref={ref} className={cn(FIELD_BASE, 'h-10 cursor-pointer appearance-none pr-8', className)} {...props}>
      {children}
    </select>
  )
})

export function Field({
  label,
  hint,
  error,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string
  hint?: ReactNode
  error?: string | null
  required?: boolean
  children: ReactNode
  className?: string
  htmlFor?: string
}) {
  return (
    <div className={cn('space-y-1.5', className)}>
      <label htmlFor={htmlFor} className="flex items-center gap-1.5 text-[13px] font-medium text-slatey-200">
        {label}
        {required ? <span className="text-coral-soft">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-xs text-coral-soft">
          <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> {error}
        </p>
      ) : hint ? (
        <p className="text-xs leading-relaxed text-slatey-400">{hint}</p>
      ) : null}
    </div>
  )
}

export function Checkbox({
  checked,
  onChange,
  label,
  disabled,
  className,
}: {
  checked: boolean
  onChange: (v: boolean) => void
  label: ReactNode
  disabled?: boolean
  className?: string
}) {
  return (
    <label className={cn('group flex cursor-pointer items-start gap-2.5 text-sm', disabled && 'cursor-not-allowed opacity-60', className)}>
      <span className="relative mt-0.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center">
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="peer h-[18px] w-[18px] cursor-pointer appearance-none rounded-[5px] border border-white/20 bg-ink-950 transition-colors checked:border-violet-brand checked:bg-violet-brand focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-brand/40"
        />
        <Check className="pointer-events-none absolute h-3 w-3 scale-75 text-white opacity-0 transition-all peer-checked:scale-100 peer-checked:opacity-100" />
      </span>
      <span className="leading-relaxed">{label}</span>
    </label>
  )
}

// ----------------------------------------------------------------- Feedback

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton', className)} />
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-4 w-4 animate-spin text-violet-soft', className)} aria-hidden />
}

export function ProgressBar({
  value,
  tone = 'violet',
  className,
  label,
}: {
  value: number
  tone?: Tone
  className?: string
  label?: string
}) {
  const clamped = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className={cn('h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07]', className)}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div
        className="h-full rounded-full transition-[width] duration-700 ease-out"
        style={{ width: `${clamped}%`, background: TONE_CLASS[tone].solid }}
      />
    </div>
  )
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
  compact,
}: {
  icon?: ReactNode
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
  compact?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-dashed border-white/[0.09] bg-white/[0.015] text-center',
        compact ? 'gap-2 px-4 py-6' : 'gap-3 px-6 py-14',
        className,
      )}
    >
      {icon ? (
        <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-slatey-400">
          {icon}
        </span>
      ) : null}
      <div className="max-w-md space-y-1">
        <p className="font-display text-sm font-medium text-slatey-200">{title}</p>
        {description ? <p className="text-xs leading-relaxed text-slatey-400">{description}</p> : null}
      </div>
      {action}
    </div>
  )
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn('h-px w-full bg-white/[0.07]', className)} />
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = 'md',
}: {
  options: Array<{ value: T; label: ReactNode; count?: number }>
  value: T
  onChange: (v: T) => void
  className?: string
  size?: 'sm' | 'md'
}) {
  return (
    <div className={cn('inline-flex items-center gap-1 rounded-lg border border-white/[0.08] bg-ink-950/50 p-1', className)}>
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-medium transition-colors',
              size === 'sm' ? 'h-7 px-2.5 text-[12px]' : 'h-8 px-3 text-[13px]',
              active ? 'bg-white/[0.1] text-white' : 'text-slatey-400 hover:text-slatey-200',
            )}
            aria-pressed={active}
          >
            {opt.label}
            {typeof opt.count === 'number' ? (
              <span className={cn('rounded px-1 text-[10px] tabular-nums', active ? 'bg-white/10 text-white' : 'bg-white/[0.06] text-slatey-400')}>
                {opt.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}
