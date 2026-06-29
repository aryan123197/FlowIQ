import { Button } from '@/components/ui/button'
import { Database, Wand2, HardDrive, Save, Play } from 'lucide-react'

export function PipelineToolbar({
  onAddNode,
  onSave,
  onRun,
  saving,
  running,
  runDisabled,
}: {
  onAddNode: (type: 'source' | 'transform' | 'sink') => void
  onSave: () => void
  onRun: () => void
  saving?: boolean
  running?: boolean
  runDisabled?: boolean
}) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 bg-white px-4 py-2">
      <Button variant="outline" size="sm" onClick={() => onAddNode('source')}>
        <Database className="h-4 w-4" /> Source
      </Button>
      <Button variant="outline" size="sm" onClick={() => onAddNode('transform')}>
        <Wand2 className="h-4 w-4" /> Transform
      </Button>
      <Button variant="outline" size="sm" onClick={() => onAddNode('sink')}>
        <HardDrive className="h-4 w-4" /> Sink
      </Button>

      <div className="ml-auto flex items-center gap-2">
        <Button variant="outline" size="sm" onClick={onSave} disabled={saving}>
          <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save'}
        </Button>
        <Button
          size="sm"
          onClick={onRun}
          disabled={running || runDisabled}
          title={runDisabled ? 'Configure all transform nodes before running' : undefined}
        >
          <Play className="h-4 w-4" /> {running ? 'Running...' : 'Run'}
        </Button>
      </div>
    </div>
  )
}
