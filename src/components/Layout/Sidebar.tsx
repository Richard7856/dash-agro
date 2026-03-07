'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_GROUPS } from '@/lib/nav-groups'

interface SidebarProps {
  onLogout: () => void
}

export function Sidebar({ onLogout }: SidebarProps) {
  const pathname = usePathname()

  return (
    <div className="nm-sidebar flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-5 border-b border-[var(--nm-bg-inset)]">
        <span className="text-[var(--nm-accent)] font-bold text-lg tracking-tight">Agrodelicias</span>
        <p className="text-xs text-[var(--nm-text-subtle)] mt-0.5">Panel operativo</p>
      </div>

      {/* Nav groups */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-4 overflow-y-auto">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="px-2 mb-1 text-[10px] font-semibold tracking-widest text-[var(--nm-text-subtle)]">
              {group.label}
            </p>
            <div className="flex flex-col gap-0.5">
              {group.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(item.href + '/')
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-[var(--nm-radius-sm)] text-sm font-medium transition-all
                      ${active
                        ? 'nm-nav-active text-[var(--nm-accent)]'
                        : 'text-[var(--nm-text-muted)] hover:text-[var(--nm-text)] hover:bg-[var(--nm-bg-inset)]/50'
                      }`}
                  >
                    <span className="shrink-0">{item.icon}</span>
                    {item.label}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="px-3 py-4 border-t border-[var(--nm-bg-inset)]">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[var(--nm-radius-sm)] text-sm font-medium text-red-500 hover:bg-red-50/30 transition-colors"
        >
          <svg className="w-[18px] h-[18px] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
