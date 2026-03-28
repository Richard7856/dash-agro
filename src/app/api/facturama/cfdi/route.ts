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

function randomUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16).toUpperCase()
  })
}

function randomSello(len = 172): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const db = getSupabaseServer()

    // ── MODO DEMO ──────────────────────────────────────────────────────────────
    if (body.demo === true) {
      const subtotal = (body.conceptos as { precio_unitario: number; cantidad: number; con_iva?: boolean }[]).reduce(
        (s, c) => s + c.precio_unitario * c.cantidad, 0
      )
      const iva = (body.conceptos as { precio_unitario: number; cantidad: number; con_iva?: boolean }[])
        .filter(c => c.con_iva !== false)
        .reduce((s, c) => s + c.precio_unitario * c.cantidad * 0.16, 0)

      const folioFiscal = randomUUID()
      const folio = String(Math.floor(Math.random() * 900) + 100)
      const now = new Date().toISOString()

      const mockFacturamaResponse = {
        Id: `demo-${folioFiscal.slice(0, 8)}`,
        FolioFiscal: folioFiscal,
        Serie: 'A',
        Folio: folio,
        Date: now,
        CfdiType: 'I',
        PaymentForm: body.forma_pago || '01',
        PaymentMethod: body.metodo_pago || 'PUE',
        Currency: 'MXN',
        Subtotal: subtotal,
        Iva: iva,
        Total: subtotal + iva,
        Issuer: {
          Rfc: 'EKU9003173C9',
          Name: 'ESCUELA KEMPER URGATE SA DE CV',
          FiscalRegime: '601',
        },
        Receiver: {
          Rfc: body.receptor_rfc,
          Name: body.receptor_nombre,
          CfdiUse: body.uso_cfdi || 'G03',
          FiscalRegime: body.receptor_regimen || '616',
          TaxZipCode: body.receptor_cp || '64000',
        },
        Items: body.conceptos,
        Complement: {
          TaxStamp: {
            Version: '1.1',
            Uuid: folioFiscal,
            Date: now,
            CfdiSign: randomSello(172),
            SatCertNumber: '00001000000504465028',
            SatSign: randomSello(172),
            RfcProvCertif: 'SAT970701NN3',
          },
        },
        OriginalString: `||4.0|${folioFiscal}|${now}|${body.receptor_rfc}|${(subtotal + iva).toFixed(2)}|MXN|`,
        CertNumber: '30001000000400002434',
        Sign: randomSello(344),
      }

      const { data: saved, error: saveErr } = await db
        .from('facturas_cfdi')
        .insert({
          facturama_id: null,
          folio_fiscal: folioFiscal,
          serie: 'A',
          folio,
          tipo: 'I',
          fecha_emision: now,
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
          status: 'simulado',
          venta_id: body.venta_id || null,
          conceptos: body.conceptos,
          notas: body.notas || null,
        })
        .select()
        .single()

      if (saveErr) throw new Error(saveErr.message)
      return NextResponse.json({ demo: true, saved, mockResponse: mockFacturamaResponse })
    }
    // ── FIN MODO DEMO ──────────────────────────────────────────────────────────

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
