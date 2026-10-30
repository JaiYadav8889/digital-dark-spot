import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import {
  ArrowRight,
  BookOpenCheck,
  CircleDashed,
  ClipboardList,
  FileStack,
  GitCompareArrows,
  Layers,
  ListChecks,
  Loader2,
  RefreshCw,
  Search,
  ShieldAlert,
  Target,
  TriangleAlert,
} from 'lucide-react'
import { SessionStatusBadge, useShellHeader } from '../components/layout/AppShell'
import { AnalysisProgress } from '../components/session/AnalysisProgress'
import { ChecklistPanel } from '../components/session/ChecklistPanel'
import { CoveragePanel } from '../components/session/CoveragePanel'
import { EvidenceCard } from '../components/session/EvidenceCard'
import { FindingsPanel } from '../components/session/FindingsPanel'
import { RequirementDetail } from '../components/session/RequirementDetail'
import { RequirementMatrix } from '../components/session/RequirementMatrix'
import { SourcesPanel } from '../components/session/SourcesPanel'
import { StatCards } from '../components/session/StatCards'
import { Badge, Button, Card, CardHeader, EmptyState, Input, Segmented, Skeleton } from '../components/ui/primitives'
import { Drawer, InfoTooltip } from '../components/ui/overlay'
import { useToast } from '../components/ui/toast'
import { useAnalysisRunner } from '../hooks/useAnalysisRunner'
import { useSessionData } from '../hooks/useSessionData'
import { setFindingStatus, toggleChecklistItem } from '../lib/api'
import { computeStats } from '../lib/stats'
import { DEMO_DISCLAIMER, DEMO_ENGINE_NOTE, DISCLAIMERS, RELATION_META, STATUS_META } from '../lib/status'
import type { EvidenceWithSource, FindingKind, Relation } from '../lib/types'
import { cn, formatDate, relativeTime } from '../lib/utils'

type TabKey = 'overview' | 'requirements' | 'sources' | 'findings' | 'checklist' | 'evidence'

const TABS: Array<{ key: TabKey; label: string; icon: typeof Layers }> = [
  { key: 'overview', label: 'Overview', icon: Layers },
  { key: 'requirements', label: 'Requirements', icon: Target },
  { key: 'sources', label: 'Sources', icon: FileStack },
  { key: 'findings', label: 'Findings', icon: GitCompareArrows },
  { key: 'checklist', label: 'Checklist', icon: ListChecks },
  { key: 'evidence', label: 'Evidence', icon: Search },
]

