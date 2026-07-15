'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, GitBranch, Bell, FileDown, Sparkles, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/import', label: 'Import Data', icon: Upload },
  { href: '/pipelines', label: 'Pipelines', icon: GitBranch },
  { href: '/alerts', label: 'Alerts', icon: Bell },
  { href: '/reports', label: 'Reports', icon: FileDown },
  { href: '/nlsql', label: 'Ask Your Data', icon: Sparkles },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="flex w-56 flex-col border-r border-zinc-200 bg-white">
      <div className="flex h-14 items-center px-4 text-lg font-semibold text-zinc-900">FlowIQ</div>
      <nav className="flex flex-col gap-1 px-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                active
                  ? 'bg-zinc-100 text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-50 hover:text-zinc-900'
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
