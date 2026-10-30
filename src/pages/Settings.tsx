import { useEffect, useState } from 'react'
import {
  CheckCircle2,
  CircleAlert,
  Database,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldCheck,
  UserRound,
  XCircle,
} from 'lucide-react'
import { useShellHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, Field, Input } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { useAuth } from '../hooks/useAuth'
import { fetchSystemStatus, type SystemStatus } from '../lib/api'
import { isSupabaseConfigured, SUPABASE_URL } from '../lib/supabase'
import { COVERAGE_WEIGHTS, STATUS_META, TONE_CLASS } from '../lib/status'
import { cn } from '../lib/utils'

export default function Settings() {
  const { email, isAuthenticated, signIn, signUp, signOut, loading: authLoading } = useAuth()
  const [status, setStatus] = useState<SystemStatus | null>(null)
  const [statusError, setStatusError] = useState<string | null>(null)
  const [checking, setChecking] = useState(true)
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authBusy, setAuthBusy] = useState(false)
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const toast = useToast()

  useShellHeader({ title: 'Settings', subtitle: 'Integration status, account and analytical transparency' })

  async function checkStatus() {
    setChecking(true)
    const result = await fetchSystemStatus()
    if (result.ok) {
      setStatus(result.data)
      setStatusError(null)
    } else {
      setStatusError(result.message)
      setStatus(null)
    }
    setChecking(false)
  }

  useEffect(() => {
    void checkStatus()
  }, [])

  async function submitAuth() {
    if (!authEmail.includes('@') || authPassword.length < 6) {
      toast.error('Check your details', 'Use a valid email and a password of at least 6 characters.')
      return
    }
    setAuthBusy(true)
    try {
      if (authMode === 'signup') await signUp(authEmail, authPassword)
      else await signIn(authEmail, authPassword)
      toast.success(authMode === 'signup' ? 'Account created' : 'Signed in')
      setAuthPassword('')
    } catch (err) {
      toast.error('Authentication failed', err instanceof Error ? err.message : undefined)
    } finally {
      setAuthBusy(false)
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      {/* ------------------------------------------------------- integrations */}
      <Card>
        <CardHeader
          title="Integration status"
          subtitle="Read live from the deployed backend — nothing here is assumed"
          icon={<Database className="h-4 w-4" />}
          action={
            <Button size="sm" variant="ghost" onClick={() => void checkStatus()} loading={checking}>
              <RefreshCw className="mr-1 h-3 w-3" /> Re-check
            </Button>
          }
        />
        <div className="divide-y divide-white/[0.05]">
          <StatusRow
            label="Supabase project"
            ok={isSupabaseConfigured}
            detail={SUPABASE_URL ? SUPABASE_URL.replace('https://', '') : 'not configured'}
            note="Browser client uses the publishable key only; Row Level Security scopes every row."
          />
          <StatusRow
            label="Gemini API key"
            ok={status?.gemini_configured ?? false}
            pending={checking}
            detail={
              checking
                ? 'checking…'
                : status?.gemini_configured
                  ? status?.gemini_model ?? 'configured'
                  : 'GEMINI_API_KEY secret not set'
            }
            note={
              status?.gemini_configured
                ? 'Gemini runs inside Supabase Edge Functions with structured JSON output.'
                : 'Without a key, the analysis falls back to a labelled heuristic engine. Findings are clearly marked as heuristic signals.'
            }
          />
          <StatusRow
            label="Extraction service (Trafilatura + PyMuPDF)"
            ok={status?.extraction_service_configured ?? false}
            pending={checking}
            detail={
              checking
                ? 'checking…'
                : status?.extraction_service_configured
                  ? status?.extraction_service_reachable === false
                    ? 'configured, but not reachable on last check'
                    : 'configured'
                  : 'EXTRACTION_SERVICE_URL secret not set'
            }
            note="Python dependencies cannot run inside Supabase Edge Functions, so extraction is delegated to the Vercel Python service. If it is unavailable, the Edge Function uses a clearly labelled Deno-native fallback."
          />
          <StatusRow
            label="Supabase Edge Functions"
            ok={Boolean(status)}
            pending={checking}
            detail={status ? 'extract-source · analyse · system-status' : statusError ? 'not reachable' : 'checking…'}
            note={
              statusError ??
              'Long extraction and analysis work is split into bounded stages, each writing an analysis_job row that the UI polls.'
            }
          />
        </div>
        {status?.notes && status.notes.length > 0 ? (
          <ul className="space-y-1 border-t border-white/[0.06] px-4 py-3">
            {status.notes.map((note) => (
              <li key={note} className="flex items-start gap-1.5 text-[11px] leading-relaxed text-slatey-400">
                <span className="mt-[6px] h-1 w-1 shrink-0 rounded-full bg-slatey-400" />
                {note}
              </li>
            ))}
          </ul>
        ) : null}
      </Card>

      {/* ------------------------------------------------------------ account */}
      <Card>
        <CardHeader
          title="Researcher account"
          subtitle="Optional. Guest sessions live in the shared demo workspace."
          icon={<UserRound className="h-4 w-4" />}
          action={isAuthenticated ? <Badge tone="emerald">Signed in</Badge> : <Badge tone="slate">Guest</Badge>}
        />
        <div className="p-5">
          {authLoading ? (
            <div className="flex items-center gap-2 text-[12px] text-slatey-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking session…
            </div>
          ) : isAuthenticated ? (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] text-white">{email}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-slatey-400">
                  Sessions created while signed in are private to this account under Row Level Security.
                </p>
              </div>
              <Button variant="danger" size="sm" onClick={() => void signOut()} icon={<LogOut className="h-3.5 w-3.5" />}>
                Sign out
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-ink-950/50 p-1 sm:w-fit">
                {(['signin', 'signup'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setAuthMode(m)}
                    className={cn(
                      'rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors',
                      authMode === m ? 'bg-white/[0.09] text-white' : 'text-slatey-400 hover:text-slatey-200',
                    )}
                  >
                    {m === 'signin' ? 'Sign in' : 'Create account'}
                  </button>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
                <Field label="Email" htmlFor="auth-email">
                  <Input
                    id="auth-email"
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                  />
                </Field>
                <Field label="Password" htmlFor="auth-password" hint="At least 6 characters.">
                  <Input
                    id="auth-password"
                    type="password"
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder="••••••••"
                    autoComplete={authMode === 'signup' ? 'new-password' : 'current-password'}
                  />
                </Field>
                <Button variant="primary" onClick={() => void submitAuth()} loading={authBusy} icon={<KeyRound className="h-3.5 w-3.5" />}>
                  {authMode === 'signin' ? 'Sign in' : 'Create'}
                </Button>
              </div>
              <p className="text-[10.5px] leading-relaxed text-slatey-400">
                Email confirmation is disabled on this project so the demo works without an inbox. In production, enable
                confirmation and configure SMTP.
              </p>
            </div>
          )}
        </div>
      </Card>

      {/* ----------------------------------------------------- transparency */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="How statuses are derived" icon={<ShieldCheck className="h-4 w-4" />} />
          <div className="space-y-2 p-4">
            {(['found', 'partial', 'conflicting', 'outdated', 'not_found'] as const).map((key) => (
              <div key={key} className="flex items-start gap-2">
                <span className={cn('mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full', TONE_CLASS[STATUS_META[key].tone].dot)} />
                <div>
                  <p className={cn('text-[11.5px] font-medium', TONE_CLASS[STATUS_META[key].tone].text)}>
                    {STATUS_META[key].label}
                  </p>
                  <p className="text-[10.5px] leading-relaxed text-slatey-400">{STATUS_META[key].description}</p>
                </div>
              </div>
            ))}
            <p className="border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-slatey-400">
              Precedence: conflict → outdated (when unsupported) → found → partial → not found.
            </p>
          </div>
        </Card>

        <Card>
          <CardHeader title="Coverage score weights" icon={<CircleAlert className="h-4 w-4" />} />
          <div className="space-y-2 p-4">
            <p className="font-mono text-[10.5px] leading-relaxed text-slatey-300">
              Σ(status credit × importance) ÷ Σ(importance) × 100
            </p>
            {(['found', 'partial', 'outdated', 'conflicting', 'not_found'] as const).map((key) => (
              <div key={key} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slatey-300">{STATUS_META[key].short}</span>
                <div className="flex flex-1 items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${COVERAGE_WEIGHTS[key] * 100}%`,
                        background: TONE_CLASS[STATUS_META[key].tone].solid,
                      }}
                    />
                  </div>
                  <span className="w-8 text-right tabular-nums text-slatey-400">×{COVERAGE_WEIGHTS[key]}</span>
                </div>
              </div>
            ))}
            <p className="border-t border-white/[0.06] pt-2 text-[10px] leading-relaxed text-slatey-400">
              Importance weights: high ×3, medium ×2, low ×1. The score only describes the sources reviewed in this
              session.
            </p>
          </div>
        </Card>
      </div>

      {/* -------------------------------------------------------- security */}
      <Card>
        <CardHeader title="Security model" icon={<ShieldCheck className="h-4 w-4" />} />
        <ul className="space-y-2 p-4">
          {[
            'The browser only ever holds the Supabase publishable key. Row Level Security scopes every table to the signed-in owner or the shared guest workspace.',
            'The Gemini API key and the service-role key live in Supabase Edge Function secrets and are never sent to the browser.',
            'Uploaded PDFs are stored in a private Storage bucket; the app issues short-lived signed URLs on demand.',
            'URLs and files are validated for scheme, size and private-network targets before any fetch or upload.',
            'Every notable finding references evidence that references a source chunk, page and publication date.',
          ].map((line) => (
            <li key={line} className="flex items-start gap-2 text-[11.5px] leading-relaxed text-slatey-300">
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-muted" />
              {line}
            </li>
          ))}
        </ul>
      </Card>
    </div>
  )
}

function StatusRow({
  label,
  ok,
  pending,
  detail,
  note,
}: {
  label: string
  ok: boolean
  pending?: boolean
  detail: string
  note?: string
}) {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <span className="mt-0.5">
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin text-slatey-400" />
        ) : ok ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-muted" />
        ) : (
          <XCircle className="h-4 w-4 text-amber-warm" />
        )}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[12.5px] font-medium text-slatey-100">{label}</p>
          <Badge tone={pending ? 'slate' : ok ? 'emerald' : 'amber'}>{pending ? 'checking' : ok ? 'ready' : 'not configured'}</Badge>
        </div>
        <p className="mt-0.5 break-all font-mono text-[10.5px] text-slatey-400">{detail}</p>
        {note ? <p className="mt-1 text-[10.5px] leading-relaxed text-slatey-400">{note}</p> : null}
      </div>
    </div>
  )
}
