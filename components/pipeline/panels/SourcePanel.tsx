import { Input } from '@/components/ui/input'
import type { SourceNodeData } from '../types'
import type { Platform } from '@/types'

const PLATFORMS: Platform[] = ['stripe', 'shopify', 'salesforce', 'csv']

export function SourcePanel({
  data,
  onChange,
}: {
  data: SourceNodeData
  onChange: (data: SourceNodeData) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Label
        <Input
          value={data.label ?? ''}
          onChange={(e) => onChange({ ...data, label: e.target.value })}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-zinc-500">
        Platform filter
        <select
          className="h-9 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus:outline-none focus:ring-2 focus:ring-zinc-900/10"
          value={data.platform ?? ''}
          onChange={(e) =>
            onChange({ ...data, platform: (e.target.value || undefined) as Platform | undefined })
          }
        >
          <option value="">All platforms</option>
          {PLATFORMS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </label>
    </div>
  )
}
