import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { pipelineRuns, pipelineSteps } from '@/lib/db/schema'
import { eq, desc } from 'drizzle-orm'
import { createSSEStream } from '@/lib/sse/emitter'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: pipelineId } = await params
  const { searchParams } = new URL(req.url)
  const runId = searchParams.get('runId')

  return createSSEStream(async (push, close) => {
    const TERMINAL_STATUSES = new Set(['completed', 'failed'])
    const MAX_POLLS = 240 // 2 minutes at 500ms

    let activeRunId = runId
    if (!activeRunId) {
      const [latestRun] = await db
        .select()
        .from(pipelineRuns)
        .where(eq(pipelineRuns.pipelineId, pipelineId))
        .orderBy(desc(pipelineRuns.startedAt))
        .limit(1)

      if (!latestRun) {
        push('error', { message: `No runs found for pipeline ${pipelineId}` })
        close()
        return
      }
      activeRunId = latestRun.id
    }

    const seenStepUpdates = new Map<string, string>()

    for (let i = 0; i < MAX_POLLS; i++) {
      const [run] = await db.select().from(pipelineRuns).where(eq(pipelineRuns.id, activeRunId))
      if (!run) {
        push('error', { message: `Run ${activeRunId} not found` })
        close()
        return
      }

      const steps = await db
        .select()
        .from(pipelineSteps)
        .where(eq(pipelineSteps.runId, activeRunId))

      for (const step of steps) {
        const signature = `${step.status}:${step.completedAt?.toISOString() ?? ''}`
        if (seenStepUpdates.get(step.id) === signature) continue
        seenStepUpdates.set(step.id, signature)

        push('step', {
          nodeId: step.nodeId,
          nodeType: step.nodeType,
          status: step.status,
          outputMeta: step.outputMeta ?? null,
          errorMsg: step.errorMsg ?? null,
        })
      }

      if (TERMINAL_STATUSES.has(run.status)) {
        push('run-status', { runId: run.id, status: run.status })
        close()
        return
      }

      await new Promise((r) => setTimeout(r, 500))
    }

    push('timeout', { message: 'Stream timeout — pipeline run is taking longer than expected' })
    close()
  })
}
