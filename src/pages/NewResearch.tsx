import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  CircleDashed,
  FileStack,
  GitCompareArrows,
  GraduationCap,
  ListChecks,
  Loader2,
  Sparkles,
  Stethoscope,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { useShellHeader } from '../components/layout/AppShell'
import { Badge, Button, Card, CardHeader, Field, Input, Textarea } from '../components/ui/primitives'
import { useToast } from '../components/ui/toast'
import { createSession } from '../lib/api'
import { cn } from '../lib/utils'

const PRESETS = [
  {
    id: 'csss',
    icon: GraduationCap,
    label: 'Scholarship (CSSS)',
    title: 'CSSS scholarship — reliance check for AY 2026–27',
    question:
      'What should a student verify before relying on the Central Sector Scheme of Scholarships for College and University Students information for AY 2026–27?',
    context:
      'A student is preparing an application for AY 2026–27 based on a 2022 scheme guideline, a government scheme page and several coaching-blog summaries. Determine what is actually established by the reviewed sources and what must be confirmed with the ministry, the institute or the state nodal agency.',
    cycle: 'AY 2026–27',
    domain: 'Education · Scholarship',
  },
  {
    id: 'health',
    icon: Stethoscope,
    label: 'Public health scheme',
    title: 'Health cover eligibility — household category questions',
    question:
      'What must a household confirm before assuming it is covered by the scheme, and which eligibility details are not established by the reviewed material?',
    context:
      'Compare the official scheme guideline against a state implementation circular and a news summary. Focus on eligibility categories, documentation and whether the scheme has been extended beyond the period stated in the guideline.',
    cycle: 'FY 2026–27',
    domain: 'Health · Public scheme',
  },
  {
    id: 'procurement',
    icon: FileStack,
    label: 'Policy / procurement',
    title: 'Vendor compliance obligations — unresolved clauses',
    question:
      'Which compliance obligations apply to a vendor under the reviewed policy documents, and where do the reviewed documents leave an obligation unresolved?',
    context:
      'Three documents are in scope: the parent policy, a departmental circular and a vendor-facing FAQ. Identify obligations that only appear in the FAQ, and any circular that may have been superseded.',
    cycle: '2026',
    domain: 'Policy · Procurement',
  },
]

const STEPS = [
  {
    icon: Target,
    title: 'Decompose the objective',
    body: 'Gemini converts your question into explicit, prioritised information requirements — not a generic checklist.',
  },
  {
    icon: FileStack,
    title: 'Extract the evidence',
    body: 'URLs are fetched and extracted server-side; PDFs are stored privately and parsed page by page.',
  },
  {
    icon: GitCompareArrows,
    title: 'Map and challenge',
    body: 'Each requirement is tested against excerpts. Disagreements and earlier cycles are surfaced, not smoothed over.',
  },
  {
    icon: ListChecks,
    title: 'Leave with a plan',
    body: 'You get a prioritised verification checklist naming the authoritative source to consult next.',
  },
]

