import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { syncJobs } from '@/lib/db/schema'
import { runSync } from '@/lib/engine/syncOrchestrator'

export async function POST(req: NextRequest) {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file) {
    return NextResponse.json({ error: 'No file field in form data' }, { status: 400 })
  }
  if (!file.name.toLowerCase().endsWith('.csv')) {
    return NextResponse.json({ error: 'File must have a .csv extension' }, { status: 400 })
  }

  const content = await file.text()
  if (!content.trim()) {
    return NextResponse.json({ error: 'CSV file is empty' }, { status: 400 })
  }

  const [job] = await db
    .insert(syncJobs)
    .values({ sourcePlatform: 'csv', status: 'pending' })
    .returning()

  runSync(job.id, 'csv', { csvContent: content, filename: file.name }).catch((err) =>
    console.error(`[csv-upload] Job ${job.id} failed:`, err)
  )

  return NextResponse.json({ jobId: job.id, status: 'pending' }, { status: 202 })
}
