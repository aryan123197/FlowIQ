import Papa from 'papaparse'
import { z } from 'zod'
import { BaseConnector, type RawCustomer, type RawTransaction } from './base'
import type { UnifiedTransaction, TransactionStatus } from '@/types'
import { randomUUID } from 'crypto'

const COLUMN_ALIASES: Record<string, string[]> = {
  email: ['email', 'email_address', 'customer_email', 'Email', 'Email Address'],
  name: ['name', 'customer_name', 'full_name', 'Name', 'Full Name'],
  amount: ['amount', 'total', 'price', 'Amount', 'Total', 'Price', 'value'],
  currency: ['currency', 'Currency', 'currency_code'],
  status: ['status', 'Status', 'payment_status'],
  date: ['date', 'Date', 'created_at', 'transaction_date', 'order_date'],
  id: ['id', 'ID', 'transaction_id', 'order_id', 'reference'],
}

const BATCH_SIZE = 100
const MAX_ERROR_RATE = 0.05

function detectColumnMap(headers: string[]): Record<string, string> {
  const map: Record<string, string> = {}
  for (const [canonical, aliases] of Object.entries(COLUMN_ALIASES)) {
    const found = aliases.find((alias) => headers.includes(alias))
    if (found) map[canonical] = found
  }
  return map
}

const RowSchema = z.object({
  email: z.string().email().optional(),
  amount: z
    .string()
    .or(z.number())
    .transform((v) => {
      const n = typeof v === 'string' ? parseFloat(v) : v
      return Math.round(n * 100) // convert to cents
    })
    .refine((n) => !isNaN(n), { message: 'Invalid amount' }),
  currency: z.string().length(3).optional().default('usd'),
  status: z.string().optional().default('completed'),
  date: z.string().optional(),
  id: z.string().optional(),
  name: z.string().optional(),
})

export interface ParsedCSVRow extends UnifiedTransaction {}

export interface CSVUploadSummary {
  headers: string[]
  totalRows: number
  errorRows: number
  sampleRows: Record<string, unknown>[]
  sampleErrorRows: { row: Record<string, unknown>; reason: string }[]
}

const SAMPLE_LIMIT = 5

export class CSVConnector extends BaseConnector {
  readonly platform = 'csv' as const
  private csvContent: string
  private uploadSummary: CSVUploadSummary = {
    headers: [],
    totalRows: 0,
    errorRows: 0,
    sampleRows: [],
    sampleErrorRows: [],
  }

  constructor(csvContent: string) {
    super()
    this.csvContent = csvContent
  }

  async validate(): Promise<void> {
    const preview = Papa.parse(this.csvContent, { preview: 1, header: true })
    if (preview.errors.length > 0) throw new Error(`CSV parse error: ${preview.errors[0].message}`)
  }

  getUploadSummary(): CSVUploadSummary {
    return this.uploadSummary
  }

  async *fetchCustomers(): AsyncGenerator<RawCustomer[]> {
    yield []
  }

  async *fetchTransactions(): AsyncGenerator<RawTransaction[]> {
    const result = Papa.parse<Record<string, string>>(this.csvContent, {
      header: true,
      skipEmptyLines: true,
    })
    const headers = result.meta.fields ?? []
    const colMap = detectColumnMap(headers)
    this.uploadSummary.headers = headers

    let batch: RawTransaction[] = []
    let errorCount = 0
    let totalCount = 0

    for (const row of result.data) {
      totalCount++
      if (this.uploadSummary.sampleRows.length < SAMPLE_LIMIT) {
        this.uploadSummary.sampleRows.push(row)
      }

      const mapped: Record<string, unknown> = {}
      for (const [canonical, header] of Object.entries(colMap)) {
        mapped[canonical] = row[header]
      }

      const parsed = RowSchema.safeParse(mapped)
      if (!parsed.success) {
        errorCount++
        if (this.uploadSummary.sampleErrorRows.length < SAMPLE_LIMIT) {
          this.uploadSummary.sampleErrorRows.push({
            row,
            reason: parsed.error.issues.map((i) => i.message).join('; ') || 'validation failed',
          })
        }
        continue
      }

      const d = parsed.data
      const statusMap: Record<string, TransactionStatus> = {
        completed: 'completed',
        paid: 'completed',
        success: 'completed',
        pending: 'pending',
        failed: 'failed',
        refunded: 'refunded',
        cancelled: 'cancelled',
      }

      batch.push({
        id: d.id ?? randomUUID(),
        customerId: null,
        customerEmail: d.email ?? null,
        amount: d.amount,
        currency: (d.currency ?? 'usd').toLowerCase(),
        status: statusMap[d.status?.toLowerCase() ?? ''] ?? 'completed',
        sourcePlatform: 'csv',
        sourceTransactionId: d.id ?? randomUUID(),
        transactionDate: d.date ? new Date(d.date) : new Date(),
        rawPayload: row,
      })

      if (batch.length >= BATCH_SIZE) {
        yield batch
        batch = []
      }
    }

    this.uploadSummary.totalRows = totalCount
    this.uploadSummary.errorRows = errorCount

    if (totalCount > 0 && errorCount / totalCount > MAX_ERROR_RATE) {
      throw new Error(`CSV error rate too high: ${errorCount}/${totalCount} rows failed validation`)
    }

    if (batch.length > 0) yield batch
  }
}
