import { NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { testConexion } from '@/lib/facturama'

export async function GET() {
  try {
    const db = getSupabaseServer()
    const { data: config } = await db
      .from('cfdi_config')
      .select('*')
      .limit(1)
      .single()

    if (!config?.usuario || !config?.password_enc) {
      return NextResponse.json({ ok: false, message: 'No configurado' })
    }

    const ok = await testConexion({
      usuario: config.usuario,
      password: config.password_enc,
      sandbox: config.ambiente === 'sandbox',
    })

    return NextResponse.json({ ok, ambiente: config.ambiente })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error desconocido'
    return NextResponse.json({ ok: false, message: msg }, { status: 500 })
  }
}
