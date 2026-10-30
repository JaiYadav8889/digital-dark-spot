import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn, uid } from '../../lib/utils'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  tone: ToastTone
  title: string
  description?: string
}

interface ToastContextValue {
  toast: (input: { tone?: ToastTone; title: string; description?: string }) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE = {
  success: { icon: CheckCircle2, ring: 'border-emerald-muted/30', text: 'text-emerald-muted' },
  error: { icon: XCircle, ring: 'border-coral-soft/30', text: 'text-coral-soft' },
  info: { icon: Info, ring: 'border-ice/30', text: 'text-ice' },
  warning: { icon: AlertTriangle, ring: 'border-amber-warm/30', text: 'text-amber-warm' },
} as const

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const toast = useCallback(
    ({ tone = 'info', title, description }: { tone?: ToastTone; title: string; description?: string }) => {
      const id = uid()
      setToasts((prev) => [...prev.slice(-3), { id, tone, title, description }])
      window.setTimeout(() => dismiss(id), tone === 'error' ? 8000 : 4800)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      success: (title, description) => toast({ tone: 'success', title, description }),
      error: (title, description) => toast({ tone: 'error', title, description }),
      info: (title, description) => toast({ tone: 'info', title, description }),
    }),
    [toast],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-[200] flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2">
        {toasts.map((t) => {
          const meta = TONE[t.tone]
          const Icon = meta.icon
          return (
            <div
              key={t.id}
              role="status"
              className={cn(
                'pointer-events-auto flex items-start gap-3 rounded-xl border bg-ink-850/95 px-4 py-3 shadow-lift backdrop-blur animate-fade-up',
                meta.ring,
              )}
            >
              <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', meta.text)} aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-snug text-white">{t.title}</p>
                {t.description ? <p className="mt-0.5 text-xs leading-relaxed text-slatey-400">{t.description}</p> : null}
              </div>
              <button
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="-mr-1 -mt-1 rounded p-1 text-slatey-400 transition-colors hover:text-white"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}
