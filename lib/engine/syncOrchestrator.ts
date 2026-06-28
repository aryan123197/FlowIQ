import { db } from '@/lib/db/client'
import { syncJobs, customers, transactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createConnector } from '@/lib/connectors'
import { normalizeCustomer, normalizeTransaction } from '@/lib/normalization/normalize'
import type { Platform, UnifiedCustomer, UnifiedTransaction } from '@/types'

export interface SyncOptions {
  csvContent?: string
}

export async function runSync(
  jobId: string,
  platform: Platform,
  options: SyncOptions = {}
): Promise<void> {
  const errors: Array<{ message: string; record?: unknown }> = []
  let recordsProcessed = 0
  let errorCount = 0

  try {
    await db
      .update(syncJobs)
      .set({ status: 'running' })
      .where(eq(syncJobs.id, jobId))

    const connectorConfig: Record<string, unknown> = {}
    if (platform === 'csv' && options.csvContent) {
      connectorConfig.content = options.csvContent
    }

    const connector = createConnector(platform, connectorConfig)
    await connector.validate()

    // --- Sync customers (not applicable for CSV) ---
    if (platform !== 'csv') {
      for await (const batch of connector.fetchCustomers()) {
        for (const raw of batch) {
          try {
            const unified = normalizeCustomer(platform, raw as Record<string, unknown>)
            await upsertCustomer(unified)
            recordsProcessed++
          } catch (err) {
            errorCount++
            errors.push({
              message: err instanceof Error ? err.message : String(err),
              record: raw,
            })
          }
        }
      }
    }

    // --- Sync transactions ---
    for await (const batch of connector.fetchTransactions()) {
      for (const raw of batch) {
        try {
          const unified = normalizeTransaction(platform, raw as Record<string, unknown>)
          await upsertTransaction(unified)
          recordsProcessed++
        } catch (err) {
          errorCount++
          errors.push({
            message: err instanceof Error ? err.message : String(err),
            record: raw,
          })
        }
      }
    }

    await db
      .update(syncJobs)
      .set({
        status: 'completed',
        completedAt: new Date(),
        recordsProcessed,
        errorCount,
        errorDetails: errors,
      })
      .where(eq(syncJobs.id, jobId))
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await db
      .update(syncJobs)
      .set({
        status: 'failed',
        completedAt: new Date(),
        recordsProcessed,
        errorCount: errorCount + 1,
        errorDetails: [...errors, { message }],
      })
      .where(eq(syncJobs.id, jobId))
    throw err
  }
}

async function upsertCustomer(c: UnifiedCustomer): Promise<void> {
  await db
    .insert(customers)
    .values({
      email: c.email,
      name: c.name ?? null,
      stripeId: c.stripeId ?? null,
      shopifyId: c.shopifyId ?? null,
      salesforceId: c.salesforceId ?? null,
      attributes: c.attributes ?? {},
    })
    .onConflictDoUpdate({
      target: customers.email,
      set: {
        name: c.name ?? null,
        stripeId: c.stripeId ?? null,
        shopifyId: c.shopifyId ?? null,
        salesforceId: c.salesforceId ?? null,
        attributes: c.attributes ?? {},
        updatedAt: new Date(),
      },
    })
}

async function upsertTransaction(t: UnifiedTransaction): Promise<void> {
  await db
    .insert(transactions)
    .values({
      customerId: t.customerId ?? null,
      sourcePlatform: t.sourcePlatform,
      sourceTransactionId: t.sourceTransactionId,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      transactionDate: t.transactionDate,
      rawPayload: t.rawPayload ?? {},
    })
    .onConflictDoUpdate({
      target: [transactions.sourcePlatform, transactions.sourceTransactionId],
      set: {
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        transactionDate: t.transactionDate,
        rawPayload: t.rawPayload ?? {},
      },
    })
}
