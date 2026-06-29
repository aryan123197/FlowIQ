'use client'

import { useState } from 'react'
import { ReportFilter, type ReportFilterValues } from '@/components/reports/ReportFilter'
import { ExportButton } from '@/components/reports/ExportButton'

const DEFAULT_FILTERS: ReportFilterValues = {
  platform: '',
  status: '',
  dateFrom: '',
  dateTo: '',
  format: 'csv',
}

export default function ReportsPage() {
  const [filters, setFilters] = useState<ReportFilterValues>(DEFAULT_FILTERS)

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-xl font-semibold text-zinc-900">Reports</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-zinc-200 bg-white p-4">
        <ReportFilter value={filters} onChange={setFilters} />
        <div>
          <ExportButton filters={filters} />
        </div>
      </div>
    </div>
  )
}
