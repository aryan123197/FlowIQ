'use client'

import { useCallback, useMemo, useState } from 'react'
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
  type Node,
  type Edge,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { SourceNode } from './nodes/SourceNode'
import { TransformNode } from './nodes/TransformNode'
import { SinkNode } from './nodes/SinkNode'
import { SourcePanel } from './panels/SourcePanel'
import { TransformPanel } from './panels/TransformPanel'
import { SinkPanel } from './panels/SinkPanel'
import type { SourceNodeData, TransformNodeData, SinkNodeData } from './types'

const nodeTypes = { source: SourceNode, transform: TransformNode, sink: SinkNode }

export interface PipelineGraph {
  nodes: Node[]
  edges: Edge[]
}

export function PipelineCanvas({
  graph,
  onChange,
}: {
  graph: PipelineGraph
  onChange: (graph: PipelineGraph) => void
}) {
  const [nodes, setNodes] = useState<Node[]>(graph.nodes)
  const [edges, setEdges] = useState<Edge[]>(graph.edges)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const emit = useCallback(
    (nextNodes: Node[], nextEdges: Edge[]) => {
      onChange({ nodes: nextNodes, edges: nextEdges })
    },
    [onChange]
  )

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => {
      setNodes((prev) => {
        const next = applyNodeChanges(changes, prev)
        emit(next, edges)
        return next
      })
    },
    [edges, emit]
  )

  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => {
      setEdges((prev) => {
        const next = applyEdgeChanges(changes, prev)
        emit(nodes, next)
        return next
      })
    },
    [nodes, emit]
  )

  const onConnect = useCallback(
    (connection: Connection) => {
      setEdges((prev) => {
        const next = addEdge(connection, prev)
        emit(nodes, next)
        return next
      })
    },
    [nodes, emit]
  )

  const selectedNode = useMemo(
    () => nodes.find((n) => n.id === selectedId) ?? null,
    [nodes, selectedId]
  )

  function updateSelectedNodeData(data: SourceNodeData | TransformNodeData | SinkNodeData) {
    setNodes((prev) => {
      const next = prev.map((n) =>
        n.id === selectedId ? { ...n, data: data as Record<string, unknown> } : n
      )
      emit(next, edges)
      return next
    })
  }

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={(_, node) => setSelectedId(node.id)}
          onPaneClick={() => setSelectedId(null)}
          fitView
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="w-72 border-l border-zinc-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-zinc-900 capitalize">
            {selectedNode.type} node
          </h3>
          {selectedNode.type === 'source' && (
            <SourcePanel
              data={selectedNode.data as SourceNodeData}
              onChange={updateSelectedNodeData}
            />
          )}
          {selectedNode.type === 'transform' && (
            <TransformPanel
              data={selectedNode.data as TransformNodeData}
              onChange={updateSelectedNodeData}
            />
          )}
          {selectedNode.type === 'sink' && (
            <SinkPanel data={selectedNode.data as SinkNodeData} onChange={updateSelectedNodeData} />
          )}
        </div>
      )}
    </div>
  )
}
