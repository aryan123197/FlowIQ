import { Handle, Position, type NodeProps } from '@xyflow/react'
import { HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SinkNodeData } from '../types'

export function SinkNode({ data, selected }: NodeProps & { data: SinkNodeData }) {
  return (
    <div
      className={cn(
        'min-w-[160px] rounded-md border bg-white px-3 py-2 shadow-sm',
        selected ? 'border-zinc-900 ring-2 ring-zinc-900/10' : 'border-zinc-200'
      )}
    >
      <Handle type="target" position={Position.Left} className="!bg-amber-600" />
      <div className="flex items-center gap-2 text-sm font-medium text-zinc-900">
        <HardDrive className="h-4 w-4 text-amber-600" />
        {data.label ?? 'Sink'}
      </div>
      <div className="mt-1 text-xs text-zinc-500">pipeline_outputs</div>
    </div>
  )
}
