import { SyncStatusBanner } from '@/components/analytics/SyncStatusBanner'

export function Topbar() {
  return (
    <header className="flex h-14 items-center justify-between border-b border-zinc-200 bg-white px-6">
      <SyncStatusBanner />
    </header>
  )
}
