import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Info, X } from 'lucide-react'
import { cn } from '../../lib/utils'
import { IconButton } from './primitives'

// ----------------------------------------------------------------- Tooltip

export function Tooltip({
  content,
  children,
  side = 'top',
  className,
}: {
  content: ReactNode
  children: ReactNode
  side?: 'top' | 'bottom' | 'left' | 'right'
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const id = useRef(`tt-${Math.random().toString(36).slice(2, 8)}`).current

  return (
    <span
      className={cn('relative inline-flex', className)}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
      aria-describedby={open ? id : undefined}
    >
      {children}
      {open ? (
        <span
          role="tooltip"
          id={id}
          className={cn(
            'pointer-events-none absolute z-50 w-64 rounded-lg border border-white/10 bg-ink-800 px-3 py-2 text-left text-[11.5px] font-normal leading-relaxed text-slatey-300 shadow-lift animate-fade-in',
            side === 'top' && 'bottom-full left-1/2 mb-2 -translate-x-1/2',
            side === 'bottom' && 'top-full left-1/2 mt-2 -translate-x-1/2',
            side === 'left' && 'right-full top-1/2 mr-2 -translate-y-1/2',
            side === 'right' && 'left-full top-1/2 ml-2 -translate-y-1/2',
          )}
        >
          {content}
        </span>
      ) : null}
    </span>
  )
}

export function InfoTooltip({ content, label }: { content: ReactNode; label?: string }) {
  return (
    <Tooltip content={content}>
      <button
        type="button"
        aria-label={label ?? 'More information'}
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-slatey-400 transition-colors hover:text-violet-soft"
      >
        <Info className="h-3.5 w-3.5" />
      </button>
    </Tooltip>
  )
}

// ----------------------------------------------------------------- Modal

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 sm:items-center sm:p-6">
      <div
        className="absolute inset-0 bg-ink-950/80 backdrop-blur-sm animate-fade-in"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cn(
          'relative z-10 max-h-[92vh] w-full overflow-hidden rounded-t-2xl border border-white/10 bg-ink-900 shadow-lift animate-fade-up sm:rounded-2xl',
          size === 'sm' && 'sm:max-w-md',
          size === 'md' && 'sm:max-w-xl',
          size === 'lg' && 'sm:max-w-3xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div>
            <h2 className="font-display text-base font-semibold text-white">{title}</h2>
            {description ? <p className="mt-1 text-xs leading-relaxed text-slatey-400">{description}</p> : null}
          </div>
          <IconButton label="Close dialog" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="max-h-[calc(92vh-9rem)] overflow-y-auto px-5 py-4">{children}</div>
        {footer ? (
          <div className="flex items-center justify-end gap-2 border-t border-white/[0.07] bg-ink-950/40 px-5 py-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
  )
}

// ----------------------------------------------------------------- Drawer

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
  footer,
  width = 'lg',
}: {
  open: boolean
  onClose: () => void
  title: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  width?: 'md' | 'lg' | 'xl'
}) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    panelRef.current?.focus()
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-ink-950/70 backdrop-blur-sm animate-fade-in" onClick={onClose} aria-hidden />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className={cn(
          'absolute right-0 top-0 flex h-full w-full flex-col border-l border-white/10 bg-ink-900 shadow-lift animate-fade-in focus:outline-none',
          width === 'md' && 'sm:max-w-lg',
          width === 'lg' && 'sm:max-w-2xl',
          width === 'xl' && 'sm:max-w-4xl',
        )}
      >
        <div className="flex items-start justify-between gap-4 border-b border-white/[0.07] px-5 py-4">
          <div className="min-w-0">{typeof title === 'string' ? <h2 className="font-display text-base font-semibold text-white">{title}</h2> : title}
            {subtitle ? <div className="mt-1 text-xs leading-relaxed text-slatey-400">{subtitle}</div> : null}
          </div>
          <IconButton label="Close panel" onClick={onClose}>
            <X className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer ? <div className="border-t border-white/[0.07] bg-ink-950/40 px-5 py-3">{footer}</div> : null}
      </div>
    </div>,
    document.body,
  )
}

// ----------------------------------------------------------------- useDismiss

export function useOutsideDismiss(onDismiss: () => void, active: boolean) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!active) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onDismiss()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [active, onDismiss])
  return ref
}

export function useCopyToClipboard() {
  const [copied, setCopied] = useState(false)
  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1600)
      return true
    } catch {
      return false
    }
  }, [])
  return { copied, copy }
}
