'use client'

import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'

interface StepEvent {
  nodeId: string
  nodeType: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  outputMeta: { recordCount: number; sampleRows?: unknown[] } | null
  errorMsg: string | null
}

export function PipelineRunLog({
  pipelineId,
  runId,
  onSettled,
}: {
  pipelineId: string
  runId: string
  onSettled?: () => void
}) {
  const [steps, setSteps] = useState<Map<string, StepEvent>>(new Map())
  const [runStatus, setRunStatus] = useState<string>('running')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    setSteps(new Map())
    setRunStatus('running')
    setMessage(null)

    const source = new EventSource(`/api/pipelines/${pipelineId}/stream?runId=${runId}`)

    source.addEventListener('step', (event) => {
      const payload = JSON.parse(event.data) as StepEvent
      setSteps((prev) => new Map(prev).set(payload.nodeId, payload))
    })

    source.addEventListener('run-status', (event) => {
      const payload = JSON.parse(event.data) as { status: string }
      setRunStatus(payload.status)
      onSettled?.()
      source.close()
    })

    source.addEventListener('timeout', (event) => {
      const payload = JSON.parse(event.data) as { message: string }
      setMessage(payload.message)
      source.close()
    })

    source.addEventListener('error', (event) => {
      if (event instanceof MessageEvent && event.data) {
        const payload = JSON.parse(event.data) as { message: string }
        setMessage(payload.message)
      }
      source.close()
    })

    return () => source.close()
  }, [pipelineId, runId, onSettled])

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 bg-white p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        {runStatus === 'running' && <Spinner />}
        Run status
        <StatusBadge status={runStatus} />
      </div>

      {message && <p className="text-xs text-red-600">{message}</p>}

      <ul className="flex flex-col gap-1">
        {Array.from(steps.values()).map((step) => (
          <li key={step.nodeId} className="flex items-center gap-2 text-xs">
            <StatusBadge status={step.status} />
            <span className="text-zinc-500">
              {step.nodeType} <span className="text-zinc-900">{step.nodeId}</span>
            </span>
            {step.outputMeta && (
              <span className="text-zinc-400">{step.outputMeta.recordCount} rows</span>
            )}
            {step.errorMsg && <span className="text-red-600">{step.errorMsg}</span>}
          </li>
        ))}
      </ul>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'completed') return <Badge variant="success">completed</Badge>
  if (status === 'failed') return <Badge variant="danger">failed</Badge>
  if (status === 'running') return <Badge variant="info">running</Badge>
  return <Badge variant="default">{status}</Badge>
}
