import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db/client'
import { alertRules } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

const patchSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  metric: z.enum(['revenue_total', 'transaction_count', 'failed_transaction_rate', 'customer_count']).optional(),
  threshold: z.number().optional(),
  comparisonOperator: z.enum(['gt', 'lt', 'gte', 'lte', 'eq']).optional(),
  timeWindow: z.string().regex(/^\d+[hd]$/).optional(),
  actionType: z.enum(['email', 'slack']).optional(),
  actionConfig: z.object({
    to: z.string().email().optional(),
    webhookUrl: z.string().url().optional(),
  }).optional(),
  enabled: z.boolean().optional(),
})

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { threshold, ...rest } = parsed.data
  const updates: Record<string, unknown> = { ...rest }
  if (threshold !== undefined) updates.threshold = threshold.toString()

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 })
  }

  const [rule] = await db
    .update(alertRules)
    .set(updates)
    .where(eq(alertRules.id, id))
    .returning()

  if (!rule) {
    return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
  }

  return NextResponse.json(rule)
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params

  const [rule] = await db
    .delete(alertRules)
    .where(eq(alertRules.id, id))
    .returning()

  if (!rule) {
    return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 })
  }

  return NextResponse.json({ success: true })
}
