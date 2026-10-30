/**
 * The analytical vocabulary of Digital Dark Spot.
 *
 * This module is the single source of truth for:
 *   - how an evidence relationship is named and coloured,
 *   - how a requirement status is derived (mirrors the SQL view),
 *   - how the coverage score is calculated (weights are shown in the UI),
 *   - the cautious language used everywhere in the product.
 */

import type {
  Finding,
  FindingKind,
  Importance,
  Relation,
  RequirementStatus,
  RequirementWithStatus,
  Source,
  SourceStatus,
  SourceType,
} from './types'

export type Tone = 'emerald' | 'amber' | 'coral' | 'violet' | 'ice' | 'slate'

export const TONE_CLASS: Record<Tone, { bg: string; text: string; border: string; dot: string; solid: string }> = {
  emerald: {
    bg: 'bg-emerald-muted/10',
    text: 'text-emerald-muted',
    border: 'border-emerald-muted/25',
    dot: 'bg-emerald-muted',
    solid: '#3FB98A',
  },
  amber: {
    bg: 'bg-amber-warm/10',
    text: 'text-amber-warm',
    border: 'border-amber-warm/25',
    dot: 'bg-amber-warm',
    solid: '#E8A33D',
  },
  coral: {
    bg: 'bg-coral-soft/10',
    text: 'text-coral-soft',
    border: 'border-coral-soft/25',
    dot: 'bg-coral-soft',
    solid: '#F4746A',
  },
  violet: {
    bg: 'bg-violet-brand/12',
    text: 'text-violet-soft',
    border: 'border-violet-brand/30',
    dot: 'bg-violet-brand',
    solid: '#7C5CFF',
  },
  ice: {
    bg: 'bg-ice/10',
    text: 'text-ice',
    border: 'border-ice/25',
    dot: 'bg-ice',
    solid: '#4FD1E5',
  },
  slate: {
    bg: 'bg-white/[0.04]',
    text: 'text-slatey-400',
    border: 'border-white/10',
    dot: 'bg-slatey-400',
    solid: '#8791A8',
  },
}

// ---------------------------------------------------------------------------
// 1. Evidence relationships
// ---------------------------------------------------------------------------

export const RELATION_META: Record<
  Relation,
  { label: string; short: string; tone: Tone; description: string }
> = {
  SUPPORTS: {
    label: 'Supports',
    short: 'Supports',
    tone: 'emerald',
    description: 'The excerpt directly addresses the requirement and establishes it.',
  },
  PARTIAL: {
    label: 'Partially supports',
    short: 'Partial',
    tone: 'amber',
    description:
      'The excerpt addresses the requirement but leaves an important part conditional, ambiguous or scoped to different conditions.',
  },
  CONFLICTS: {
    label: 'Apparent conflict',
    short: 'Conflict',
    tone: 'coral',
    description:
      'The excerpt appears inconsistent with another reviewed claim. Context may explain the difference; it is not proof that either is wrong.',
  },
  OUTDATED: {
    label: 'Outdated (self-declared)',
    short: 'Outdated',
    tone: 'amber',
    description:
      'The excerpt describes an earlier cycle, period or superseded approval and therefore may not describe the current position.',
  },
}

// ---------------------------------------------------------------------------
// 2. Requirement status (user-facing)
// ---------------------------------------------------------------------------

export const STATUS_META: Record<
  RequirementStatus,
  { label: string; short: string; tone: Tone; description: string }
> = {
  found: {
    label: 'Found in reviewed sources',
    short: 'Found',
    tone: 'emerald',
    description: 'At least one reviewed excerpt directly establishes this requirement.',
  },
  partial: {
    label: 'Partially supported',
    short: 'Partial',
    tone: 'amber',
    description:
      'Something relevant was found, but a substantive part of the requirement remains unaddressed.',
  },
  conflicting: {
    label: 'Conflicting evidence',
    short: 'Conflicting',
    tone: 'coral',
    description:
      'Reviewed sources appear to disagree. Check dates, cycles and conditions before relying on either claim.',
  },
  outdated: {
    label: 'Potentially outdated',
    short: 'Outdated',
    tone: 'amber',
    description:
      'The evidence available describes an earlier cycle or a lapsed approval. Its current validity is unknown.',
  },
  not_found: {
    label: 'Not found in reviewed sources',
    short: 'Not found',
    tone: 'slate',
    description:
      'No reviewed excerpt addressed this requirement. This does not establish that the information is unavailable elsewhere.',
  },
}

export const STATUS_ORDER: RequirementStatus[] = [
  'found',
  'partial',
  'conflicting',
  'outdated',
  'not_found',
]