export default function SessionWorkspace() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { session, sources, requirements, findings, findingEvidence, evidence, checklist, jobs, loading, error, refresh } =
    useSessionData(sessionId)
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as TabKey) ?? 'overview'
  const toast = useToast()

  const stats = useMemo(
    () => computeStats({ sources, requirements, findings, evidence, checklist }),
    [sources, requirements, findings, evidence, checklist],
  )

  const runner = useAnalysisRunner(sessionId, refresh)
  const [selectedRequirementId, setSelectedRequirementId] = useState<string | null>(null)
  const [optimisticDone, setOptimisticDone] = useState<Record<string, boolean>>({})
  const [showPipeline, setShowPipeline] = useState(true)

  useShellHeader(
    session
      ? {
          title: session.title,
          subtitle: session.target_cycle ? `Cycle: ${session.target_cycle}` : session.domain ?? undefined,
          badge: <SessionStatusBadge status={session.status} />,
        }
      : { title: 'Research session' },
    [session?.title, session?.status],
  )

  const setTab = useCallback(
    (next: TabKey) => {
      const nextParams = new URLSearchParams(params)
      nextParams.set('tab', next)
      nextParams.delete('status')
      nextParams.delete('kind')
      setParams(nextParams, { replace: true })
    },
    [params, setParams],
  )

  const effectiveChecklist = useMemo(
    () =>
      checklist.map((item) =>
        optimisticDone[item.id] !== undefined ? { ...item, completed: optimisticDone[item.id] } : item,
      ),
    [checklist, optimisticDone],
  )

  const effectiveStats = useMemo(
    () => computeStats({ sources, requirements, findings, evidence, checklist: effectiveChecklist }),
    [sources, requirements, findings, evidence, effectiveChecklist],
  )

  useEffect(() => {
    if (session?.status === 'analysing') setShowPipeline(true)
  }, [session?.status])

  const handleToggle = useCallback(
    async (id: string, completed: boolean) => {
      setOptimisticDone((prev) => ({ ...prev, [id]: completed }))
      try {
        await toggleChecklistItem(id, completed)
        await refresh()
      } catch (err) {
        setOptimisticDone((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
        toast.error('Could not update the checklist', err instanceof Error ? err.message : undefined)
      } finally {
        setOptimisticDone((prev) => {
          const next = { ...prev }
          delete next[id]
          return next
        })
      }
    },
    [refresh, toast],
  )

  const handleFindingStatus = useCallback(
    async (id: string, status: 'open' | 'resolved' | 'dismissed') => {
      try {
        await setFindingStatus(id, status)
        await refresh()
        toast.success(status === 'resolved' ? 'Finding marked as verified' : status === 'dismissed' ? 'Finding dismissed' : 'Finding reopened')
      } catch (err) {
        toast.error('Could not update the finding', err instanceof Error ? err.message : undefined)
      }
    },
    [refresh, toast],
  )

  const selectedRequirement = useMemo(
    () => requirements.find((r) => r.requirement_id === selectedRequirementId) ?? null,
    [requirements, selectedRequirementId],
  )

  const openRequirement = useCallback(
    (id: string) => {
      setSelectedRequirementId(id)
    },
    [],
  )

  async function rerunExplore() {
    if (!sessionId) return
    setShowPipeline(true)
    await runner.run({ stage: 'full' })
    toast.success('Analysis refreshed')
  }

  if (loading && !session) {
    return (
      <div className="mx-auto max-w-[1500px] space-y-4">
        <Skeleton className="h-28 w-full" />
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (error || (!session && !loading)) {
    return (
      <div className="mx-auto max-w-2xl pt-10">
        <EmptyState
          icon={<TriangleAlert className="h-5 w-5 text-coral-soft" />}
          title="This session could not be loaded"
          description={error ?? 'The research session does not exist, or it belongs to another account.'}
          action={
            <Link to="/app/history">
              <Button variant="secondary" size="sm">
                Back to research history
              </Button>
            </Link>
          }
        />
      </div>
    )
  }

  if (!session) return null

  const busy = runner.running || sessionsIsBusy(sources, jobs)
  // Sources whose text was never searched. A requirement with no evidence is
  // NOT the same as a requirement the sources answered — say so explicitly.
  const unreadSources = sources.filter((s) => s.status !== 'extracted').length

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      {/* -------------------------------------------------------------- header */}
      <section className="surface relative overflow-hidden p-4 sm:p-5">
        <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-violet-brand/[0.08] blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="violet">{session.domain ?? 'Research'}</Badge>
              {session.target_cycle ? <Badge tone="ice">Cycle {session.target_cycle}</Badge> : null}
              {session.is_demo ? <Badge tone="amber">Demonstration case</Badge> : null}
              {session.analysis_engine ? (
                <Badge tone={session.analysis_engine === 'gemini' ? 'violet' : 'amber'}>
                  {session.analysis_engine} engine
                </Badge>
              ) : null}
            </div>
            <h1 className="mt-2.5 font-display text-[19px] font-semibold leading-snug text-white sm:text-[21px]">
              {session.title}
            </h1>
            <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slatey-300">
              <span className="text-slatey-400">Objective · </span>
              {session.question}
            </p>
            {session.context ? (
              <p className="mt-1.5 max-w-3xl text-[11.5px] leading-relaxed text-slatey-400">{session.context}</p>
            ) : null}
            <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[10.5px] text-slatey-400">
              <span>Created {formatDate(session.created_at)}</span>
              {session.last_analysed_at ? <span>Analysed {relativeTime(session.last_analysed_at)}</span> : null}
              <span>{stats.totalSources} sources</span>
              <span>{stats.totalRequirements} requirements</span>
              <span>{stats.evidenceCount} excerpts</span>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <Button
              variant="primary"
              onClick={() => {
                setShowPipeline(true)
                void runner.run({ stage: 'full' })
              }}
              loading={runner.running}
              icon={<RefreshCw className={cn('h-3.5 w-3.5', runner.running && 'animate-spin')} />}
            >
              {stats.totalRequirements === 0 ? 'Run analysis' : 'Re-run analysis'}
            </Button>
            <span className="text-right text-[10px] leading-relaxed text-slatey-400">
              Extraction → requirements → evidence → findings
            </span>
          </div>
        </div>
      </section>

      {session.analysis_error ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-warm/25 bg-amber-warm/[0.06] px-4 py-2.5">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-warm" />
          <p className="text-[11px] leading-relaxed text-amber-warm">{session.analysis_error}</p>
        </div>
      ) : null}

      {/* --------------------------------------------------------------- tabs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="no-scrollbar flex w-full items-center gap-1 overflow-x-auto rounded-xl border border-white/[0.07] bg-ink-900/60 p-1 sm:w-auto">
          {TABS.map((t) => {
            const Icon = t.icon
            const count =
              t.key === 'requirements'
                ? requirements.length
                : t.key === 'sources'
                  ? sources.length
                  : t.key === 'findings'
                    ? findings.filter((f) => f.status === 'open').length
                    : t.key === 'checklist'
                      ? effectiveChecklist.filter((c) => !c.completed).length
                      : t.key === 'evidence'
                        ? evidence.length
                        : 0
            const active = tab === t.key
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  'inline-flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-medium transition-colors',
                  active ? 'bg-white/[0.09] text-white' : 'text-slatey-400 hover:text-slatey-200',
                )}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="h-3.5 w-3.5" />
                {t.label}
                {count > 0 ? (
                  <span className={cn('rounded px-1 text-[10px] tabular-nums', active ? 'bg-white/10' : 'bg-white/[0.06]')}>
                    {count}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>

        {busy ? (
          <span className="flex items-center gap-1.5 rounded-lg border border-violet-brand/25 bg-violet-brand/[0.08] px-2.5 py-1.5 text-[11px] text-violet-soft">
            <Loader2 className="h-3 w-3 animate-spin" /> Processing…
          </span>
        ) : null}
      </div>

      {/* ------------------------------------------------------- not assessed */}
      {!session.is_demo && sources.length > 0 && unreadSources > 0 && requirements.length > 0 ? (
        <section className="flex items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.02] px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-slatey-400" aria-hidden />
          <div className="min-w-0">
            <p className="text-[12px] font-medium text-slatey-200">
              {unreadSources} of {sources.length} sources were not fully read — part of this session is{' '}
              <span className="text-white">not assessed</span>.
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slatey-400">
              Requirements marked “not found” may simply be covered by text that was never extracted. Retry
              extraction in the Sources tab before treating any of them as a gap.
            </p>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------- demonstration notice */}
      {session.is_demo ? (
        <section className="flex items-start gap-3 rounded-xl border border-amber-warm/25 bg-amber-warm/[0.06] px-4 py-3">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-warm" aria-hidden />
          <div className="min-w-0">
            <p className="text-[12px] font-medium leading-relaxed text-amber-warm">{DEMO_DISCLAIMER}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slatey-300">
              {DEMO_ENGINE_NOTE} Sources marked “URL unavailable” cannot be re-checked here — their
              claims are shown exactly as recorded, with the limitation stated instead of a link that
              does not exist.
            </p>
          </div>
        </section>
      ) : null}

      {/* ------------------------------------------------------------- content */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <StatCards stats={effectiveStats} sessionId={session.id} />

          {showPipeline ? (
            <AnalysisProgress
              steps={runner.steps}
              running={runner.running}
              error={runner.error}
              engine={runner.engine ?? session.analysis_engine}
              onRun={() => void runner.run({ stage: 'full' })}
              onDismiss={runner.hasProgress ? () => setShowPipeline(false) : undefined}
              label={stats.totalRequirements === 0 ? 'Run analysis' : 'Re-run'}
              disabled={sources.length === 0}
            />
          ) : (
            <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.015] px-4 py-2">
              <p className="text-[11px] text-slatey-400">
                {sources.length === 0
                  ? 'Add at least one source before running the analysis.'
                  : 'Pipeline details hidden. Re-run any time from the header.'}
              </p>
              <button onClick={() => setShowPipeline(true)} className="text-[11px] text-ice hover:text-white">
                Show pipeline
              </button>
            </div>
          )}

          <CoveragePanel coverage={stats.coverage} requirements={requirements} />

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
            <Card>
              <CardHeader
                title="Requirement matrix"
                subtitle="Each requirement with the status the reviewed evidence supports"
                icon={<Target className="h-4 w-4" />}
                action={
                  <Button size="sm" variant="ghost" onClick={() => setTab('requirements')}>
                    View all <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                }
              />
              <div className="p-3.5">
                <RequirementMatrix
                  requirements={requirements}
                  onSelect={(r) => setSelectedRequirementId(r.requirement_id)}
                  dense
                  maxRows={7}
                />
              </div>
            </Card>

            <div className="space-y-4">
              <Card>
                <CardHeader
                  title="Priority findings"
                  subtitle="Gaps, conflicts and outdated signals requiring attention"
                  icon={<GitCompareArrows className="h-4 w-4" />}
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setTab('findings')}>
                      All findings <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  }
                />
                <div className="p-3.5">
                  {findings.length === 0 ? (
                    <EmptyState
                      compact
                      icon={<CircleDashed className="h-5 w-5" />}
                      title="No findings yet"
                      description="Run the analysis to surface gaps, conflicts and outdated signals."
                    />
                  ) : (
                    <FindingsPanel
                      findings={findings.slice(0, 3)}
                      findingEvidence={findingEvidence}
                      evidence={evidence}
                      requirements={requirements}
                      onOpenRequirement={openRequirement}
                      onStatusChange={handleFindingStatus}
                      dense
                    />
                  )}
                </div>
              </Card>

              <Card>
                <CardHeader
                  title="Next actions"
                  subtitle="Highest-priority verification steps"
                  icon={<BookOpenCheck className="h-4 w-4" />}
                  action={
                    <Button size="sm" variant="ghost" onClick={() => setTab('checklist')}>
                      Open <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  }
                />
                <div className="p-3.5">
                  <ChecklistPanel
                    items={effectiveChecklist.filter((c) => !c.completed).slice(0, 3)}
                    requirements={requirements}
                    onToggle={(id, v) => void handleToggle(id, v)}
                  />
                </div>
              </Card>
            </div>
          </div>
        </div>
      )}

      {tab === 'requirements' && (
        <Card>
          <CardHeader
            title="Research requirement matrix"
            subtitle="Evidence relationships are derived from excerpts, not keyword matches"
            icon={<Target className="h-4 w-4" />}
            action={
              <div className="flex items-center gap-1.5">
                <InfoTooltip
                  content={
                    <div className="space-y-1.5">
                      <p className="font-medium text-white">Status derivation order</p>
                      <p>1. Any apparent conflict → Conflicting</p>
                      <p>2. Nothing supporting but outdated evidence → Potentially outdated</p>
                      <p>3. Directly supporting evidence → Found</p>
                      <p>4. Partially relevant evidence → Partially supported</p>
                      <p>5. No linked excerpt → Not found in reviewed sources</p>
                    </div>
                  }
                />
                <Button size="sm" variant="ghost" onClick={() => void rerunExplore()} loading={runner.running}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Re-map
                </Button>
              </div>
            }
          />
          <div className="p-3.5">
            <RequirementMatrix
              key={params.get('status') ?? 'all'}
              requirements={requirements}
              onSelect={(r) => setSelectedRequirementId(r.requirement_id)}
              initialStatus={
                (params.get('status') as 'found' | 'conflicting' | 'not_found' | 'partial' | 'outdated' | 'verify' | null) ??
                'all'
              }
            />
          </div>
        </Card>
      )}

      {tab === 'sources' && (
        <SourcesPanel sessionId={session.id} sources={sources} onChanged={refresh} />
      )}

      {tab === 'findings' && (
        <div className="space-y-3">
          <div className="surface flex flex-wrap items-start gap-2.5 px-4 py-2.5">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-warm" />
            <p className="text-[11px] leading-relaxed text-slatey-400">
              {DISCLAIMERS.conflict} {DISCLAIMERS.notFound}
            </p>
          </div>
          <FindingsPanel
            key={params.get('kind') ?? 'all'}
            findings={findings}
            findingEvidence={findingEvidence}
            evidence={evidence}
            requirements={requirements}
            onOpenRequirement={openRequirement}
            onStatusChange={handleFindingStatus}
            initialKind={(params.get('kind') as FindingKind | 'all') ?? 'all'}
          />
        </div>
      )}

      {tab === 'checklist' && (
        <ChecklistPanel
          items={effectiveChecklist}
          requirements={requirements}
          onToggle={(id, v) => void handleToggle(id, v)}
        />
      )}

      {tab === 'evidence' && (
        <EvidenceExplorer evidence={evidence} onOpenRequirement={openRequirement} />
      )}

      {/* ------------------------------------------------------- requirement drawer */}
      <Drawer
        open={Boolean(selectedRequirement)}
        onClose={() => setSelectedRequirementId(null)}
        width="lg"
        title={
          selectedRequirement ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-slatey-400">{selectedRequirement.code}</span>
              <span className="font-display text-[15px] font-semibold text-white">
                {STATUS_META[selectedRequirement.status].short}
              </span>
            </div>
          ) : (
            ''
          )
        }
        subtitle={selectedRequirement?.description}
      >
        {selectedRequirement ? (
          <RequirementDetail
            requirement={selectedRequirement}
            evidence={evidence}
            findings={findings.filter((f) => f.requirement_id === selectedRequirement.requirement_id)}
            unreadSources={unreadSources}
          />
        ) : null}
      </Drawer>
    </div>
  )
}

