import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { alertRules } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { z } from 'zod'

const bodySchema = z.object({
  name: z.string().min(1).max(255),
  metric: z.enum(['revenue_total', 'transaction_count', 'failed_transaction_rate', 'customer_count']),
  threshold: z.number(),
  comparisonOperator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']),
  timeWindow: z.string().regex(/^\d+[hd]$/).default('24h'),
  actionType: z.enum(['email', 'slack']),
  actionConfig: z.object({
    to: z.string().email().optional(),
    webhookUrl: z.string().url().optional(),
  }),
  enabled: z.boolean().default(true),
})

export async function GET() {
  const rules = await db.select().from(alertRules).orderBy(desc(alertRules.createdAt))
  return NextResponse.json(rules)
}

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { threshold, ...rest } = parsed.data

  const [rule] = await db
    .insert(alertRules)
    .values({ ...rest, threshold: threshold.toString() })
    .returning()

  return NextResponse.json(rule, { status: 201 })
}
