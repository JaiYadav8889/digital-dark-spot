import { useCallback, useState } from 'react'
import { extractSource, listRequirements, listSources, runAnalysis } from '../lib/api'
import type { Engine } from '../lib/types'

export type StepState = 'pending' | 'active' | 'done' | 'failed' | 'skipped'

export interface PipelineStep {
  key: 'extraction' | 'requirements' | 'evidence' | 'findings' | 'checklist'
  label: string
  detail: string
  state: StepState
  message?: string
}

const INITIAL_STEPS: PipelineStep[] = [
  {
    key: 'extraction',
    label: 'Extract source text',
    detail: 'Fetch and chunk each source, preserving page references.',
    state: 'pending',
  },
  {
    key: 'requirements',
    label: 'Decompose the objective',
    detail: 'Turn the research question into explicit information requirements.',
    state: 'pending',
  },
  {
    key: 'evidence',
    label: 'Map evidence to requirements',
    detail: 'Extract claims and test each requirement against them.',
    state: 'pending',
  },
  {
    key: 'findings',
    label: 'Detect gaps, conflicts and outdated signals',
    detail: 'Compare requirements and sources for coverage and consistency.',
    state: 'pending',
  },
  {
    key: 'checklist',
    label: 'Build the verification checklist',
    detail: 'Convert findings into prioritised verification actions.',
    state: 'pending',
  },
]

/**
 * Client-side orchestrator for the analysis pipeline.
 *
 * Each stage is a separate Edge Function invocation that writes its own
 * analysis_job row. Keeping the stages separate means no single request has to
 * finish inside an execution limit, and a failed stage can be retried without
 * repeating work that already succeeded.
 */
export function useAnalysisRunner(sessionId: string | undefined, refresh: () => void | Promise<void>) {
  const [steps, setSteps] = useState<PipelineStep[]>(INITIAL_STEPS)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [engine, setEngine] = useState<Engine | null>(null)

  const patch = useCallback((key: PipelineStep['key'], next: Partial<PipelineStep>) => {
    setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...next } : s)))
  }, [])

  const reset = useCallback(() => {
    setSteps(INITIAL_STEPS)
    setError(null)
  }, [])

  const run = useCallback(
    async (options?: { stage?: 'full' | 'requirements' | 'evidence'; force?: boolean }) => {
      if (!sessionId || running) return
      setRunning(true)
      setError(null)
      const stage = options?.stage ?? 'full'
      const errors: string[] = []

      try {
        // ---------------------------------------------------------- extraction
        if (stage === 'full') {
          patch('extraction', { state: 'active' })
          const sources = await listSources(sessionId)
          const pending = sources.filter((s) => s.status === 'waiting' || s.status === 'failed')
          if (pending.length === 0) {
            patch('extraction', {
              state: 'done',
              message: `${sources.filter((s) => s.status === 'extracted' || s.status === 'partial').length} source(s) already extracted`,
            })
          } else {
            let okCount = 0
            for (const source of pending) {
              const result = await extractSource(source.id, source.status === 'failed' ? 'retry' : 'fetch')
              if (result.ok) okCount += 1
              else errors.push(`${source.title}: ${result.message}`)
              await refresh()
            }
            patch('extraction', {
              state: okCount > 0 ? 'done' : 'failed',
              message:
                okCount > 0
                  ? `${okCount} of ${pending.length} source(s) extracted`
                  : 'No source could be extracted. Check that the extract-source function is deployed.',
            })
            if (okCount === 0) {
              setError(errors[0] ?? 'Extraction failed for every source.')
              setRunning(false)
              return
            }
          }
        } else {
          patch('extraction', { state: 'skipped' })
        }

        // ------------------------------------------------------- requirements
        const existingRequirements = await listRequirements(sessionId)
        if (stage === 'full' || stage === 'requirements' || options?.force) {
          if (existingRequirements.length > 0 && !options?.force) {
            patch('requirements', { state: 'done', message: `${existingRequirements.length} requirement(s) already generated` })
          } else {
            patch('requirements', { state: 'active' })
            const result = await runAnalysis(sessionId, 'requirements')
            if (!result.ok) {
              patch('requirements', { state: 'failed', message: result.message })
              setError(result.message)
              setRunning(false)
              await refresh()
              return
            }
            setEngine((result.data?.engine as Engine) ?? null)
            patch('requirements', { state: 'done', message: result.data?.message ?? 'Requirements generated' })
            await refresh()
          }
        }

        // ----------------------------------------------------------- evidence
        if (stage === 'full' || stage === 'evidence') {
          patch('evidence', { state: 'active' })
          let rounds = 0
          let processed = 0
          let lastMessage = ''
          while (rounds < 12) {
            const result = await runAnalysis(sessionId, 'evidence')
            if (!result.ok) {
              patch('evidence', {
                state: processed > 0 ? 'done' : 'failed',
                message: result.message,
              })
              errors.push(result.message)
              break
            }
            const data = result.data as { processed?: number; remaining?: number; message?: string; engine?: string }
            processed += data.processed ?? 0
            lastMessage = data.message ?? lastMessage
            if (data.engine) setEngine(data.engine as Engine)
            await refresh()
            if (!data.remaining || data.remaining <= 0) break
            rounds += 1
          }
          patch('evidence', {
            state: 'done',
            message: lastMessage || `${processed} source(s) mapped to requirements`,
          })
        }

        // ----------------------------------------------------------- findings
        if (stage === 'full') {
          patch('findings', { state: 'active' })
          const result = await runAnalysis(sessionId, 'findings')
          if (!result.ok) {
            patch('findings', { state: 'failed', message: result.message })
            errors.push(result.message)
          } else {
            if (result.data?.engine) setEngine(result.data.engine as Engine)
            patch('findings', { state: 'done', message: result.data?.message ?? 'Findings generated' })
          }
          await refresh()

          // ---------------------------------------------------------- checklist
          patch('checklist', { state: 'active' })
          const checklistResult = await runAnalysis(sessionId, 'checklist')
          if (!checklistResult.ok) {
            patch('checklist', { state: 'failed', message: checklistResult.message })
            errors.push(checklistResult.message)
          } else {
            patch('checklist', { state: 'done', message: checklistResult.data?.message ?? 'Checklist generated' })
          }
          await refresh()
        }

        if (errors.length > 0) setError(errors.join(' · '))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'The analysis pipeline failed.'
        setError(message)
        setSteps((prev) =>
          prev.map((s) => (s.state === 'active' ? { ...s, state: 'failed', message } : s)),
        )
      } finally {
        setRunning(false)
        await refresh()
      }
    },
    [sessionId, running, patch, refresh],
  )

  const hasProgress = steps.some((s) => s.state !== 'pending')

  return { steps, running, error, engine, run, reset, hasProgress }
}
