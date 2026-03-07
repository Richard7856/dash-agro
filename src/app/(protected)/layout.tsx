'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { BottomNav } from '@/components/Layout/BottomNav'
import { Sidebar } from '@/components/Layout/Sidebar'

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      } else {
        setChecking(false)
      }
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      if (!session) router.replace('/login')
    })

    return () => subscription.unsubscribe()
  }, [router])

  if (checking) {
    return (
      <div className="nm-page flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="nm-page">
      {/* Sidebar — solo desktop */}
      <div className="hidden md:flex md:w-60 md:flex-col md:fixed md:inset-y-0 z-30">
        <Sidebar />
      </div>

      {/* Contenido principal */}
      <div className="md:pl-60 min-h-screen">
        <main className="pb-20 md:pb-6">
          {children}
        </main>
      </div>

      {/* Bottom nav — solo móvil */}
      <div className="fixed bottom-0 left-0 right-0 md:hidden z-40">
        <BottomNav />
      </div>
    </div>
  )
}
