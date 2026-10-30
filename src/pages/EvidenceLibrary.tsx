import { useEffect, useMemo, useState } from 'react'
import { Library, Search, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import { useShellHeader } from '../components/layout/AppShell'
import { EvidenceCard } from '../components/session/EvidenceCard'
import { Badge, EmptyState, Input, Segmented, Skeleton } from '../components/ui/primitives'
import { listAllEvidence, type EvidenceLibraryRow } from '../lib/api'
import { SOURCE_TYPE_LABEL, RELATION_META } from '../lib/status'
import type { Relation, SourceType } from '../lib/types'
import { cn } from '../lib/utils'

export default function EvidenceLibrary() {
  const [rows, setRows] = useState<EvidenceLibraryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [relation, setRelation] = useState<'all' | Relation>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | SourceType>('all')
  const [query, setQuery] = useState('')

  useShellHeader({ title: 'Evidence library', subtitle: 'Every excerpt retained across your investigations' })

  useEffect(() => {
    listAllEvidence()
      .then(setRows)
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the evidence library.'))
      .finally(() => setLoading(false))
  }, [])

  const typeCounts = useMemo(() => {
    const map = new Map<SourceType, number>()
    rows.forEach((r) => map.set(r.source.source_type, (map.get(r.source.source_type) ?? 0) + 1))
    return map
  }, [rows])

  const visible = useMemo(() => {
    let list = rows
    if (relation !== 'all') list = list.filter((r) => r.links.some((l) => l.relation === relation))
    if (typeFilter !== 'all') list = list.filter((r) => r.source.source_type === typeFilter)
    if (query.trim()) {
      const q = query.trim().toLowerCase()
      list = list.filter(
        (r) =>
          r.claim_text.toLowerCase().includes(q) ||
          r.source.title.toLowerCase().includes(q) ||
          r.session_title.toLowerCase().includes(q) ||
          (r.source.issuer ?? '').toLowerCase().includes(q),
      )
    }
    return list
  }, [rows, relation, typeFilter, query])

  if (loading) {
    return (
      <div className="mx-auto grid max-w-[1500px] gap-3 lg:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40" />
        ))}
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-[1500px] space-y-4">
      {error ? (
        <div className="flex items-start gap-2 rounded-xl border border-coral-soft/25 bg-coral-soft/[0.07] px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-coral-soft" />
          <p className="text-[11.5px] text-slatey-300">{error}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <Segmented
          size="sm"
          value={relation}
          onChange={(v) => setRelation(v as 'all' | Relation)}
          options={[
            { value: 'all', label: 'All', count: rows.length },
            ...(['SUPPORTS', 'PARTIAL', 'CONFLICTS', 'OUTDATED'] as Relation[]).map((r) => ({
              value: r,
              label: RELATION_META[r].short,
              count: rows.filter((row) => row.links.some((l) => l.relation === r)).length,
            })),
          ]}
        />
        <div className="relative ml-auto w-full sm:w-72">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slatey-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search text, source or session…"
            className="h-8 pl-8 text-[12px]"
            aria-label="Search the evidence library"
          />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="flex items-center gap-1 text-[10.5px] text-slatey-400">
          <SlidersHorizontal className="h-3 w-3" /> Source type
        </span>
        <button
          onClick={() => setTypeFilter('all')}
          className={cn(
            'rounded-md border px-2 py-1 text-[10.5px] transition-colors',
            typeFilter === 'all' ? 'border-white/25 bg-white/[0.07] text-white' : 'border-white/[0.08] text-slatey-400 hover:text-slatey-200',
          )}
        >
          All ({rows.length})
        </button>
        {Array.from(typeCounts.entries()).map(([type, count]) => (
          <button
            key={type}
            onClick={() => setTypeFilter(type)}
            className={cn(
              'rounded-md border px-2 py-1 text-[10.5px] transition-colors',
              typeFilter === type
                ? 'border-white/25 bg-white/[0.07] text-white'
                : 'border-white/[0.08] text-slatey-400 hover:text-slatey-200',
            )}
          >
            {SOURCE_TYPE_LABEL[type]} ({count})
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<Library className="h-5 w-5" />}
          title={rows.length === 0 ? 'The evidence library is empty' : 'No excerpts match these filters'}
          description={
            rows.length === 0
              ? 'Once sources are extracted and analysed, every supporting and conflicting excerpt is retained here with its provenance.'
              : 'Try another relationship, source type or search term.'
          }
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {visible.map((item) => {
            const strongest = item.links[0]
            return (
              <div key={item.id} className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Badge tone="slate">{item.session_title}</Badge>
                  <span className="text-[10px] text-slatey-400">{SOURCE_TYPE_LABEL[item.source.source_type]}</span>
                </div>
                <EvidenceCard evidence={item} relation={strongest?.relation} rationale={strongest?.rationale} />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
