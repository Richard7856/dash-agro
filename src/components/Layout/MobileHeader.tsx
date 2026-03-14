'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { getPageTitle } from '@/lib/page-title'
import { usePwaInstall } from '@/hooks/usePwaInstall'

interface MobileHeaderProps {
  onMenuOpen: () => void
}

export function MobileHeader({ onMenuOpen }: MobileHeaderProps) {
  const pathname = usePathname()
  const title = getPageTitle(pathname)
  const { canInstall, isIos, isInstalled, install } = usePwaInstall()
  const [showIosHint, setShowIosHint] = useState(false)

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

      {/* Install button / spacer */}
      {canInstall ? (
        <button
          onClick={install}
          className="nm-btn w-10 h-10 flex items-center justify-center text-[var(--nm-text-muted)]"
          aria-label="Instalar app"
          title="Instalar app"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7,10 12,15 17,10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </button>
      ) : (isIos && !isInstalled) ? (
        <div className="relative">
          <button
            onClick={() => setShowIosHint((v) => !v)}
            className="nm-btn w-10 h-10 flex items-center justify-center text-[var(--nm-text-muted)]"
            aria-label="Instalar app en iOS"
            title="Agregar a inicio"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8" />
              <polyline points="16,6 12,2 8,6" />
              <line x1="12" y1="2" x2="12" y2="15" />
            </svg>
          </button>
          {showIosHint && (
            <div className="absolute right-0 top-12 w-56 bg-white border border-gray-200 rounded-xl shadow-lg p-3 text-xs text-[var(--nm-text)] z-50">
              Toca <strong>Compartir</strong> <span className="inline-block">⬆</span> y luego <strong>Agregar a pantalla de inicio</strong>
              <button
                onClick={() => setShowIosHint(false)}
                className="block mt-2 text-[var(--nm-text-subtle)] underline"
              >
                Cerrar
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="w-10" aria-hidden="true" />
      )}
    </header>
  )
}
