import { db } from '@/lib/db/client'
import { syncJobs, customers, transactions } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'
import { createConnector } from '@/lib/connectors'
import { normalizeCustomer, normalizeTransaction } from '@/lib/normalization/normalize'
import { evaluateAlerts } from '@/lib/alerts/evaluator'
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
          // CSVConnector already yields fully-normalized UnifiedTransaction records
          const unified = platform === 'csv'
            ? (raw as unknown as UnifiedTransaction)
            : normalizeTransaction(platform, raw as Record<string, unknown>)
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

    try {
      await evaluateAlerts()
    } catch (err) {
      console.error(`[alerts] Evaluation failed after job ${jobId}:`, err)
    }
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

async function resolveCustomerId(t: UnifiedTransaction): Promise<string | null> {
  if (t.customerId) return t.customerId
  if (!t.customerEmail) return null

  const [customer] = await db
    .select({ id: customers.id })
    .from(customers)
    .where(eq(customers.email, t.customerEmail))
    .limit(1)

  return customer?.id ?? null
}

async function upsertTransaction(t: UnifiedTransaction): Promise<void> {
  const customerId = await resolveCustomerId(t)

  await db
    .insert(transactions)
    .values({
      customerId,
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
        customerId,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        transactionDate: t.transactionDate,
        rawPayload: t.rawPayload ?? {},
      },
    })
}
