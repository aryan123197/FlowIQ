export type InsightSeverity = 'critical' | 'warning' | 'info'
export type InsightType = 'trend' | 'anomaly' | 'period_comparison' | 'top_customers' | 'failure_rate' | 'platform_breakdown'

export interface Insight {
  id: string
  type: InsightType
  severity: InsightSeverity
  title: string
  description: string
  value?: number
  delta?: number       // percentage change
  recommendation: string
  generatedAt: string  // ISO string
}

export interface RevenueTrendResult {
  buckets: { date: string; revenue: number }[]
  slope: number           // dollars per day
  percentChange: number   // % change first→last bucket
  totalRevenue: number
}

export interface AnomalyResult {
  anomalyDays: { date: string; revenue: number; zScore: number }[]
  mean: number
  stdDev: number
}

export interface PeriodComparisonResult {
  current: number
  prior: number
  deltaPercent: number
  period: 'week' | 'month'
}

export interface TopCustomersResult {
  customers: { email: string; name: string | null; revenue: number; sharePercent: number }[]
  totalRevenue: number
}

export interface FailureRateResult {
  currentRate: number     // 0-1
  rollingAvgRate: number  // 0-1
  ratio: number           // currentRate / rollingAvgRate
  windowHours: number
}

export interface PlatformBreakdownResult {
  platforms: { platform: string; revenue: number; count: number; sharePercent: number }[]
  totalRevenue: number
}
