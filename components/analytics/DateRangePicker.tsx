import { Input } from '@/components/ui/input'

export interface DateRange {
  dateFrom: string
  dateTo: string
}

export function DateRangePicker({
  value,
  onChange,
}: {
  value: DateRange
  onChange: (range: DateRange) => void
}) {
  return (
    <div className="flex items-center gap-2">
      <Input
        type="date"
        value={value.dateFrom}
        onChange={(e) => onChange({ ...value, dateFrom: e.target.value })}
        className="w-auto"
      />
      <span className="text-zinc-400">to</span>
      <Input
        type="date"
        value={value.dateTo}
        onChange={(e) => onChange({ ...value, dateTo: e.target.value })}
        className="w-auto"
      />
    </div>
  )
}