export default function NewResearch() {
  const [title, setTitle] = useState('')
  const [question, setQuestion] = useState('')
  const [context, setContext] = useState('')
  const [cycle, setCycle] = useState('')
  const [domain, setDomain] = useState('')
  const [activePreset, setActivePreset] = useState<string | null>(null)
  const [errors, setErrors] = useState<{ title?: string; question?: string }>({})
  const [submitting, setSubmitting] = useState(false)
  const navigate = useNavigate()
  const toast = useToast()

  useShellHeader({ title: 'New research', subtitle: 'Frame the question before you collect evidence' })

  function applyPreset(id: string) {
    const preset = PRESETS.find((p) => p.id === id)
    if (!preset) return
    setActivePreset(id)
    setTitle(preset.title)
    setQuestion(preset.question)
    setContext(preset.context)
    setCycle(preset.cycle)
    setDomain(preset.domain)
    setErrors({})
  }

  async function submit() {
    const nextErrors: typeof errors = {}
    if (title.trim().length < 3) nextErrors.title = 'Give the investigation a short, specific title.'
    if (question.trim().length < 10) nextErrors.question = 'Describe what you need to determine, in one or two sentences.'
    setErrors(nextErrors)
    if (Object.keys(nextErrors).length > 0) return

    setSubmitting(true)
    try {
      const session = await createSession({
        title,
        question,
        context,
        target_cycle: cycle,
        domain,
      })
      toast.success('Research session created', 'Add at least one source to begin the analysis.')
      navigate(`/app/session/${session.id}?tab=sources`)
    } catch (err) {
      toast.error('Could not create the session', err instanceof Error ? err.message : undefined)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mx-auto max-w-[1500px]">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <Card>
          <CardHeader
            title="Define the research objective"
            subtitle="The objective drives everything: requirements, evidence mapping and the verification checklist."
            icon={<Sparkles className="h-4 w-4" />}
            action={<Badge tone="violet">Step 1 of 3</Badge>}
          />

          <div className="space-y-4 p-5">
            <div>
              <p className="label mb-2">Start from an example</p>
              <div className="flex flex-wrap gap-1.5">
                {PRESETS.map((preset) => {
                  const Icon = preset.icon
                  return (
                    <button
                      key={preset.id}
                      onClick={() => applyPreset(preset.id)}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11.5px] font-medium transition-colors',
                        activePreset === preset.id
                          ? 'border-violet-brand/40 bg-violet-brand/12 text-white'
                          : 'border-white/[0.08] bg-white/[0.02] text-slatey-300 hover:border-white/20 hover:text-white',
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {preset.label}
                    </button>
                  )
                })}
              </div>
            </div>

            <Field label="Research title" required error={errors.title} htmlFor="title">
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. CSSS scholarship — reliance check for AY 2026–27"
                maxLength={200}
              />
            </Field>

            <Field
              label="Research question or objective"
              required
              error={errors.question}
              htmlFor="question"
              hint="Be concrete about what must be relied upon. “What should I verify before…” produces sharper requirements than “Tell me about…”."
            >
              <Textarea
                id="question"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                className="min-h-[110px]"
                maxLength={2000}
                placeholder="What should a student verify before relying on … for 2026–27?"
              />
            </Field>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Target cycle or date range" hint="Sharpens outdated-information detection.">
                <Input value={cycle} onChange={(e) => setCycle(e.target.value)} placeholder="AY 2026–27" maxLength={80} />
              </Field>
              <Field label="Domain (optional)" hint="A short label for your own orientation.">
                <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="Education · Scholarship" maxLength={120} />
              </Field>
            </div>

            <Field
              label="Research context (optional)"
              hint="What decision depends on this? Which sources do you already have?"
            >
              <Textarea
                value={context}
                onChange={(e) => setContext(e.target.value)}
                className="min-h-[90px]"
                maxLength={4000}
                placeholder="Why you are researching this, and what you already believe…"
              />
            </Field>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
              <p className="max-w-sm text-[10.5px] leading-relaxed text-slatey-400">
                Sessions you create while signed in stay private to your account. Guest sessions live in the shared
                demo workspace.
              </p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={() => navigate('/app')}>
                  Cancel
                </Button>
                <Button variant="primary" onClick={() => void submit()} loading={submitting} icon={<ArrowRight className="h-4 w-4" />}>
                  Create session
                </Button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card>
            <CardHeader title="What happens next" subtitle="Five stages, each independently retryable" icon={<CircleDashed className="h-4 w-4" />} />
            <ol className="space-y-3 p-5">
              {STEPS.map((step, i) => {
                const Icon = step.icon
                return (
                  <li key={step.title} className="flex gap-3">
                    <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.03] text-violet-soft">
                      <Icon className="h-3.5 w-3.5" />
                      {i < STEPS.length - 1 ? (
                        <span className="absolute left-1/2 top-full h-3 w-px -translate-x-1/2 bg-white/10" aria-hidden />
                      ) : null}
                    </span>
                    <div>
                      <p className="text-[12.5px] font-medium text-slatey-100">{step.title}</p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-slatey-400">{step.body}</p>
                    </div>
                  </li>
                )
              })}
            </ol>
          </Card>

          <div className="rounded-xl border border-amber-warm/25 bg-amber-warm/[0.06] p-4">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-amber-warm">
              <TriangleAlert className="h-3.5 w-3.5" /> What this tool will not do
            </p>
            <ul className="mt-2 space-y-1.5 text-[11px] leading-relaxed text-slatey-300">
              <li>It will not claim information does not exist because it was not found.</li>
              <li>It will not resolve a contradiction for you — it shows both claims and what to check.</li>
              <li>It will not treat an undated page as outdated on age alone.</li>
              <li>It will not invent a source reference, page number or link.</li>
            </ul>
          </div>

          {submitting ? (
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3 text-[11.5px] text-slatey-300">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-violet-soft" /> Creating the session…
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
