'use client'

import { useParams } from 'next/navigation'
import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { PipelineCanvas, type PipelineGraph } from '@/components/pipeline/PipelineCanvas'
import { PipelineToolbar } from '@/components/pipeline/PipelineToolbar'
import { PipelineRunLog } from '@/components/pipeline/PipelineRunLog'
import type { TransformNodeData } from '@/components/pipeline/types'
import type { Node } from '@xyflow/react'

interface Pipeline {
  id: string
  name: string
  graphJson: PipelineGraph
}

let nodeCounter = 0
function nextNodeId(type: string) {
  nodeCounter += 1
  return `${type}-${Date.now()}-${nodeCounter}`
}

export default function PipelineBuilderPage() {
  const { id } = useParams<{ id: string }>()
  return <PipelineBuilder key={id} id={id} />
}

function PipelineBuilder({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [graph, setGraph] = useState<PipelineGraph | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)

  const { data: pipeline, error } = useQuery({
    queryKey: ['pipeline', id],
    queryFn: async () => {
      const res = await fetch(`/api/pipelines/${id}`)
      if (!res.ok) throw new Error('Failed to load pipeline')
      const json = (await res.json()) as Pipeline
      setGraph((prev) => prev ?? json.graphJson ?? { nodes: [], edges: [] })
      return json
    },
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pipelines/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graphJson: graph }),
      })
      if (!res.ok) throw new Error('Failed to save pipeline')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['pipeline', id] }),
  })

  const runMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch(`/api/pipelines/${id}/run`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed to start run')
      return res.json() as Promise<{ runId: string }>
    },
    onSuccess: ({ runId }) => setActiveRunId(runId),
  })

  const handleAddNode = useCallback((type: 'source' | 'transform' | 'sink') => {
    const node: Node = {
      id: nextNodeId(type),
      type,
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      data: {},
    }
    setGraph((prev) => ({
      nodes: [...(prev?.nodes ?? []), node],
      edges: prev?.edges ?? [],
    }))
  }, [])

  const hasUnconfiguredTransform = graph?.nodes.some(
    (n) => n.type === 'transform' && !(n.data as TransformNodeData)?.ruleType
  )

  const handleSettled = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['pipeline-runs', id] })
  }, [id, queryClient])

  if (error) {
    return <div className="px-4 py-2 text-sm text-red-600">Failed to load pipeline.</div>
  }

  if (!graph) {
    return <div className="px-4 py-2 text-sm text-zinc-400">Loading...</div>
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      <div className="flex items-center justify-between px-4 py-2">
        <h1 className="text-lg font-semibold text-zinc-900">{pipeline?.name}</h1>
      </div>

      <PipelineToolbar
        onAddNode={handleAddNode}
        onSave={() => saveMutation.mutate()}
        onRun={() => runMutation.mutate()}
        saving={saveMutation.isPending}
        running={runMutation.isPending}
        runDisabled={hasUnconfiguredTransform}
      />

      <div className="flex-1">
        <PipelineCanvas graph={graph} onChange={setGraph} />
      </div>

      {activeRunId && (
        <div className="max-h-64 overflow-y-auto border-t border-zinc-200 p-4">
          <PipelineRunLog pipelineId={id} runId={activeRunId} onSettled={handleSettled} />
        </div>
      )}
    </div>
  )
}
