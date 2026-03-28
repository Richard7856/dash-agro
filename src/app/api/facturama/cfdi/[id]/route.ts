import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { cancelarCfdi, descargarPdf, descargarXml } from '@/lib/facturama'

async function getConfig() {
  const db = getSupabaseServer()
  const { data } = await db.from('cfdi_config').select('*').limit(1).single()
  if (!data?.usuario) throw new Error('Facturama no configurado')
  return {
    usuario: data.usuario,
    password: data.password_enc,
    sandbox: data.ambiente === 'sandbox',
  }
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const db = getSupabaseServer()
  const action = req.nextUrl.searchParams.get('action') // 'pdf' | 'xml' | null

  const { data: cfdi, error } = await db
    .from('facturas_cfdi')
    .select('*')
    .eq('id', params.id)
    .single()

  if (error || !cfdi) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

  if (action === 'pdf' && cfdi.facturama_id) {
    try {
      const config = await getConfig()
      const b64 = await descargarPdf(config, cfdi.facturama_id)
      const buffer = Buffer.from(b64, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="cfdi-${cfdi.folio_fiscal || cfdi.id}.pdf"`,
        },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  if (action === 'xml' && cfdi.facturama_id) {
    try {
      const config = await getConfig()
      const b64 = await descargarXml(config, cfdi.facturama_id)
      const buffer = Buffer.from(b64, 'base64')
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/xml',
          'Content-Disposition': `attachment; filename="cfdi-${cfdi.folio_fiscal || cfdi.id}.xml"`,
        },
      })
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Error'
      return NextResponse.json({ error: msg }, { status: 500 })
    }
  }

  return NextResponse.json(cfdi)
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const db = getSupabaseServer()
    const motivo = req.nextUrl.searchParams.get('motivo') || '02'

    const { data: cfdi } = await db
      .from('facturas_cfdi')
      .select('facturama_id')
      .eq('id', params.id)
      .single()

    if (!cfdi?.facturama_id) {
      return NextResponse.json({ error: 'CFDI no encontrado o sin ID de Facturama' }, { status: 404 })
    }

    const config = await getConfig()
    await cancelarCfdi(config, cfdi.facturama_id, motivo)

    await db
      .from('facturas_cfdi')
      .update({ status: 'cancelada', updated_at: new Date().toISOString() })
      .eq('id', params.id)

    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al cancelar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
