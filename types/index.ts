export type Platform = 'stripe' | 'shopify' | 'salesforce' | 'csv'

export type TransactionStatus = 'completed' | 'pending' | 'failed' | 'refunded' | 'cancelled'

export interface UnifiedCustomer {
  id: string
  email: string
  name: string | null
  stripeId?: string | null
  shopifyId?: string | null
  salesforceId?: string | null
  attributes?: Record<string, unknown>
}

export interface UnifiedTransaction {
  id: string
  customerId: string | null
  customerEmail: string | null
  amount: number          // always integer cents
  currency: string        // ISO 3-letter
  status: TransactionStatus
  sourcePlatform: Platform
  sourceTransactionId: string
  transactionDate: Date
  rawPayload?: Record<string, unknown>
}

export interface SyncError {
  message: string
  record?: unknown
}

export interface SyncResult {
  platform: Platform
  recordsProcessed: number
  errors: SyncError[]
  jobId: string
}

export interface MetricsData {
  totalRevenue: number
  transactionCount: number
  customerCount: number
  platformBreakdown: { platform: Platform; revenue: number; count: number }[]
  revenueTimeSeries: { date: string; stripe: number; shopify: number; salesforce: number; csv: number }[]
}

export interface AlertRule {
  id: string
  name: string
  metric: 'revenue_total' | 'transaction_count' | 'failed_transaction_rate' | 'customer_count'
  threshold: number
  comparisonOperator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
  timeWindow: string
  actionType: 'email' | 'slack'
  actionConfig: { to?: string; webhookUrl?: string }
  enabled: boolean
  createdAt: Date
}
