import { db } from '@/lib/db/client'
import { bronzeEvents } from '@/lib/db/schema'
import { sql } from 'drizzle-orm'
import type { Platform } from '@/types'

export interface BronzeRecord {
  eventType: string
  sourceId?: string
  payload: Record<string, unknown>
}

// Bulk-inserts raw records into the bronze layer before normalization.
// On conflict (same platform + source_id) updates the payload so re-syncs
// always reflect the latest raw state from the source.
export async function writeBronze(
  jobId: string,
  platform: Platform,
  records: BronzeRecord[]
): Promise<void> {
  if (records.length === 0) return

  const CHUNK = 500
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    await db
      .insert(bronzeEvents)
      .values(
        chunk.map((r) => ({
          syncJobId: jobId,
          platform,
          eventType: r.eventType,
          sourceId: r.sourceId ?? null,
          payload: r.payload,
        }))
      )
      .onConflictDoUpdate({
        target: [bronzeEvents.platform, bronzeEvents.sourceId],
        set: {
          payload: sql`excluded.payload`,
          syncJobId: sql`excluded.sync_job_id`,
          ingestedAt: sql`now()`,
        },
      })
  }
}
