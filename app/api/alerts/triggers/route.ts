import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { alertTriggers } from '@/lib/db/schema'
import { desc, eq } from 'drizzle-orm'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const ruleId = searchParams.get('ruleId')

  const triggers = await db
    .select()
    .from(alertTriggers)
    .where(ruleId ? eq(alertTriggers.ruleId, ruleId) : undefined)
    .orderBy(desc(alertTriggers.triggeredAt))
    .limit(100)

  return NextResponse.json(triggers)
}
