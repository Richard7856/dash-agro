import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { enviarCfdiEmail } from '@/lib/facturama'

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { email } = await req.json()
    if (!email?.trim()) {
      return NextResponse.json({ error: 'Email requerido' }, { status: 400 })
    }

    const db = getSupabaseServer()

    // Obtener CFDI y verificar que fue timbrado realmente (tiene facturama_id)
    const { data: cfdi, error } = await db
      .from('facturas_cfdi')
      .select('facturama_id, status, receptor_nombre')
      .eq('id', params.id)
      .single()

    if (error || !cfdi) {
      return NextResponse.json({ error: 'CFDI no encontrado' }, { status: 404 })
    }

    if (!cfdi.facturama_id) {
      return NextResponse.json(
        { error: 'Solo se puede enviar por email un CFDI timbrado (no simulados)' },
        { status: 422 }
      )
    }

    // Obtener credenciales Facturama
    const { data: config } = await db.from('cfdi_config').select('*').limit(1).single()
    if (!config?.usuario) {
      return NextResponse.json({ error: 'Facturama no está configurado' }, { status: 422 })
    }

    await enviarCfdiEmail(
      { usuario: config.usuario, password: config.password_enc, sandbox: config.ambiente === 'sandbox' },
      cfdi.facturama_id,
      email.trim()
    )

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al enviar email'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
