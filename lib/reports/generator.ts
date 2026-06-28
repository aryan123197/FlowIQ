import { db } from '@/lib/db/client'
import { transactions } from '@/lib/db/schema'
import { and, eq, gte, lte, desc } from 'drizzle-orm'

export interface ReportFilters {
  platform?: 'stripe' | 'shopify' | 'salesforce' | 'csv'
  status?: 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled'
  dateFrom?: string
  dateTo?: string
}

const BATCH_SIZE = 500

async function* fetchTransactionRows(filters: ReportFilters): AsyncGenerator<typeof transactions.$inferSelect[]> {
  const conditions = []
  if (filters.platform) conditions.push(eq(transactions.sourcePlatform, filters.platform))
  if (filters.status) conditions.push(eq(transactions.status, filters.status))
  if (filters.dateFrom) conditions.push(gte(transactions.transactionDate, new Date(filters.dateFrom)))
  if (filters.dateTo) conditions.push(lte(transactions.transactionDate, new Date(filters.dateTo)))

  let offset = 0
  while (true) {
    const rows = await db
      .select()
      .from(transactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(transactions.transactionDate))
      .limit(BATCH_SIZE)
      .offset(offset)

    if (rows.length === 0) return
    yield rows
    if (rows.length < BATCH_SIZE) return
    offset += BATCH_SIZE
  }
}

const CSV_COLUMNS = ['id', 'customerId', 'amount', 'currency', 'status', 'sourcePlatform', 'sourceTransactionId', 'transactionDate', 'createdAt'] as const

function csvEscape(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = value instanceof Date ? value.toISOString() : String(value)
  if (/[",\n]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export function generateReportStream(filters: ReportFilters, format: 'csv' | 'json'): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()

  return new ReadableStream({
    async start(controller) {
      try {
        if (format === 'csv') {
          controller.enqueue(encoder.encode(CSV_COLUMNS.join(',') + '\n'))
          for await (const batch of fetchTransactionRows(filters)) {
            const lines = batch.map((row) => CSV_COLUMNS.map((col) => csvEscape(row[col])).join(',')).join('\n') + '\n'
            controller.enqueue(encoder.encode(lines))
          }
        } else {
          controller.enqueue(encoder.encode('['))
          let first = true
          for await (const batch of fetchTransactionRows(filters)) {
            for (const row of batch) {
              const prefix = first ? '' : ','
              first = false
              controller.enqueue(encoder.encode(prefix + JSON.stringify(row)))
            }
          }
          controller.enqueue(encoder.encode(']'))
        }
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}
