import { db } from '@/lib/db/client'
import { syncJobs, customers, transactions, csvUploads } from '@/lib/db/schema'
import { eq, inArray, sql } from 'drizzle-orm'
import { createConnector } from '@/lib/connectors'
import { normalizeCustomer, normalizeTransaction } from '@/lib/normalization/normalize'
import { evaluateAlerts } from '@/lib/alerts/evaluator'
import { writeBronze } from '@/lib/medallion/bronze'
import { refreshGold } from '@/lib/medallion/gold'
import type { CSVConnector } from '@/lib/connectors/csv'
import type { Platform, UnifiedCustomer, UnifiedTransaction } from '@/types'

export interface SyncOptions {
  csvContent?: string
  filename?: string
}

interface BatchOutcome {
  processed: number
  errors: Array<{ message: string; record?: unknown }>
}

export async function runSync(
  jobId: string,
  platform: Platform,
  options: SyncOptions = {}
): Promise<void> {
  const errors: Array<{ message: string; record?: unknown }> = []
  let recordsProcessed = 0
  let errorCount = 0
  let csvConnector: CSVConnector | undefined
  let csvSummaryPersisted = false

  try {
    await db.update(syncJobs).set({ status: 'running' }).where(eq(syncJobs.id, jobId))

    const connectorConfig: Record<string, unknown> = {}
    if (platform === 'csv' && options.csvContent) {
      connectorConfig.content = options.csvContent
    }

    const connector = createConnector(platform, connectorConfig)
    if (platform === 'csv') csvConnector = connector as CSVConnector
    await connector.validate()

    // --- Sync customers (not applicable for CSV) ---
    if (platform !== 'csv') {
      for await (const batch of connector.fetchCustomers()) {
        // Bronze: persist raw customer records before normalization
        await writeBronze(
          jobId,
          platform,
          batch.map((raw) => ({
            eventType: 'customer',
            sourceId: (raw as Record<string, unknown>).id as string | undefined,
            payload: raw as Record<string, unknown>,
          }))
        )

        const unified: UnifiedCustomer[] = []
        for (const raw of batch) {
          try {
            unified.push(normalizeCustomer(platform, raw as Record<string, unknown>))
          } catch (err) {
            errorCount++
            errors.push({ message: err instanceof Error ? err.message : String(err), record: raw })
          }
        }
        const outcome = await upsertCustomers(unified)
        recordsProcessed += outcome.processed
        errorCount += outcome.errors.length
        errors.push(...outcome.errors)
      }
    }

    // --- Sync transactions ---
    for await (const batch of connector.fetchTransactions()) {
      // Bronze: persist raw transaction records before normalization
      await writeBronze(
        jobId,
        platform,
        batch.map((raw) => ({
          eventType: 'transaction',
          sourceId: (raw as Record<string, unknown>).id as string | undefined,
          payload: raw as Record<string, unknown>,
        }))
      )

      const unified: UnifiedTransaction[] = []
      for (const raw of batch) {
        try {
          // CSVConnector already yields fully-normalized UnifiedTransaction records
          unified.push(
            platform === 'csv'
              ? (raw as unknown as UnifiedTransaction)
              : normalizeTransaction(platform, raw as Record<string, unknown>)
          )
        } catch (err) {
          errorCount++
          errors.push({ message: err instanceof Error ? err.message : String(err), record: raw })
        }
      }
      const outcome = await upsertTransactions(unified)
      recordsProcessed += outcome.processed
      errorCount += outcome.errors.length
      errors.push(...outcome.errors)
    }

    if (csvConnector) {
      await persistCsvUploadSummary(jobId, csvConnector, options.filename)
      csvSummaryPersisted = true
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

    // Gold: refresh daily aggregates from the updated silver layer
    refreshGold().catch((err) => {
      console.error(`[gold] Refresh failed after job ${jobId}:`, err)
    })

    evaluateAlerts().catch((err) => {
      console.error(`[alerts] Evaluation failed after job ${jobId}:`, err)
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    if (csvConnector && !csvSummaryPersisted)
      await persistCsvUploadSummary(jobId, csvConnector, options.filename)
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

async function persistCsvUploadSummary(
  jobId: string,
  connector: CSVConnector,
  filename: string | undefined
): Promise<void> {
  const summary = connector.getUploadSummary()
  await db.insert(csvUploads).values({
    syncJobId: jobId,
    filename: filename ?? 'upload.csv',
    headers: summary.headers,
    totalRows: summary.totalRows,
    errorRows: summary.errorRows,
    sampleRows: summary.sampleRows,
    sampleErrorRows: summary.sampleErrorRows,
  })
}

async function upsertCustomers(batch: UnifiedCustomer[]): Promise<BatchOutcome> {
  if (batch.length === 0) return { processed: 0, errors: [] }

  try {
    await db
      .insert(customers)
      .values(
        batch.map((c) => ({
          email: c.email,
          name: c.name ?? null,
          stripeId: c.stripeId ?? null,
          shopifyId: c.shopifyId ?? null,
          salesforceId: c.salesforceId ?? null,
          attributes: c.attributes ?? {},
        }))
      )
      .onConflictDoUpdate({
        target: customers.email,
        set: {
          name: sql`excluded.name`,
          stripeId: sql`excluded.stripe_id`,
          shopifyId: sql`excluded.shopify_id`,
          salesforceId: sql`excluded.salesforce_id`,
          attributes: sql`excluded.attributes`,
          updatedAt: new Date(),
        },
      })
    return { processed: batch.length, errors: [] }
  } catch {
    // Bulk statement failed (e.g. one bad row) — fall back to per-row so good rows still land.
    return upsertCustomersOneByOne(batch)
  }
}

async function upsertCustomersOneByOne(batch: UnifiedCustomer[]): Promise<BatchOutcome> {
  let processed = 0
  const errors: Array<{ message: string; record?: unknown }> = []
  for (const c of batch) {
    try {
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
      processed++
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err), record: c })
    }
  }
  return { processed, errors }
}

async function resolveCustomerIds(batch: UnifiedTransaction[]): Promise<Map<string, string>> {
  const emails = [
    ...new Set(batch.filter((t) => !t.customerId && t.customerEmail).map((t) => t.customerEmail!)),
  ]
  if (emails.length === 0) return new Map()

  const rows = await db
    .select({ id: customers.id, email: customers.email })
    .from(customers)
    .where(inArray(customers.email, emails))

  return new Map(rows.map((r) => [r.email, r.id]))
}

async function upsertTransactions(batch: UnifiedTransaction[]): Promise<BatchOutcome> {
  if (batch.length === 0) return { processed: 0, errors: [] }

  const emailToId = await resolveCustomerIds(batch)
  const resolved = batch.map((t) => ({
    txn: t,
    customerId: t.customerId ?? (t.customerEmail ? (emailToId.get(t.customerEmail) ?? null) : null),
  }))

  try {
    await db
      .insert(transactions)
      .values(
        resolved.map(({ txn, customerId }) => ({
          customerId,
          sourcePlatform: txn.sourcePlatform,
          sourceTransactionId: txn.sourceTransactionId,
          amount: txn.amount,
          currency: txn.currency,
          status: txn.status,
          transactionDate: txn.transactionDate,
          rawPayload: txn.rawPayload ?? {},
        }))
      )
      .onConflictDoUpdate({
        target: [transactions.sourcePlatform, transactions.sourceTransactionId],
        set: {
          customerId: sql`excluded.customer_id`,
          amount: sql`excluded.amount`,
          currency: sql`excluded.currency`,
          status: sql`excluded.status`,
          transactionDate: sql`excluded.transaction_date`,
          rawPayload: sql`excluded.raw_payload`,
        },
      })
    return { processed: batch.length, errors: [] }
  } catch {
    // Bulk statement failed (e.g. one bad row) — fall back to per-row so good rows still land.
    return upsertTransactionsOneByOne(resolved)
  }
}

async function upsertTransactionsOneByOne(
  resolved: { txn: UnifiedTransaction; customerId: string | null }[]
): Promise<BatchOutcome> {
  let processed = 0
  const errors: Array<{ message: string; record?: unknown }> = []
  for (const { txn, customerId } of resolved) {
    try {
      await db
        .insert(transactions)
        .values({
          customerId,
          sourcePlatform: txn.sourcePlatform,
          sourceTransactionId: txn.sourceTransactionId,
          amount: txn.amount,
          currency: txn.currency,
          status: txn.status,
          transactionDate: txn.transactionDate,
          rawPayload: txn.rawPayload ?? {},
        })
        .onConflictDoUpdate({
          target: [transactions.sourcePlatform, transactions.sourceTransactionId],
          set: {
            customerId,
            amount: txn.amount,
            currency: txn.currency,
            status: txn.status,
            transactionDate: txn.transactionDate,
            rawPayload: txn.rawPayload ?? {},
          },
        })
      processed++
    } catch (err) {
      errors.push({ message: err instanceof Error ? err.message : String(err), record: txn })
    }
  }
  return { processed, errors }
}
