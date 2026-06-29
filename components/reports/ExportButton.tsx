import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { ReportFilterValues } from './ReportFilter'

function buildReportUrl(filters: ReportFilterValues) {
  const params = new URLSearchParams()
  if (filters.platform) params.set('platform', filters.platform)
  if (filters.status) params.set('status', filters.status)
  if (filters.dateFrom) params.set('dateFrom', filters.dateFrom)
  if (filters.dateTo) params.set('dateTo', filters.dateTo)
  params.set('format', filters.format)
  return `/api/reports/generate?${params.toString()}`
}

export function ExportButton({ filters }: { filters: ReportFilterValues }) {
  return (
    <a
      href={buildReportUrl(filters)}
      download
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white transition-colors hover:bg-zinc-700'
      )}
    >
      <Download className="h-4 w-4" /> Export
    </a>
  )
}
