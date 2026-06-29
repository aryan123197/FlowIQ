export type AlertMetric =
  'revenue_total' | 'transaction_count' | 'failed_transaction_rate' | 'customer_count'
export type AlertOperator = 'gt' | 'lt' | 'gte' | 'lte' | 'eq'
export type AlertAction = 'email' | 'slack'

export interface AlertRule {
  id: string
  name: string
  metric: AlertMetric
  threshold: string
  comparisonOperator: AlertOperator
  timeWindow: string
  actionType: AlertAction
  actionConfig: { to?: string; webhookUrl?: string }
  enabled: boolean
  createdAt: string
}

export interface AlertTrigger {
  id: string
  ruleId: string
  triggeredAt: string
  value: string
  context: Record<string, unknown>
  resolvedAt: string | null
}
