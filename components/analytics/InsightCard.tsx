import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface Insight {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  description: string
  recommendation: string
}

const SEVERITY_VARIANT = {
  critical: 'danger',
  warning: 'warning',
  info: 'info',
} as const

export function InsightCard({ insight }: { insight: Insight }) {
  return (
    <Card className={cn(insight.severity === 'critical' && 'border-red-200')}>
      <CardContent className="pt-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-sm font-semibold text-zinc-900">{insight.title}</h4>
          <Badge variant={SEVERITY_VARIANT[insight.severity]}>{insight.severity}</Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-600">{insight.description}</p>
        <p className="mt-2 text-xs font-medium text-zinc-500">{insight.recommendation}</p>
      </CardContent>
    </Card>
  )
}
