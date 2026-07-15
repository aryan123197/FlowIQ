import { cn } from '@/lib/utils'
import { ArrowDown, ArrowUp, type LucideIcon } from 'lucide-react'

const ACCENT_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  indigo: {
    border: 'border-l-indigo-500',
    bg: 'bg-indigo-50',
    icon: 'text-indigo-600',
  },
  violet: {
    border: 'border-l-violet-500',
    bg: 'bg-violet-50',
    icon: 'text-violet-600',
  },
  emerald: {
    border: 'border-l-emerald-500',
    bg: 'bg-emerald-50',
    icon: 'text-emerald-600',
  },
  rose: {
    border: 'border-l-rose-500',
    bg: 'bg-rose-50',
    icon: 'text-rose-600',
  },
}

export function KpiCard({
  title,
  value,
  delta,
  formatAsPercent,
  icon: Icon,
  accent = 'indigo',
}: {
  title: string
  value: string
  delta?: number
  formatAsPercent?: boolean
  icon?: LucideIcon
  accent?: 'indigo' | 'violet' | 'emerald' | 'rose'
}) {
  const styles = ACCENT_STYLES[accent]

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-slate-200 border-l-4 bg-white p-5 shadow-sm shadow-slate-100',
        styles.border
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          {title}
        </span>
        {Icon && (
          <div className={cn('rounded-lg p-1.5', styles.bg)}>
            <Icon className={cn('h-4 w-4', styles.icon)} />
          </div>
        )}
      </div>
      <div>
        <div className="text-3xl font-bold tracking-tight text-slate-900">{value}</div>
        {delta !== undefined && (
          <div
            className={cn(
              'mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold',
              delta >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            )}
          >
            {delta >= 0 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
            {Math.abs(delta).toFixed(1)}
            {formatAsPercent ? '%' : ''}
          </div>
        )}
      </div>
    </div>
  )
}
