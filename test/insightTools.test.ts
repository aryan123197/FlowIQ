import { describe, it, expect } from 'vitest'
import { db } from '@/lib/db/client'
import { customers, transactions } from '@/lib/db/schema'
import { getRevenueTrend } from '@/lib/insights/tools/revenueTrend'
import { getFailureRate } from '@/lib/insights/tools/failureRate'
import { getPeriodComparison } from '@/lib/insights/tools/periodComparison'
import { getTopCustomers } from '@/lib/insights/tools/topCustomers'
import { getPlatformBreakdown } from '@/lib/insights/tools/platformBreakdown'
import { getAnomalies } from '@/lib/insights/tools/anomalies'

async function insertCustomer(email: string) {
  const [c] = await db.insert(customers).values({ email }).returning()
  return c.id
}

async function insertTxn(opts: {
  customerId?: string | null
  amount: number
  status?: 'completed' | 'failed' | 'pending' | 'refunded' | 'cancelled'
  platform?: 'stripe' | 'shopify' | 'salesforce' | 'csv'
  daysAgo: number
  sourceId: string
}) {
  const date = new Date()
  date.setDate(date.getDate() - opts.daysAgo)
  await db.insert(transactions).values({
    customerId: opts.customerId ?? null,
    amount: opts.amount,
    currency: 'usd',
    status: opts.status ?? 'completed',
    sourcePlatform: opts.platform ?? 'stripe',
    sourceTransactionId: opts.sourceId,
    transactionDate: date,
  })
}

describe('getRevenueTrend', () => {
  it('buckets completed revenue by day and computes percentChange', async () => {
    await insertTxn({ amount: 1000, daysAgo: 5, sourceId: 't1' })
    await insertTxn({ amount: 2000, daysAgo: 1, sourceId: 't2' })
    await insertTxn({ amount: 500, daysAgo: 5, status: 'failed', sourceId: 't3' })

    const result = await getRevenueTrend(30)
    expect(result.totalRevenue).toBe(3000)
    expect(result.buckets).toHaveLength(2)
    expect(result.percentChange).toBe(100) // 1000 -> 2000
  })

  it('returns empty buckets with zero values when no data', async () => {
    const result = await getRevenueTrend(30)
    expect(result.buckets).toEqual([])
    expect(result.totalRevenue).toBe(0)
    expect(result.slope).toBe(0)
  })
})

describe('getFailureRate', () => {
  it('computes failure rate within the window', async () => {
    await insertTxn({ amount: 100, status: 'completed', daysAgo: 0, sourceId: 't1' })
    await insertTxn({ amount: 100, status: 'failed', daysAgo: 0, sourceId: 't2' })
    await insertTxn({ amount: 100, status: 'failed', daysAgo: 0, sourceId: 't3' })
    await insertTxn({ amount: 100, status: 'completed', daysAgo: 0, sourceId: 't4' })

    const result = await getFailureRate(24)
    expect(result.currentRate).toBe(0.5)
  })

  it('returns 0 when there are no transactions in the window', async () => {
    const result = await getFailureRate(24)
    expect(result.currentRate).toBe(0)
    expect(result.rollingAvgRate).toBe(0)
  })
})

describe('getPeriodComparison', () => {
  it('compares current vs prior period revenue', async () => {
    await insertTxn({ amount: 1000, daysAgo: 2, sourceId: 'cur' }) // within current week
    await insertTxn({ amount: 500, daysAgo: 10, sourceId: 'prior' }) // within prior week

    const result = await getPeriodComparison('week')
    expect(result.current).toBe(1000)
    expect(result.prior).toBe(500)
    expect(result.deltaPercent).toBe(100)
  })
})

describe('getTopCustomers', () => {
  it('ranks customers by completed revenue and computes sharePercent', async () => {
    const aliceId = await insertCustomer('alice@example.com')
    const bobId = await insertCustomer('bob@example.com')
    await insertTxn({ customerId: aliceId, amount: 3000, daysAgo: 1, sourceId: 't1' })
    await insertTxn({ customerId: bobId, amount: 1000, daysAgo: 1, sourceId: 't2' })
    await insertTxn({ customerId: aliceId, amount: 500, status: 'failed', daysAgo: 1, sourceId: 't3' })

    const result = await getTopCustomers(5)
    expect(result.totalRevenue).toBe(4000)
    expect(result.customers[0].email).toBe('alice@example.com')
    expect(result.customers[0].revenue).toBe(3000)
    expect(result.customers[0].sharePercent).toBe(75)
  })

  it('excludes transactions with no resolved customerId', async () => {
    await insertTxn({ customerId: null, amount: 1000, daysAgo: 1, sourceId: 't1' })
    const result = await getTopCustomers(5)
    expect(result.customers).toHaveLength(0)
  })
})

describe('getPlatformBreakdown', () => {
  it('breaks down completed revenue by platform', async () => {
    await insertTxn({ amount: 1000, platform: 'stripe', daysAgo: 1, sourceId: 't1' })
    await insertTxn({ amount: 3000, platform: 'shopify', daysAgo: 1, sourceId: 't2' })
    await insertTxn({ amount: 1000, platform: 'stripe', status: 'failed', daysAgo: 1, sourceId: 't3' })

    const result = await getPlatformBreakdown()
    expect(result.totalRevenue).toBe(4000)
    const shopify = result.platforms.find(p => p.platform === 'shopify')
    expect(shopify?.revenue).toBe(3000)
    expect(shopify?.sharePercent).toBe(75)
  })
})

describe('getAnomalies', () => {
  it('returns empty when fewer than 3 days of data', async () => {
    await insertTxn({ amount: 100, daysAgo: 1, sourceId: 't1' })
    const result = await getAnomalies()
    expect(result.anomalyDays).toEqual([])
  })

  it('flags a day with revenue far outside the mean as anomalous', async () => {
    await insertTxn({ amount: 95, daysAgo: 1, sourceId: 't1' })
    await insertTxn({ amount: 110, daysAgo: 2, sourceId: 't2' })
    await insertTxn({ amount: 90, daysAgo: 3, sourceId: 't3' })
    await insertTxn({ amount: 105, daysAgo: 4, sourceId: 't4' })
    await insertTxn({ amount: 100, daysAgo: 5, sourceId: 't5' })
    await insertTxn({ amount: 1000000, daysAgo: 6, sourceId: 't6' }) // spike

    const result = await getAnomalies(2.0)
    expect(result.anomalyDays.length).toBeGreaterThan(0)
    expect(result.anomalyDays[0].zScore).toBeGreaterThan(2.0)
  })
})