/** Extra status surfaced in filters; not a stored requirement status. */
export const NEEDS_VERIFICATION_LABEL = 'Requires verification'

// ---------------------------------------------------------------------------
// 3. Findings
// ---------------------------------------------------------------------------

export const FINDING_META: Record<
  FindingKind,
  { label: string; plural: string; tone: Tone; icon: string; description: string }
> = {
  gap: {
    label: 'Potential gap',
    plural: 'Potential gaps',
    tone: 'violet',
    icon: 'CircleDashed',
    description: 'A requirement the reviewed evidence does not adequately establish.',
  },
  conflict: {
    label: 'Possible conflict',
    plural: 'Possible conflicts',
    tone: 'coral',
    icon: 'GitCompareArrows',
    description: 'Two or more reviewed claims appear inconsistent and need contextual checking.',
  },
  outdated: {
    label: 'Potentially outdated',
    plural: 'Potentially outdated',
    tone: 'amber',
    icon: 'History',
    description: 'Evidence that describes an earlier cycle, period or lapsed approval.',
  },
  unanswered: {
    label: 'Open question',
    plural: 'Unanswered questions',
    tone: 'ice',
    icon: 'CircleHelp',
    description: 'A precise sub-question the reviewed material does not settle.',
  },
  insight: {
    label: 'Context note',
    plural: 'Context notes',
    tone: 'violet',
    icon: 'Lightbulb',
    description: 'Useful contextual observation from the review.',
  },
}

export const IMPORTANCE_META: Record<Importance, { label: string; tone: Tone; weight: number }> = {
  high: { label: 'High', tone: 'coral', weight: 3 },
  medium: { label: 'Medium', tone: 'amber', weight: 2 },
  low: { label: 'Low', tone: 'slate', weight: 1 },
}

// ---------------------------------------------------------------------------
// 4. Source states
// ---------------------------------------------------------------------------

export const SOURCE_STATUS_META: Record<
  SourceStatus,
  { label: string; tone: Tone; description: string }
> = {
  waiting: {
    label: 'Waiting',
    tone: 'slate',
    description: 'Queued for extraction. No text has been read yet.',
  },
  processing: {
    label: 'Processing',
    tone: 'ice',
    description: 'Text is being extracted and chunked.',
  },
  extracted: {
    label: 'Successfully extracted',
    tone: 'emerald',
    description: 'Full text was extracted and is available for analysis.',
  },
  partial: {
    label: 'Partially extracted',
    tone: 'amber',
    description:
      'Only part of the content could be read. Findings based on this source are limited to the captured text.',
  },
  failed: {
    label: 'Extraction failed',
    tone: 'coral',
    description: 'No usable text was captured. This source contributed no evidence.',
  },
}

export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  official_guideline: 'Official guideline',
  government_page: 'Government page',
  parliamentary_record: 'Parliamentary record',
  secondary_guide: 'Secondary guide',
  pdf_document: 'PDF document',
  other: 'Other source',
}

// ---------------------------------------------------------------------------
// 5. Coverage score — deliberately transparent, never a magic percentage
// ---------------------------------------------------------------------------

/** Credit given to each requirement status, expressed as a fraction. */
export const COVERAGE_WEIGHTS: Record<RequirementStatus, number> = {
  found: 1,
  partial: 0.5,
  outdated: 0.4,
  conflicting: 0.25,
  not_found: 0,
}

export interface CoverageResult {
  /** 0–100, or null when the session has no requirements. */
  score: number | null
  weightedCredit: number
  weightedTotal: number
  byStatus: Record<RequirementStatus, number>
  total: number
  needsVerification: number
}

/**
 * Importance-weighted coverage.
 *
 *   score = Σ(statusWeight × importanceWeight) / Σ(importanceWeight) × 100
 *
 * A high-priority requirement therefore moves the score three times as much as
 * a low-priority one. The formula and the weights are shown in the UI so the
 * number is never presented as an unexplained verdict.
 */
export function computeCoverage(reqs: RequirementWithStatus[]): CoverageResult {
  const byStatus: Record<RequirementStatus, number> = {
    found: 0,
    partial: 0,
    conflicting: 0,
    outdated: 0,
    not_found: 0,
  }
  let weightedCredit = 0
  let weightedTotal = 0
  let needsVerification = 0

  for (const r of reqs) {
    byStatus[r.status] = (byStatus[r.status] ?? 0) + 1
    const iw = IMPORTANCE_META[r.importance]?.weight ?? 1
    weightedCredit += (COVERAGE_WEIGHTS[r.status] ?? 0) * iw
    weightedTotal += iw
    if (r.needs_verification) needsVerification += 1
  }

  return {
    score: weightedTotal === 0 ? null : Math.round((weightedCredit / weightedTotal) * 100),
    weightedCredit,
    weightedTotal,
    byStatus,
    total: reqs.length,
    needsVerification,
  }
}

