import { describe, it, expect } from 'vitest'
import { db } from '@/lib/db/client'
import { syncJobs, customers, transactions } from '@/lib/db/schema'
import { runSync } from '@/lib/engine/syncOrchestrator'
import { eq } from 'drizzle-orm'

async function createJob(platform: 'shopify' | 'salesforce' | 'csv') {
  const [job] = await db
    .insert(syncJobs)
    .values({ sourcePlatform: platform, status: 'pending' })
    .returning()
  return job.id
}

describe('runSync — shopify', () => {
  it('upserts 5 customers and 8 transactions, marks job completed', async () => {
    const jobId = await createJob('shopify')
    await runSync(jobId, 'shopify')

    const allCustomers = await db.select().from(customers)
    const allTransactions = await db.select().from(transactions)
    expect(allCustomers).toHaveLength(5)
    expect(allTransactions).toHaveLength(8)

    const [job] = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId))
    expect(job.status).toBe('completed')
    expect(job.recordsProcessed).toBe(13)
    expect(job.errorCount).toBe(0)
  })

  it('resolves transaction.customerId by matching customer email', async () => {
    const jobId = await createJob('shopify')
    await runSync(jobId, 'shopify')

    const [emma] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, 'emma.watson@example.com'))
    const emmaTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.customerId, emma.id))
    expect(emmaTxns).toHaveLength(2) // shp_ord_001 and shp_ord_004
  })

  it('stores amounts as integer cents and lowercase currency', async () => {
    const jobId = await createJob('shopify')
    await runSync(jobId, 'shopify')

    const [txn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.sourceTransactionId, 'shp_ord_001'))
    expect(txn.amount).toBe(14999)
    expect(txn.currency).toBe('usd')
  })

  it('is idempotent — running twice does not duplicate rows', async () => {
    const jobId1 = await createJob('shopify')
    await runSync(jobId1, 'shopify')
    const jobId2 = await createJob('shopify')
    await runSync(jobId2, 'shopify')

    const allCustomers = await db.select().from(customers)
    const allTransactions = await db.select().from(transactions)
    expect(allCustomers).toHaveLength(5)
    expect(allTransactions).toHaveLength(8)
  })
})

describe('runSync — salesforce', () => {
  it('only syncs Closed Won opportunities as transactions', async () => {
    const jobId = await createJob('salesforce')
    await runSync(jobId, 'salesforce')

    const allTransactions = await db.select().from(transactions)
    expect(allTransactions).toHaveLength(4) // 5 opps total, 1 is Closed Lost
  })

  it('converts dollar amounts to integer cents', async () => {
    const jobId = await createJob('salesforce')
    await runSync(jobId, 'salesforce')

    const [txn] = await db
      .select()
      .from(transactions)
      .where(eq(transactions.sourceTransactionId, 'sf_opp_001'))
    expect(txn.amount).toBe(1250000)
  })

  it('resolves customerId via ContactEmail match', async () => {
    const jobId = await createJob('salesforce')
    await runSync(jobId, 'salesforce')

    const [noah] = await db
      .select()
      .from(customers)
      .where(eq(customers.email, 'noah.williams@acmecorp.com'))
    const noahTxns = await db
      .select()
      .from(transactions)
      .where(eq(transactions.customerId, noah.id))
    expect(noahTxns).toHaveLength(2) // sf_opp_001 and sf_opp_004
  })
})

describe('runSync — csv', () => {
  it('parses valid rows and skips invalid ones without failing the whole job', async () => {
    const rows = ['email,amount,currency,status,date,id']
    for (let i = 0; i < 19; i++)
      rows.push(`good${i}@example.com,19.99,usd,completed,2024-01-01,row${i}`)
    rows.push('not-an-email,29.99,usd,completed,2024-01-02,row-bad')
    const csv = rows.join('\n')

    const jobId = await createJob('csv')
    await runSync(jobId, 'csv', { csvContent: csv })

    const allTransactions = await db.select().from(transactions)
    expect(allTransactions).toHaveLength(19)

    const [job] = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId))
    expect(job.status).toBe('completed')
    expect(job.recordsProcessed).toBe(19)
  })

  it('fails the job when CSV error rate exceeds 5%', async () => {
    const rows = ['email,amount,date,id']
    for (let i = 0; i < 20; i++) {
      rows.push(
        i < 5 ? `not-an-email,10,2024-01-01,row${i}` : `good${i}@example.com,10,2024-01-01,row${i}`
      )
    }
    const csv = rows.join('\n')

    const jobId = await createJob('csv')
    await expect(runSync(jobId, 'csv', { csvContent: csv })).rejects.toThrow(/error rate too high/)

    const [job] = await db.select().from(syncJobs).where(eq(syncJobs.id, jobId))
    expect(job.status).toBe('failed')
  })
})
