import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { emitirCfdi } from '@/lib/facturama'
import type { EmitirCfdiPayload } from '@/lib/facturama'

export async function GET() {
  const db = getSupabaseServer()
  const { data, error } = await db
    .from('facturas_cfdi')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = getSupabaseServer()

    // Get Facturama config
    const { data: config, error: configErr } = await db
      .from('cfdi_config')
      .select('*')
      .limit(1)
      .single()

    if (configErr || !config?.usuario) {
      return NextResponse.json(
        { error: 'Facturama no está configurado. Ve a Configuración → CFDI.' },
        { status: 422 }
      )
    }

    const facturamaConfig = {
      usuario: config.usuario,
      password: config.password_enc,
      sandbox: config.ambiente === 'sandbox',
    }

    const payload: EmitirCfdiPayload = {
      CfdiType: body.tipo || 'I',
      PaymentForm: body.forma_pago || '01',
      PaymentMethod: body.metodo_pago || 'PUE',
      Currency: 'MXN',
      Series: config.serie_default || 'A',
      Receiver: {
        Rfc: body.receptor_rfc,
        Name: body.receptor_nombre,
        CfdiUse: body.uso_cfdi || 'G03',
        TaxZipCode: body.receptor_cp || config.cp_emisor || '00000',
        FiscalRegime: body.receptor_regimen || '616',
      },
      Items: body.conceptos.map((c: { descripcion: string; cantidad: number; precio_unitario: number; codigo_sat?: string; unidad_sat?: string; con_iva?: boolean }) => ({
        ProductCode: c.codigo_sat || '01010101',
        UnitCode: c.unidad_sat || 'H87',
        Unit: 'Pieza',
        Description: c.descripcion,
        UnitPrice: c.precio_unitario,
        Quantity: c.cantidad,
        TaxObject: c.con_iva !== false ? '02' : '01',
        Taxes: c.con_iva !== false ? [{
          Type: 'IVA',
          Rate: 0.16,
          Factor: 'Tasa',
        }] : [],
      })),
    }

    const result = await emitirCfdi(facturamaConfig, payload)

    // Calculate totals
    const subtotal = body.conceptos.reduce(
      (s: number, c: { precio_unitario: number; cantidad: number }) => s + c.precio_unitario * c.cantidad, 0
    )
    const iva = body.conceptos
      .filter((c: { con_iva?: boolean }) => c.con_iva !== false)
      .reduce((s: number, c: { precio_unitario: number; cantidad: number }) => s + c.precio_unitario * c.cantidad * 0.16, 0)

    // Save to DB
    const { data: saved, error: saveErr } = await db
      .from('facturas_cfdi')
      .insert({
        facturama_id: result.Id,
        folio_fiscal: result.FolioFiscal,
        serie: result.Serie,
        folio: result.Folio,
        tipo: body.tipo || 'I',
        fecha_emision: result.Date,
        receptor_rfc: body.receptor_rfc,
        receptor_nombre: body.receptor_nombre,
        receptor_uso_cfdi: body.uso_cfdi || 'G03',
        receptor_regimen: body.receptor_regimen || '616',
        receptor_cp: body.receptor_cp,
        subtotal,
        iva,
        total: subtotal + iva,
        metodo_pago: body.metodo_pago || 'PUE',
        forma_pago: body.forma_pago || '01',
        status: 'emitida',
        venta_id: body.venta_id || null,
        conceptos: body.conceptos,
        notas: body.notas || null,
      })
      .select()
      .single()

    if (saveErr) throw new Error(saveErr.message)
    return NextResponse.json(saved)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Error al emitir CFDI'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
