import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowRight,
  CircleDashed,
  FileSearch,
  GitCompareArrows,
  Layers,
  ListChecks,
  ScanSearch,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { BrandLockup } from '../components/BrandMark'
import { EvidenceMapIllustration } from '../components/landing/EvidenceMapIllustration'
import { Button } from '../components/ui/primitives'
import { listSessionSummaries } from '../lib/api'
import { isSupabaseConfigured } from '../lib/supabase'
import type { SessionSummary } from '../lib/types'
import { cn } from '../lib/utils'

const WORKFLOW = [
  { icon: ScanSearch, title: 'Frame the objective', body: 'State what you need to rely on, and the cycle it applies to.' },
  { icon: Layers, title: 'Add evidence', body: 'Official PDFs, government pages and secondary sources.' },
  { icon: FileSearch, title: 'Decompose', body: 'The objective becomes explicit information requirements.' },
  { icon: GitCompareArrows, title: 'Map the gaps', body: 'Evidence is tested against every requirement.' },
  { icon: ListChecks, title: 'Verify', body: 'A prioritised checklist of what to confirm, and where.' },
]

const FEATURES = [
  {
    icon: CircleDashed,
    tone: 'violet',
    title: 'Discover information gaps',
    body: 'Every objective is broken into requirements, then each one is tested against the evidence you actually collected. What nothing addresses is reported as not found in the reviewed sources — never as non-existent.',
  },
  {
    icon: GitCompareArrows,
    tone: 'coral',
    title: 'Detect conflicting evidence',
    body: 'When two sources appear to disagree, both excerpts are shown side by side with dates, cycles and conditions, so you can judge whether it is a real contradiction or a difference in scope.',
  },
  {
    icon: ShieldCheck,
    tone: 'emerald',
    title: 'Know what to verify next',
    body: 'Findings convert into a prioritised verification checklist, each item naming the requirement it protects and the authoritative source to consult.',
  },
]

