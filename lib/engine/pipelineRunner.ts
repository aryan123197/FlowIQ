import { db } from '@/lib/db/client'
import { pipelineRuns, pipelineSteps } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { executeNode, type GraphNode } from './stepExecutor'

export interface GraphEdge {
  id: string
  source: string
  target: string
}

export interface PipelineGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
}

function topologicalSort(graph: PipelineGraph): GraphNode[] {
  const nodeMap = new Map(graph.nodes.map((n) => [n.id, n]))
  const inDegree = new Map<string, number>(graph.nodes.map((n) => [n.id, 0]))
  const adjacency = new Map<string, string[]>(graph.nodes.map((n) => [n.id, []]))

  for (const edge of graph.edges) {
    if (!nodeMap.has(edge.source) || !nodeMap.has(edge.target)) {
      throw new Error(`Edge ${edge.id} references a node that does not exist`)
    }
    adjacency.get(edge.source)!.push(edge.target)
    inDegree.set(edge.target, (inDegree.get(edge.target) ?? 0) + 1)
  }

  const queue: string[] = []
  for (const [id, degree] of inDegree) {
    if (degree === 0) queue.push(id)
  }

  const sorted: GraphNode[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    sorted.push(nodeMap.get(id)!)

    for (const neighbor of adjacency.get(id) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 0) - 1
      inDegree.set(neighbor, newDegree)
      if (newDegree === 0) queue.push(neighbor)
    }
  }

  if (sorted.length !== graph.nodes.length) {
    throw new Error('Pipeline graph contains a cycle — cannot execute')
  }

  return sorted
}

function validateGraph(graph: PipelineGraph): void {
  for (const node of graph.nodes) {
    if (node.type === 'transform' && !node.data.ruleType) {
      throw new Error(`Transform node ${node.id} is not configured — no rule type selected`)
    }
  }
}

export async function runPipeline(runId: string, graph: PipelineGraph): Promise<void> {
  try {
    await db.update(pipelineRuns).set({ status: 'running' }).where(eq(pipelineRuns.id, runId))

    validateGraph(graph)
    const sortedNodes = topologicalSort(graph)

    const stepRows = await db
      .insert(pipelineSteps)
      .values(
        sortedNodes.map((node) => ({
          runId,
          nodeId: node.id,
          nodeType: node.type,
          status: 'pending' as const,
        }))
      )
      .returning()
    const stepIdByNodeId = new Map(stepRows.map((s) => [s.nodeId, s.id]))

    const outputByNodeId = new Map<string, Record<string, unknown>[]>()
    const incomingByNodeId = new Map<string, string[]>()
    for (const edge of graph.edges) {
      if (!incomingByNodeId.has(edge.target)) incomingByNodeId.set(edge.target, [])
      incomingByNodeId.get(edge.target)!.push(edge.source)
    }

    for (const node of sortedNodes) {
      const stepId = stepIdByNodeId.get(node.id)!

      await db
        .update(pipelineSteps)
        .set({ status: 'running', startedAt: new Date() })
        .where(eq(pipelineSteps.id, stepId))

      try {
        const sources = incomingByNodeId.get(node.id) ?? []
        const inputRows = sources.flatMap((sourceId) => outputByNodeId.get(sourceId) ?? [])

        const output = await executeNode(node, inputRows, runId)
        outputByNodeId.set(node.id, output)

        await db
          .update(pipelineSteps)
          .set({
            status: 'completed',
            completedAt: new Date(),
            outputMeta: { recordCount: output.length, sampleRows: output.slice(0, 5) },
          })
          .where(eq(pipelineSteps.id, stepId))
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        await db
          .update(pipelineSteps)
          .set({ status: 'failed', completedAt: new Date(), errorMsg: message })
          .where(eq(pipelineSteps.id, stepId))
        throw err
      }
    }

    await db
      .update(pipelineRuns)
      .set({ status: 'completed', completedAt: new Date() })
      .where(eq(pipelineRuns.id, runId))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(pipelineRuns)
      .set({ status: 'failed', completedAt: new Date(), errorDetails: [{ message }] })
      .where(eq(pipelineRuns.id, runId))
    throw err
  }
}
