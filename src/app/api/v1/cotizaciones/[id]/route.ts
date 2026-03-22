import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await validateApiKey(req)) return unauthorizedResponse()

  const { id } = await params
  const supabase = getSupabaseServer()

  // Get ronda
  const { data: ronda, error: rErr } = await supabase
    .from('pedido_rondas').select('*').eq('id', id).single()
  if (rErr || !ronda) {
    return NextResponse.json({ data: null, error: 'Ronda no encontrada' }, { status: 404 })
  }

  // Get clientes + items
  const { data: clientes } = await supabase
    .from('pedido_clientes').select('*, pedido_items(*)').eq('ronda_id', id)

  // Get consolidado + precios
  const { data: consolidado } = await supabase
    .from('consolidado_items').select('*, consolidado_precios(*, tiendas(nombre))')
    .eq('ronda_id', id).order('cantidad_total', { ascending: false })

  // Get compras
  const { data: compras } = await supabase
    .from('compra_items').select('*, tiendas(nombre), consolidado_items(nombre_producto)')
    .eq('ronda_id', id)

  // Get tiendas
  const { data: tiendas } = await supabase
    .from('tiendas').select('id, nombre').eq('activo', true).order('nombre')

  return NextResponse.json({
    data: {
      ...ronda,
      clientes: clientes ?? [],
      consolidado: consolidado ?? [],
      compras: compras ?? [],
      tiendas: tiendas ?? [],
    },
    error: null,
  })
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await validateApiKey(req)) return unauthorizedResponse()

  const { id } = await params

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  // Verify ronda exists
  const { data: ronda } = await supabase
    .from('pedido_rondas').select('id').eq('id', id).single()
  if (!ronda) {
    return NextResponse.json({ data: null, error: 'Ronda no encontrada' }, { status: 404 })
  }

  // Update precios if provided
  const precios = body.precios as Array<{ consolidado_item_id: string; tienda_id: string; precio: number }> | undefined
  if (precios && Array.isArray(precios) && precios.length > 0) {
    const upserts = precios.map((p) => ({
      consolidado_item_id: p.consolidado_item_id,
      tienda_id: p.tienda_id,
      precio: p.precio,
      updated_at: new Date().toISOString(),
    }))
    const { error: uErr } = await supabase
      .from('consolidado_precios')
      .upsert(upserts, { onConflict: 'consolidado_item_id,tienda_id' })
    if (uErr) {
      return NextResponse.json({ data: null, error: uErr.message }, { status: 400 })
    }
  }

  // Update status if provided
  if (body.status) {
    await supabase.from('pedido_rondas').update({ status: body.status as string }).eq('id', id)
  }

  return NextResponse.json({ data: { updated: true }, error: null })
}
