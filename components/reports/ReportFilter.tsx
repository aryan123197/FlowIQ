import { Input } from '@/components/ui/input'

export interface ReportFilterValues {
  platform: string
  status: string
  dateFrom: string
  dateTo: string
  format: 'csv' | 'json'
}

const PLATFORMS = ['stripe', 'shopify', 'salesforce', 'csv']
const STATUSES = ['completed', 'pending', 'failed', 'refunded', 'cancelled']

function selectClass() {
  return 'h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10'
}

export function ReportFilter({
  value,
  onChange,
}: {
  value: ReportFilterValues
  onChange: (value: ReportFilterValues) => void
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Platform
        <select
          className={selectClass()}
          value={value.platform}
          onChange={(e) => onChange({ ...value, platform: e.target.value })}
        >
          <option value="">All</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Status
        <select
          className={selectClass()}
          value={value.status}
          onChange={(e) => onChange({ ...value, status: e.target.value })}
        >
          <option value="">All</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        From
        <Input
          type="date"
          value={value.dateFrom}
          onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        To
        <Input
          type="date"
          value={value.dateTo}
          onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Format
        <select
          className={selectClass()}
          value={value.format}
          onChange={(e) => onChange({ ...value, format: e.target.value as 'csv' | 'json' })}
        >
          <option value="csv">CSV</option>
          <option value="json">JSON</option>
        </select>
      </label>
    </div>
  )
}
