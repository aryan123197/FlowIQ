import { Input } from '@/components/ui/input'
import type { SinkNodeData } from '../types'

export function SinkPanel({
  data,
  onChange,
}: {
  data: SinkNodeData
  onChange: (data: SinkNodeData) => void
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
      <p className="text-xs text-zinc-400">
        Rows reaching this node are written to <code>pipeline_outputs</code>, not{' '}
        <code>transactions</code>.
      </p>
    </div>
  )
}
