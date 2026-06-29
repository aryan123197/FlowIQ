import { describe, it, expect, vi, beforeEach } from 'vitest'
import { db } from '@/lib/db/client'
import { transactions, alertRules, alertTriggers } from '@/lib/db/schema'
import { calculateMetric, parseTimeWindow } from '@/lib/alerts/metricCalculator'
import { evaluateAlerts } from '@/lib/alerts/evaluator'
import { eq, isNull, and } from 'drizzle-orm'

async function insertTxn(
  amount: number,
  status: 'completed' | 'failed' = 'completed',
  daysAgo = 0
) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  await db.insert(transactions).values({
    amount,
    currency: 'usd',
    status,
    sourcePlatform: 'stripe',
    sourceTransactionId: `t-${Math.random()}`,
    transactionDate: date,
  })
}

describe('parseTimeWindow', () => {
  it('parses hours and days', () => {
    expect(parseTimeWindow('24h')).toBe(24)
    expect(parseTimeWindow('2d')).toBe(48)
  })

  it('throws on invalid format', () => {
    expect(() => parseTimeWindow('bogus')).toThrow()
  })
})

describe('calculateMetric', () => {
  it('computes revenue_total over the window', async () => {
    await insertTxn(1000)
    await insertTxn(2000)
    await insertTxn(500, 'failed')
    const value = await calculateMetric('revenue_total', '24h')
    expect(value).toBe(3000)
  })

  it('computes transaction_count over the window', async () => {
    await insertTxn(100)
    await insertTxn(100, 'failed')
    const value = await calculateMetric('transaction_count', '24h')
    expect(value).toBe(2)
  })

  it('computes failed_transaction_rate over the window', async () => {
    await insertTxn(100)
    await insertTxn(100, 'failed')
    await insertTxn(100, 'failed')
    await insertTxn(100)
    const value = await calculateMetric('failed_transaction_rate', '24h')
    expect(value).toBe(0.5)
  })

  it('excludes transactions outside the window', async () => {
    await insertTxn(1000, 'completed', 10) // 10 days ago, outside 24h window
    const value = await calculateMetric('revenue_total', '24h')
    expect(value).toBe(0)
  })
})

describe('evaluateAlerts', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }))
  })

  it('creates a trigger when a rule breaches its threshold', async () => {
    await insertTxn(100)
    const [rule] = await db
      .insert(alertRules)
      .values({
        name: 'low revenue',
        metric: 'revenue_total',
        threshold: '99999',
        comparisonOperator: 'lt',
        timeWindow: '24h',
        actionType: 'slack',
        actionConfig: { webhookUrl: 'https://example.com/hook' },
      })
      .returning()

    await evaluateAlerts()

    const triggers = await db.select().from(alertTriggers).where(eq(alertTriggers.ruleId, rule.id))
    expect(triggers).toHaveLength(1)
    expect(triggers[0].resolvedAt).toBeNull()
  })

  it('does not create a duplicate trigger while one is unresolved', async () => {
    await insertTxn(100)
    const [rule] = await db
      .insert(alertRules)
      .values({
        name: 'low revenue',
        metric: 'revenue_total',
        threshold: '99999',
        comparisonOperator: 'lt',
        timeWindow: '24h',
        actionType: 'slack',
        actionConfig: { webhookUrl: 'https://example.com/hook' },
      })
      .returning()

    await evaluateAlerts()
    await evaluateAlerts()

    const triggers = await db.select().from(alertTriggers).where(eq(alertTriggers.ruleId, rule.id))
    expect(triggers).toHaveLength(1)
  })

  it('resolves a trigger once the metric no longer breaches', async () => {
    const [rule] = await db
      .insert(alertRules)
      .values({
        name: 'low revenue',
        metric: 'revenue_total',
        threshold: '99999',
        comparisonOperator: 'lt',
        timeWindow: '24h',
        actionType: 'slack',
        actionConfig: { webhookUrl: 'https://example.com/hook' },
      })
      .returning()

    await evaluateAlerts() // breaches (0 revenue < 99999) -> creates trigger
    let unresolved = await db
      .select()
      .from(alertTriggers)
      .where(and(eq(alertTriggers.ruleId, rule.id), isNull(alertTriggers.resolvedAt)))
    expect(unresolved).toHaveLength(1)

    await insertTxn(200000) // now revenue exceeds threshold, no longer breaching
    await evaluateAlerts()

    unresolved = await db
      .select()
      .from(alertTriggers)
      .where(and(eq(alertTriggers.ruleId, rule.id), isNull(alertTriggers.resolvedAt)))
    expect(unresolved).toHaveLength(0)
  })

  it('skips disabled rules', async () => {
    await insertTxn(100)
    const [rule] = await db
      .insert(alertRules)
      .values({
        name: 'disabled rule',
        metric: 'revenue_total',
        threshold: '99999',
        comparisonOperator: 'lt',
        timeWindow: '24h',
        actionType: 'slack',
        actionConfig: { webhookUrl: 'https://example.com/hook' },
        enabled: false,
      })
      .returning()

    await evaluateAlerts()

    const triggers = await db.select().from(alertTriggers).where(eq(alertTriggers.ruleId, rule.id))
    expect(triggers).toHaveLength(0)
  })

  it('dispatches to the slack webhook on breach', async () => {
    await insertTxn(100)
    await db.insert(alertRules).values({
      name: 'low revenue',
      metric: 'revenue_total',
      threshold: '99999',
      comparisonOperator: 'lt',
      timeWindow: '24h',
      actionType: 'slack',
      actionConfig: { webhookUrl: 'https://example.com/hook' },
    })

    await evaluateAlerts()

    expect(fetch).toHaveBeenCalledWith(
      'https://example.com/hook',
      expect.objectContaining({ method: 'POST' })
    )
  })

  it('still creates the trigger even if dispatch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 }))
    await insertTxn(100)
    const [rule] = await db
      .insert(alertRules)
      .values({
        name: 'low revenue',
        metric: 'revenue_total',
        threshold: '99999',
        comparisonOperator: 'lt',
        timeWindow: '24h',
        actionType: 'slack',
        actionConfig: { webhookUrl: 'https://example.com/hook' },
      })
      .returning()

    await evaluateAlerts()

    const triggers = await db.select().from(alertTriggers).where(eq(alertTriggers.ruleId, rule.id))
    expect(triggers).toHaveLength(1)
  })
})
