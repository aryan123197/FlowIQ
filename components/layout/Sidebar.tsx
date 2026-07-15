'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BarChart3, GitBranch, Bell, FileDown, Sparkles, Upload, Zap } from 'lucide-react'
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
    <aside className="flex w-60 flex-col bg-slate-900">
      {/* Logo */}
      <div className="flex h-14 items-center gap-2.5 border-b border-slate-800 px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500">
          <Zap className="h-4 w-4 text-white" />
        </div>
        <span className="text-sm font-semibold tracking-tight text-white">FlowIQ</span>
      </div>

      {/* Nav */}
      <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
        <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Platform
        </p>
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname?.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'group flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium transition-all',
                active
                  ? 'bg-indigo-500/10 text-indigo-400'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-slate-100'
              )}
            >
              <Icon
                className={cn(
                  'h-4 w-4 shrink-0 transition-colors',
                  active ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300'
                )}
              />
              {label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />}
            </Link>
          )
        })}
      </nav>

      {/* Bottom user area */}
      <div className="border-t border-slate-800 px-3 py-3">
        <div className="flex items-center gap-2.5 rounded-md px-2 py-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-xs font-bold text-white">
            A
          </div>
          <div className="flex flex-col">
            <span className="text-xs font-medium text-slate-300">Aryan Gupta</span>
            <span className="text-[10px] text-slate-500">Admin</span>
          </div>
        </div>
      </div>
    </aside>
  )
}
