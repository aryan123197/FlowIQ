import { NextRequest } from 'next/server'
import { generateReportStream, type ReportFilters } from '@/lib/reports/generator'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const format = searchParams.get('format') === 'json' ? 'json' : 'csv'

  const filters: ReportFilters = {
    platform: (searchParams.get('platform') as ReportFilters['platform']) ?? undefined,
    status: (searchParams.get('status') as ReportFilters['status']) ?? undefined,
    dateFrom: searchParams.get('dateFrom') ?? undefined,
    dateTo: searchParams.get('dateTo') ?? undefined,
  }

  const stream = generateReportStream(filters, format)
  const filename = `transactions-report.${format}`

  return new Response(stream, {
    headers: {
      'Content-Type': format === 'csv' ? 'text/csv' : 'application/json',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
}
