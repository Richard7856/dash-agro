import { supabase } from '@/lib/supabase/client'

/**
 * Log an activity. Call from client-side after successful operations.
 * Non-blocking — fire and forget.
 */
export function logActivity(opts: {
  accion: string        // 'crear' | 'editar' | 'eliminar' | 'login' | etc.
  modulo: string        // 'inventario' | 'ventas' | 'compras' | etc.
  detalle?: string      // human-readable description
  registro_id?: string  // ID of the affected record
}) {
  // Get current user from supabase session
  supabase.auth.getSession().then(async ({ data: { session } }) => {
    if (!session?.user) return

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('nombre, email')
      .eq('id', session.user.id)
      .single()

    supabase.from('activity_logs').insert({
      user_id: session.user.id,
      user_email: profile?.email ?? session.user.email ?? '',
      user_nombre: profile?.nombre ?? null,
      accion: opts.accion,
      modulo: opts.modulo,
      detalle: opts.detalle ?? null,
      registro_id: opts.registro_id ?? null,
    }).then(() => {}) // fire and forget
  })
}
