import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { pipelines, pipelineRuns } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { runPipeline, type PipelineGraph } from '@/lib/engine/pipelineRunner'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [pipeline] = await db.select().from(pipelines).where(eq(pipelines.id, id))
  if (!pipeline) {
    return NextResponse.json({ error: 'Pipeline not found' }, { status: 404 })
  }

  const [run] = await db.insert(pipelineRuns).values({ pipelineId: id, status: 'pending' }).returning()

  runPipeline(run.id, pipeline.graphJson as unknown as PipelineGraph).catch((err) =>
    console.error(`[pipeline] Run ${run.id} failed:`, err)
  )

  return NextResponse.json({ runId: run.id, status: 'pending' }, { status: 202 })
}
