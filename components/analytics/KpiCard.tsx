import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp } from 'lucide-react'

export function KpiCard({
  title,
  value,
  delta,
  formatAsPercent,
}: {
  title: string
  value: string
  delta?: number
  formatAsPercent?: boolean
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-semibold text-zinc-900">{value}</div>
        {delta !== undefined && (
          <div
            className={cn(
              'mt-1 flex items-center gap-1 text-xs font-medium',
              delta >= 0 ? 'text-green-600' : 'text-red-600'
            )}
          >
            {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}
            {formatAsPercent ? '%' : ''}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
