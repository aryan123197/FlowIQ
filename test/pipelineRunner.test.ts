import { describe, it, expect } from 'vitest'
import { db } from '@/lib/db/client'
import { transactions, pipelines, pipelineRuns, pipelineSteps, pipelineOutputs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runPipeline, type PipelineGraph } from '@/lib/engine/pipelineRunner'

async function insertTxn(amount: number, platform: 'stripe' | 'shopify' = 'stripe', sourceId = `t-${Math.random()}`) {
  await db.insert(transactions).values({
    amount, currency: 'usd', status: 'completed', sourcePlatform: platform,
    sourceTransactionId: sourceId, transactionDate: new Date(),
  })
}

async function createRun(graph: PipelineGraph) {
  const [pipeline] = await db.insert(pipelines).values({ name: 'test', graphJson: graph }).returning()
  const [run] = await db.insert(pipelineRuns).values({ pipelineId: pipeline.id, status: 'pending' }).returning()
  return run.id
}

describe('runPipeline', () => {
  it('executes source -> transform -> sink and records step outputs', async () => {
    await insertTxn(2000, 'stripe', 's1')
    await insertTxn(500, 'stripe', 's2')

    const graph: PipelineGraph = {
      nodes: [
        { id: 'src', type: 'source', data: { platform: 'stripe' } },
        { id: 'flt', type: 'transform', data: { ruleType: 'filter', config: { expression: 'amount > 1000' } } },
        { id: 'sink', type: 'sink', data: {} },
      ],
      edges: [
        { id: 'e1', source: 'src', target: 'flt' },
        { id: 'e2', source: 'flt', target: 'sink' },
      ],
    }

    const runId = await createRun(graph)
    await runPipeline(runId, graph)

    const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId))
    expect(run.status).toBe('completed')

    const steps = await db.select().from(pipelineSteps).where(eq(pipelineSteps.runId, runId))
    expect(steps).toHaveLength(3)
    expect(steps.every((s) => s.status === 'completed')).toBe(true)

    const sinkStep = steps.find((s) => s.nodeId === 'sink')!
    expect(sinkStep.outputMeta?.recordCount).toBe(1)

    const outputs = await db.select().from(pipelineOutputs).where(eq(pipelineOutputs.runId, runId))
    expect(outputs).toHaveLength(1)
    expect((outputs[0].row as Record<string, unknown>).amount).toBe(2000)
  })

  it('only includes rows from the specified source platform', async () => {
    await insertTxn(1000, 'stripe', 's3')
    await insertTxn(1000, 'shopify', 's4')

    const graph: PipelineGraph = {
      nodes: [
        { id: 'src', type: 'source', data: { platform: 'shopify' } },
        { id: 'sink', type: 'sink', data: {} },
      ],
      edges: [{ id: 'e1', source: 'src', target: 'sink' }],
    }

    const runId = await createRun(graph)
    await runPipeline(runId, graph)

    const steps = await db.select().from(pipelineSteps).where(eq(pipelineSteps.runId, runId))
    const sinkStep = steps.find((s) => s.nodeId === 'sink')!
    expect(sinkStep.outputMeta?.recordCount).toBe(1)
  })

  it('marks the run and step failed when a transform throws', async () => {
    await insertTxn(1000, 'stripe', 's5')

    const graph: PipelineGraph = {
      nodes: [
        { id: 'src', type: 'source', data: { platform: 'stripe' } },
        { id: 'bad', type: 'transform', data: { ruleType: 'filter', config: { expression: 'amount >' } } },
      ],
      edges: [{ id: 'e1', source: 'src', target: 'bad' }],
    }

    const runId = await createRun(graph)
    await expect(runPipeline(runId, graph)).rejects.toThrow()

    const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, runId))
    expect(run.status).toBe('failed')

    const steps = await db.select().from(pipelineSteps).where(eq(pipelineSteps.runId, runId))
    const badStep = steps.find((s) => s.nodeId === 'bad')!
    expect(badStep.status).toBe('failed')
    expect(badStep.errorMsg).toBeTruthy()
  })

  it('rejects a graph containing a cycle', async () => {
    const graph: PipelineGraph = {
      nodes: [
        { id: 'a', type: 'source', data: {} },
        { id: 'b', type: 'transform', data: { ruleType: 'dedupe', config: { keyFields: ['id'] } } },
      ],
      edges: [
        { id: 'e1', source: 'a', target: 'b' },
        { id: 'e2', source: 'b', target: 'a' },
      ],
    }

    const runId = await createRun(graph)
    await expect(runPipeline(runId, graph)).rejects.toThrow(/cycle/)
  })

  it('runs multiple transforms in sequence, applying each to the prior output', async () => {
    await insertTxn(1000, 'stripe', 's6')
    await insertTxn(1000, 'stripe', 's7')

    const graph: PipelineGraph = {
      nodes: [
        { id: 'src', type: 'source', data: { platform: 'stripe' } },
        { id: 'rn', type: 'transform', data: { ruleType: 'rename', config: { columnMap: { amount: 'total' } } } },
        { id: 'dd', type: 'transform', data: { ruleType: 'dedupe', config: { keyFields: ['total'] } } },
        { id: 'sink', type: 'sink', data: {} },
      ],
      edges: [
        { id: 'e1', source: 'src', target: 'rn' },
        { id: 'e2', source: 'rn', target: 'dd' },
        { id: 'e3', source: 'dd', target: 'sink' },
      ],
    }

    const runId = await createRun(graph)
    await runPipeline(runId, graph)

    const steps = await db.select().from(pipelineSteps).where(eq(pipelineSteps.runId, runId))
    const sinkStep = steps.find((s) => s.nodeId === 'sink')!
    expect(sinkStep.outputMeta?.recordCount).toBe(1) // both rows have total=1000, deduped to 1
    expect((sinkStep.outputMeta?.sampleRows?.[0] as Record<string, unknown>).total).toBe(1000)
  })
})
