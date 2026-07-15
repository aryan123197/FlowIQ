import { SyncStatusBanner } from '@/components/analytics/SyncStatusBanner'
import { RefreshCw } from 'lucide-react'

export function Topbar() {
  return (
    <header className="flex h-14 shrink-0 items-center justify-between border-b border-slate-100 bg-white px-6">
      <SyncStatusBanner />
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-slate-900"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Sync Now
        </button>
        <div className="flex items-center gap-1.5 rounded-md bg-indigo-50 px-2.5 py-1.5">
          <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
          <span className="text-xs font-medium text-indigo-700">Live</span>
        </div>
      </div>
    </header>
  )
}