/** Mirrors the SQL view logic so optimistic UI never disagrees with the DB. */
export function deriveStatus(input: {
  supports: number
  partial: number
  conflicts: number
  outdated: number
}): RequirementStatus {
  const { supports, partial, conflicts, outdated } = input
  if (conflicts > 0) return 'conflicting'
  if (supports === 0 && outdated > 0) return 'outdated'
  if (supports > 0) return 'found'
  if (partial > 0) return 'partial'
  if (outdated > 0) return 'outdated'
  return 'not_found'
}

// ---------------------------------------------------------------------------
// 5b. Provenance — the four categories the product must never blur
// ---------------------------------------------------------------------------
//
//  1 UPLOADED  a document the researcher supplied; its text was extracted here
//              but nothing was fetched from the live web to check it
//  2 LIVE      a page or file fetched from its own URL during this session
//  3 AI        a model-generated suggestion, never a conclusion
//  4 VERIFY    something a person has to confirm with the issuer
//
// The distinction is shown on every source, every excerpt and every finding, so
// no uploaded document can be read as "currently live-verified".

export type OriginCategory = 1 | 2 | 3 | 4

export const ORIGIN_META: Record<
  OriginCategory,
  { label: string; short: string; tone: Tone; description: string }
> = {
  1: {
    label: 'Uploaded demonstration source',
    short: 'Uploaded',
    tone: 'violet',
    description:
      'Supplied as a document by the researcher. Its text was extracted in this app, but it was not fetched from, or checked against, the live web here — so it is not live-verified.',
  },
  2: {
    label: 'Live retrieved source',
    short: 'Live',
    tone: 'ice',
    description:
      'Fetched from its own URL during this session. Its retrieval time is recorded above; it may still have changed since that moment.',
  },
  3: {
    label: 'AI-generated potential finding',
    short: 'AI lead',
    tone: 'amber',
    description:
      'Produced by a language model. Treat it as a lead to check, never as an established fact.',
  },
  4: {
    label: 'Requires independent verification',
    short: 'Verify',
    tone: 'slate',
    description:
      'Derived by rule from the reviewed text, or explicitly flagged for a human. Confirm it with the issuing authority before relying on it.',
  },
}

/**
 * A source is only "live retrieved" if it came from the network. Anything the
 * researcher supplied — an uploaded PDF, a runtime upload, or a typed note —
 * stays category 1 no matter how official it looks.
 */
export function sourceOrigin(
  source: Pick<Source, 'kind' | 'file_name' | 'document_path' | 'storage_path'>,
): 1 | 2 {
  if (source.kind === 'note') return 1
  if (source.document_path || source.storage_path || source.file_name) return 1
  return 2
}

/** Only a model-produced finding is labelled AI; rule-based signals are not. */
export function findingOrigin(finding: Pick<Finding, 'engine'>): 3 | 4 {
  return finding.engine === 'gemini' ? 3 : 4
}

// ---------------------------------------------------------------------------
// 6. Standing disclaimers — reused wherever a finding is displayed
// ---------------------------------------------------------------------------

export const DISCLAIMERS = {
  notFound:
    'This means the information was not found in the sources reviewed here. It does not mean the information does not exist.',
  aiSignal:
    'AI-assisted signal. Treat as a lead for verification, not as an established fact.',
  conflict:
    'Different claims are not automatically contradictions. Dates, academic years and application stages may explain the difference.',
  outdated:
    'Undated information is never labelled outdated on age alone; it is marked as having unknown current validity.',
  coverage:
    'Coverage is importance-weighted and describes only the sources reviewed in this session.',
  sourceUnavailable:
    'The original URL for this source is unavailable in the inventory, so it cannot be opened or re-checked for verification.',
} as const

/**
 * The demonstration dataset was produced from the two PDFs supplied in the Phase
 * 1 pack by this project's own extraction and analysis code. It is never
 * presented as live retrieval or live verification, and this exact sentence is
 * displayed wherever the dataset is opened.
 */
export const DEMO_DISCLAIMER =
  'Demonstration dataset built from the two documents supplied in the Phase 1 pack. Requirement titles come from the research inventory; every status, excerpt, finding and checklist item was produced by this app from the extracted text. Verify against the current official NSP portal before making application decisions.'

export const DEMO_ENGINE_NOTE =
  'The text was extracted here with PyMuPDF and analysed with the rule-based engine — no language model was called, and neither document was re-fetched from a live URL.'
