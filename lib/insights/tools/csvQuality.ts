import { db } from '@/lib/db/client'
import { csvUploads } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import type { CsvQualityResult } from '../types'

export async function getCsvQuality(limit: number = 3): Promise<CsvQualityResult> {
  const rows = await db.select().from(csvUploads).orderBy(desc(csvUploads.createdAt)).limit(limit)

  const uploads = rows.map((r) => ({
    filename: r.filename,
    uploadedAt: r.createdAt.toISOString(),
    headers: r.headers,
    totalRows: r.totalRows,
    errorRows: r.errorRows,
    errorRate: r.totalRows === 0 ? 0 : r.errorRows / r.totalRows,
    sampleErrorRows: r.sampleErrorRows ?? [],
  }))

  return { uploads }
}