export default function Landing() {
  const [demo, setDemo] = useState<SessionSummary | null>(null)

  useEffect(() => {
    if (!isSupabaseConfigured) return
    listSessionSummaries()
      .then((rows) => setDemo(rows.find((r) => r.is_demo) ?? rows[0] ?? null))
      .catch(() => setDemo(null))
  }, [])

  return (
    <div className="relative min-h-screen overflow-hidden bg-ink-950">
      {/* ambient background */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-[0.55]" aria-hidden />
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[38rem] w-[64rem] -translate-x-1/2 rounded-full bg-violet-brand/[0.13] blur-[120px]" aria-hidden />
      <div className="pointer-events-none absolute -right-40 top-72 h-[26rem] w-[26rem] rounded-full bg-ice/[0.07] blur-[110px]" aria-hidden />

      <header className="relative z-20 mx-auto flex h-[72px] max-w-7xl items-center justify-between px-5 sm:px-8">
        <BrandLockup />
        <nav className="flex items-center gap-1.5">
          <a
            href="#workflow"
            className="hidden rounded-lg px-3 py-2 text-[13px] text-slatey-400 transition-colors hover:text-white sm:block"
          >
            How it works
          </a>
          <a
            href="#features"
            className="hidden rounded-lg px-3 py-2 text-[13px] text-slatey-400 transition-colors hover:text-white sm:block"
          >
            Capabilities
          </a>
          <Link to="/app">
            <Button variant="secondary" size="sm">
              Open workspace
            </Button>
          </Link>
        </nav>
      </header>

      <main className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8">
        {!isSupabaseConfigured && (
          <div className="mt-4 rounded-xl border border-amber-warm/30 bg-amber-warm/[0.07] px-4 py-3 text-[13px] text-amber-warm">
            Supabase environment variables are missing. Copy <code className="font-mono">.env.example</code> to{' '}
            <code className="font-mono">.env</code> and restart the dev server to enable data.
          </div>
        )}

        {/* ------------------------------------------------------------- hero */}
        <section className="grid items-center gap-12 pt-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)] lg:gap-10 lg:pt-20">
          <div className="animate-fade-up">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/[0.09] bg-white/[0.03] px-3 py-1 text-[11px] font-medium text-slatey-300">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-violet-brand opacity-70" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-violet-soft" />
              </span>
              Information Completeness Analysis
              <span className="text-slatey-400">·</span>
              <span className="text-slatey-400">GRAVITON 2026</span>
            </div>

            <h1 className="mt-5 max-w-[16ch] font-display text-[2.6rem] font-semibold leading-[1.06] tracking-[-0.03em] text-white text-balance sm:text-[3.4rem]">
              The most important information might be the information you{' '}
              <span className="relative whitespace-nowrap">
                <span className="bg-gradient-to-r from-violet-soft via-violet-soft to-ice bg-clip-text text-transparent">
                  haven&rsquo;t found
                </span>
                <svg className="absolute -bottom-1.5 left-0 w-full" height="8" viewBox="0 0 200 8" fill="none" preserveAspectRatio="none" aria-hidden>
                  <path d="M1 5.5C40 2.5 84 1.5 199 3.5" stroke="url(#underline)" strokeWidth="2" strokeLinecap="round" />
                  <defs>
                    <linearGradient id="underline" x1="0" y1="0" x2="200" y2="0" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#7C5CFF" stopOpacity="0.9" />
                      <stop offset="1" stopColor="#4FD1E5" stopOpacity="0.25" />
                    </linearGradient>
                  </defs>
                </svg>
              </span>
              .
            </h1>

            <p className="mt-6 max-w-xl text-[15px] leading-relaxed text-slatey-300 text-pretty">
              Search engines find information. AI assistants explain it. Digital Dark Spot reports what your
              evidence does <span className="text-white">not</span> adequately establish — the requirements nothing
              addresses, the claims that appear to disagree, and the details that may already be out of date.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/app/new">
                <Button variant="primary" size="lg" icon={<Sparkles className="h-4 w-4" />}>
                  Start research
                </Button>
              </Link>
              {demo ? (
                <Link to={`/app/session/${demo.session_id}`}>
                  <Button variant="outline" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                    Open the CSSS case
                  </Button>
                </Link>
              ) : (
                <Link to="/app/history">
                  <Button variant="outline" size="lg">
                    Browse research
                  </Button>
                </Link>
              )}
            </div>

            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-white/[0.07] pt-5">
              {[
                { k: 'Evidence-linked', v: 'Every finding traces to an excerpt and page' },
                { k: 'Hedged by design', v: '“Not found in reviewed sources”, never “does not exist”' },
                { k: 'Verification-first', v: 'Output is a checklist, not a verdict' },
              ].map((item) => (
                <div key={item.k}>
                  <dt className="font-display text-[12px] font-semibold text-white">{item.k}</dt>
                  <dd className="mt-1 text-[11px] leading-relaxed text-slatey-400">{item.v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="animate-fade-up [animation-delay:120ms]">
            <EvidenceMapIllustration />
          </div>
        </section>

        {/* --------------------------------------------------------- workflow */}
        <section id="workflow" className="mt-24 scroll-mt-24">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="label">The workflow</p>
              <h2 className="mt-2 font-display text-2xl font-semibold text-white">
                From a question to a verification plan
              </h2>
            </div>
            <p className="max-w-sm text-[13px] leading-relaxed text-slatey-400">
              Five deliberate steps. Nothing is summarised into a single paragraph you are expected to trust.
            </p>
          </div>

          <ol className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {WORKFLOW.map((step, i) => {
              const Icon = step.icon
              return (
                <li key={step.title} className="surface group relative overflow-hidden p-4 transition-colors hover:border-white/[0.14]">
                  <span className="absolute right-3 top-3 font-display text-[11px] tabular-nums text-slatey-400/60">
                    0{i + 1}
                  </span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.04] text-violet-soft">
                    <Icon className="h-4 w-4" />
                  </span>
                  <p className="mt-3 font-display text-[13.5px] font-semibold text-white">{step.title}</p>
                  <p className="mt-1 text-[11.5px] leading-relaxed text-slatey-400">{step.body}</p>
                </li>
              )
            })}
          </ol>
        </section>

        {/* --------------------------------------------------------- features */}
        <section id="features" className="mt-24 scroll-mt-24">
          <p className="label">Capabilities</p>
          <h2 className="mt-2 max-w-2xl font-display text-2xl font-semibold text-white text-balance">
            Built to expose the edges of what your evidence can support
          </h2>

          <div className="mt-7 grid gap-4 lg:grid-cols-3">
            {FEATURES.map((feature) => {
              const Icon = feature.icon
              const toneRing =
                feature.tone === 'violet'
                  ? 'text-violet-soft border-violet-brand/25 bg-violet-brand/10'
                  : feature.tone === 'coral'
                    ? 'text-coral-soft border-coral-soft/25 bg-coral-soft/10'
                    : 'text-emerald-muted border-emerald-muted/25 bg-emerald-muted/10'
              return (
                <article key={feature.title} className="surface p-5">
                  <span className={cn('flex h-9 w-9 items-center justify-center rounded-xl border', toneRing)}>
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  <h3 className="mt-4 font-display text-[15px] font-semibold text-white">{feature.title}</h3>
                  <p className="mt-2 text-[12.5px] leading-relaxed text-slatey-400">{feature.body}</p>
                </article>
              )
            })}
          </div>
        </section>

        {/* ------------------------------------------------------------- cta */}
        <section className="mt-24">
          <div className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-violet-brand/[0.14] via-ink-900 to-ink-900 px-6 py-10 sm:px-10">
            <div className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-ice/[0.08] blur-3xl" aria-hidden />
            <div className="relative max-w-2xl">
              <h2 className="font-display text-2xl font-semibold text-white text-balance">
                Start with what you need to rely on.
              </h2>
              <p className="mt-2 text-[13.5px] leading-relaxed text-slatey-300">
                Bring the sources you already trust. Digital Dark Spot will tell you which requirements they settle,
                which they only partly cover, where they disagree, and what remains to be verified.
              </p>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <Link to="/app/new">
                  <Button variant="primary" size="lg" icon={<ArrowRight className="h-4 w-4" />}>
                    Start research
                  </Button>
                </Link>
                <Link to="/app/history">
                  <Button variant="ghost" size="lg">
                    See past investigations
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-white/[0.06] px-5 py-6 sm:px-8">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-3 text-[11.5px] text-slatey-400 sm:flex-row sm:items-center">
          <p>Digital Dark Spot · Team NEXORA · GRAVITON 2026, ISTE CGC University Mohali</p>
          <p className="max-w-md leading-relaxed">
            An AI-assisted research instrument. Findings are signals for human verification, not established facts.
          </p>
        </div>
      </footer>
    </div>
  )
}
