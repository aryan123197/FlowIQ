import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema'
import { runSync } from '@/lib/engine/syncOrchestrator'
import { z } from 'zod'

const bodySchema = z.object({
  platform: z.enum(['stripe', 'shopify', 'salesforce', 'csv']),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid platform. Must be one of: stripe, shopify, salesforce, csv' },
      { status: 400 }
    )
  }

  const { platform } = parsed.data

  const [job] = await db
    .insert(syncJobs)
    .values({ sourcePlatform: platform, status: 'pending' })
    .returning()

  // Fire and forget — response returns immediately
  runSync(job.id, platform).catch((err) =>
    console.error(`[sync] Job ${job.id} failed:`, err)
  )

  return NextResponse.json({ jobId: job.id, status: 'pending' }, { status: 202 })
}
