import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { AlertRule } from './types'

const OPERATOR_LABELS: Record<string, string> = { gt: '>', lt: '<', gte: '>=', lte: '<=', eq: '==' }

export function AlertRuleCard({
  rule,
  onToggle,
  onDelete,
}: {
  rule: AlertRule
  onToggle: (enabled: boolean) => void
  onDelete: () => void
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-start justify-between">
        <CardTitle className="text-zinc-900">{rule.name}</CardTitle>
        <Badge variant={rule.enabled ? 'success' : 'default'}>
          {rule.enabled ? 'enabled' : 'disabled'}
        </Badge>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-zinc-500">
          {rule.metric} {OPERATOR_LABELS[rule.comparisonOperator]} {rule.threshold} over{' '}
          {rule.timeWindow}
        </p>
        <p className="text-xs text-zinc-400">
          {rule.actionType === 'email'
            ? `Email: ${rule.actionConfig.to}`
            : `Slack: ${rule.actionConfig.webhookUrl}`}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => onToggle(!rule.enabled)}>
            {rule.enabled ? 'Disable' : 'Enable'}
          </Button>
          <Button variant="ghost" size="icon" onClick={onDelete}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
