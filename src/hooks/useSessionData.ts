import { useCallback, useEffect, useRef, useState } from 'react'
import {
  listEvidenceWithSource,
  listFindingEvidence,
  listFindings,
  listJobs,
  listRequirements,
  listSources,
  listChecklist,
  getSession,
} from '../lib/api'
import type {
  AnalysisJob,
  ChecklistItem,
  EvidenceWithSource,
  Finding,
  FindingEvidence,
  RequirementWithStatus,
  ResearchSession,
  Source,
} from '../lib/types'

export interface SessionData {
  session: ResearchSession | null
  sources: Source[]
  requirements: RequirementWithStatus[]
  findings: Finding[]
  findingEvidence: FindingEvidence[]
  evidence: EvidenceWithSource[]
  checklist: ChecklistItem[]
  jobs: AnalysisJob[]
}

const EMPTY: SessionData = {
  session: null,
  sources: [],
  requirements: [],
  findings: [],
  findingEvidence: [],
  evidence: [],
  checklist: [],
  jobs: [],
}

/**
 * Loads a full research session and polls while any asynchronous work is in
 * flight. Polling stops automatically once extraction and analysis settle, so an
 * idle workspace makes no repetitive requests.
 */
export function useSessionData(sessionId: string | undefined) {
  const [data, setData] = useState<SessionData>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mounted = useRef(true)

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!sessionId) return
      if (!opts?.silent) setLoading(true)
      try {
        const [
          session,
          sources,
          requirements,
          findings,
          findingEvidence,
          evidence,
          checklist,
          jobs,
        ] = await Promise.all([
          getSession(sessionId),
          listSources(sessionId),
          listRequirements(sessionId),
          listFindings(sessionId),
          listFindingEvidence(sessionId),
          listEvidenceWithSource(sessionId),
          listChecklist(sessionId),
          listJobs(sessionId),
        ])
        if (!mounted.current) return
        setData({ session, sources, requirements, findings, findingEvidence, evidence, checklist, jobs })
        setError(null)
      } catch (err) {
        if (!mounted.current) return
        setError(err instanceof Error ? err.message : 'Could not load this research session.')
      } finally {
        if (mounted.current) setLoading(false)
      }
    },
    [sessionId],
  )

  useEffect(() => {
    mounted.current = true
    void load()
    return () => {
      mounted.current = false
    }
  }, [load])

  const isBusy =
    data.session?.status === 'analysing' ||
    data.jobs.some((j) => j.status === 'queued' || j.status === 'running') ||
    data.sources.some((s) => s.status === 'waiting' || s.status === 'processing')

  useEffect(() => {
    if (!isBusy) return
    const timer = window.setInterval(() => {
      void load({ silent: true })
    }, 3500)
    return () => window.clearInterval(timer)
  }, [isBusy, load])

  return { ...data, loading, error, refresh: load, isBusy, setData }
}
