import { NextRequest } from 'next/server'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createSSEStream } from '@/lib/sse/emitter'

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params

  return createSSEStream(async (push, close) => {
    const TERMINAL_STATUSES = new Set(['completed', 'failed'])
    const MAX_POLLS = 240 // 2 minutes at 500ms

    for (let i = 0; i < MAX_POLLS; i++) {
      const [job] = await db
        .select()
        .from(syncJobs)
        .where(eq(syncJobs.id, jobId))
        .limit(1)

      if (!job) {
        push('error', { message: `Job ${jobId} not found` })
        close()
        return
      }

      push('status', {
        jobId: job.id,
        status: job.status,
        recordsProcessed: job.recordsProcessed,
        errorCount: job.errorCount,
        completedAt: job.completedAt?.toISOString() ?? null,
      })

      if (TERMINAL_STATUSES.has(job.status)) {
        close()
        return
      }

      await new Promise((r) => setTimeout(r, 500))
    }

    push('timeout', { message: 'Stream timeout — job is taking longer than expected' })
    close()
  })
}
