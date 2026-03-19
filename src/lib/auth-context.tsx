'use client'

import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase/client'
import type { UserProfile, UserRol } from '@/lib/types/database.types'
import type { User } from '@supabase/supabase-js'

interface AuthState {
  user: User | null
  profile: UserProfile | null
  loading: boolean
  rol: UserRol
  isAdmin: boolean
  isCotizador: boolean
}

const AuthContext = createContext<AuthState>({
  user: null,
  profile: null,
  loading: true,
  rol: 'admin',
  isAdmin: true,
  isCotizador: false,
})

export function useAuth() {
  return useContext(AuthContext)
}

export function AuthProvider({ children, user }: { children: React.ReactNode; user: User }) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function loadProfile() {
      // Try to fetch existing profile
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (data) {
        setProfile(data as UserProfile)
      } else {
        // Auto-create profile for first login (admin by default)
        const newProfile: Omit<UserProfile, 'created_at'> = {
          id: user.id,
          email: user.email ?? '',
          nombre: null,
          rol: 'admin',
          activo: true,
        }
        const { data: created } = await supabase
          .from('user_profiles')
          .insert(newProfile)
          .select()
          .single()
        setProfile((created as UserProfile) ?? { ...newProfile, created_at: new Date().toISOString() })
      }
      setLoading(false)
    }

    loadProfile()
  }, [user.id, user.email])

  const rol = profile?.rol ?? 'admin'

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      loading,
      rol,
      isAdmin: rol === 'admin',
      isCotizador: rol === 'cotizador',
    }}>
      {children}
    </AuthContext.Provider>
  )
}
