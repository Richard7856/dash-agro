import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth'
import { generateSKU, generateLote } from '@/lib/format'

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0')

  const supabase = getSupabaseServer()
  const { data, error, count } = await supabase
    .from('inventario_registros')
    .select('*, ubicaciones(nombre)', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  return NextResponse.json({ data, error: null, meta: { total: count, limit, offset } })
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.nombre_producto || !body.cantidad || !body.precio_unitario) {
    return NextResponse.json(
      { data: null, error: 'nombre_producto, cantidad y precio_unitario son requeridos' },
      { status: 400 }
    )
  }

  const cantidad = parseFloat(String(body.cantidad))
  const precio_unitario = parseFloat(String(body.precio_unitario))

  const payload = {
    ean: body.ean as string | null ?? null,
    sku: (body.sku as string) || generateSKU(),
    nombre_producto: body.nombre_producto as string,
    cantidad,
    precio_unitario,
    precio_total: parseFloat((cantidad * precio_unitario).toFixed(2)),
    unidad_medida: (body.unidad_medida as string) || 'unidad',
    cantidad_por_caja: body.cantidad_por_caja != null ? parseFloat(String(body.cantidad_por_caja)) : null,
    cajas_tarima: body.cajas_tarima != null ? parseInt(String(body.cajas_tarima)) : null,
    lote: (body.lote as string) || generateLote(),
    ubicacion_id: (body.ubicacion_id as string | null) ?? null,
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('inventario_registros')
    .insert(payload)
    .select()
    .single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

  return NextResponse.json({ data, error: null }, { status: 201 })
}
