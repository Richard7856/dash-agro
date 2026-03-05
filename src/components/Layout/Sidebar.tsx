'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

const items = [
  { href: '/dashboard', label: 'Inicio' },
  { href: '/inventario', label: 'Inventario' },
  { href: '/compras', label: 'Compras' },
  { href: '/ventas', label: 'Ventas' },
  { href: '/gastos', label: 'Gastos' },
  { href: '/bonos', label: 'Bonos gasolina' },
  { href: '/personas', label: 'Personas' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.replace('/login')
  }

  return (
    <div className="flex flex-col h-full bg-white border-r border-gray-200">
      <div className="px-5 py-5 border-b border-gray-100">
        <span className="text-green-700 font-bold text-lg tracking-tight">🌿 Agrodelicias</span>
      </div>
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                ${active
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
            >
              {item.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-3 py-4 border-t border-gray-100">
        <button
          onClick={handleLogout}
          className="w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}
