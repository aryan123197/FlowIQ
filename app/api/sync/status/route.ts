import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10), 100)

  const jobs = await db
    .select()
    .from(syncJobs)
    .orderBy(desc(syncJobs.startedAt))
    .limit(limit)

  return NextResponse.json({ jobs })
}