function sessionsIsBusy(
  sources: Array<{ status: string }>,
  jobs: Array<{ status: string }>,
) {
  return (
    sources.some((s) => s.status === 'processing' || s.status === 'waiting') ||
    jobs.some((j) => j.status === 'running' || j.status === 'queued')
  )
}

function EvidenceExplorer({
  evidence,
  onOpenRequirement,
}: {
  evidence: EvidenceWithSource[]
  onOpenRequirement: (id: string) => void
}) {
  const [relation, setRelation] = useState<'all' | Relation>('all')
  const [query, setQuery] = useState('')

  const rows = useMemo(() => {
    let list = evidence
    if (relation !== 'all') list = list.filter((e) => e.links.some((l) => l.relation === relation))
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (e) => e.claim_text.toLowerCase().includes(q) || e.source.title.toLowerCase().includes(q),
      )
    }
    return list
  }, [evidence, relation, query])

  if (evidence.length === 0) {
    return (
      <EmptyState
        icon={<Search className="h-5 w-5" />}
        title="No excerpts extracted yet"
        description="Add sources and run the analysis to build the evidence library for this session."
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={relation}
          onChange={(v) => setRelation(v as 'all' | Relation)}
          options={[
            { value: 'all', label: 'All excerpts', count: evidence.length },
            ...(['SUPPORTS', 'PARTIAL', 'CONFLICTS', 'OUTDATED'] as Relation[]).map((r) => ({
              value: r,
              label: RELATION_META[r].short,
              count: evidence.filter((e) => e.links.some((l) => l.relation === r)).length,
            })),
          ]}
        />
        <div className="relative ml-auto w-full sm:w-64">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slatey-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search excerpts and sources…"
            className="h-8 pl-8 text-[12px]"
            aria-label="Search evidence"
          />
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyState compact title="No excerpts match this filter" description="Try another relationship or clear the search." />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {rows.map((item) => {
            const strongest = item.links[0]
            return (
              <EvidenceCard
                key={item.id}
                evidence={item}
                relation={strongest?.relation}
                rationale={strongest?.rationale}
                onOpenRequirement={onOpenRequirement}
              />
            )
          })}
        </div>
      )}
      <p className="flex items-center gap-1.5 text-[10.5px] text-slatey-400">
        <ClipboardList className="h-3 w-3" /> Every excerpt keeps its source, page and rationale. {DISCLAIMERS.aiSignal}
      </p>
    </div>
  )
}
