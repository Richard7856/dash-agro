'use client'

import { usePathname } from 'next/navigation'
import { getPageTitle } from '@/lib/page-title'

interface MobileHeaderProps {
  onMenuOpen: () => void
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)

  return (
    <header className="fixed top-0 left-0 right-0 z-30 nm-top-nav h-14 px-4 flex items-center justify-between md:hidden">
      {/* Hamburger button */}
      <button
        onClick={onMenuOpen}
        className="nm-btn w-10 h-10 flex items-center justify-center text-[var(--nm-text-muted)]"
        aria-label="Abrir menú"
        aria-haspopup="dialog"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <line x1="3" y1="6"  x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Page title */}
      <span className="text-sm font-semibold text-[var(--nm-text)] tracking-tight">
        {title}
      </span>

      {/* Spacer to keep title visually centered */}
      <div className="w-10" aria-hidden="true" />
    </header>
  )
}
