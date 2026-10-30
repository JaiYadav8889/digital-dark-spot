import { computeCoverage, type CoverageResult } from './status'
import type {
  ChecklistItem,
  EvidenceWithSource,
  Finding,
  RequirementWithStatus,
  Source,
} from './types'

export interface SessionStats {
  totalSources: number
  processedSources: number
  failedSources: number
  partialSources: number
  totalRequirements: number
  found: number
  partial: number
  conflicting: number
  outdated: number
  notFound: number
  needsVerification: number
  evidenceCount: number
  gaps: number
  conflicts: number
  outdatedFindings: number
  openQuestions: number
  openFindings: number
  tasksTotal: number
  tasksDone: number
  coverage: CoverageResult
}

export function computeStats(input: {
  sources: Source[]
  requirements: RequirementWithStatus[]
  findings: Finding[]
  evidence: EvidenceWithSource[]
  checklist: ChecklistItem[]
}): SessionStats {
  const { sources, requirements, findings, evidence, checklist } = input
  const coverage = computeCoverage(requirements)
  const openFindings = findings.filter((f) => f.status === 'open')

  return {
    totalSources: sources.length,
    processedSources: sources.filter((s) => s.status === 'extracted' || s.status === 'partial').length,
    failedSources: sources.filter((s) => s.status === 'failed').length,
    partialSources: sources.filter((s) => s.status === 'partial').length,
    totalRequirements: requirements.length,
    found: coverage.byStatus.found,
    partial: coverage.byStatus.partial,
    conflicting: coverage.byStatus.conflicting,
    outdated: coverage.byStatus.outdated,
    notFound: coverage.byStatus.not_found,
    needsVerification: coverage.needsVerification,
    evidenceCount: evidence.length,
    gaps: openFindings.filter((f) => f.kind === 'gap').length,
    conflicts: openFindings.filter((f) => f.kind === 'conflict').length,
    outdatedFindings: openFindings.filter((f) => f.kind === 'outdated').length,
    openQuestions: openFindings.filter((f) => f.kind === 'unanswered').length,
    openFindings: openFindings.length,
    tasksTotal: checklist.length,
    tasksDone: checklist.filter((c) => c.completed).length,
    coverage,
  }
}
