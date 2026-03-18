import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!await validateApiKey(req)) return unauthorizedResponse()

  const { id } = await params
  const supabase = getSupabaseServer()

  // get ronda
  const { data: ronda, error: rErr } = await supabase
    .from('cotizacion_rondas')
    .select('*')
    .eq('id', id)
    .single()

  if (rErr || !ronda) {
    return NextResponse.json({ data: null, error: 'Ronda no encontrada' }, { status: 404 })
  }

  // get productos + precios + tienda name
  const { data: productos } = await supabase
    .from('cotizacion_productos')
    .select('*, cotizacion_precios(*, tiendas(nombre))')
    .eq('ronda_id', id)
    .order('orden')

  // get tiendas
  const { data: tiendas } = await supabase
    .from('tiendas')
    .select('id, nombre')
    .eq('activo', true)
    .order('nombre')

  // reshape
  const productosOut = (productos ?? []).map((p) => ({
    id: p.id,
    nombre_producto: p.nombre_producto,
    orden: p.orden,
    precios: ((p as Record<string, unknown>).cotizacion_precios as Array<{
      tienda_id: string
      precio: number
      tiendas: { nombre: string } | null
    }> ?? []).map((pr) => ({
      tienda_id: pr.tienda_id,
      tienda_nombre: pr.tiendas?.nombre ?? '',
      precio: pr.precio,
    })),
  }))

  return NextResponse.json({
    data: {
      ...ronda,
      productos: productosOut,
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

  const precios = body.precios as Array<{ producto_id: string; tienda_id: string; precio: number }> | undefined

  if (!precios || !Array.isArray(precios) || precios.length === 0) {
    return NextResponse.json({ data: null, error: 'precios (array de {producto_id, tienda_id, precio}) es requerido' }, { status: 400 })
  }

  // validate all producto_ids belong to this ronda
  const supabase = getSupabaseServer()
  const { data: ronda } = await supabase
    .from('cotizacion_rondas')
    .select('id')
    .eq('id', id)
    .single()

  if (!ronda) {
    return NextResponse.json({ data: null, error: 'Ronda no encontrada' }, { status: 404 })
  }

  const upserts = precios.map((p) => ({
    producto_id: p.producto_id,
    tienda_id: p.tienda_id,
    precio: p.precio,
    updated_at: new Date().toISOString(),
  }))

  const { error: uErr } = await supabase
    .from('cotizacion_precios')
    .upsert(upserts, { onConflict: 'producto_id,tienda_id' })

  if (uErr) {
    return NextResponse.json({ data: null, error: uErr.message }, { status: 400 })
  }

  return NextResponse.json({ data: { updated: upserts.length }, error: null })
}
