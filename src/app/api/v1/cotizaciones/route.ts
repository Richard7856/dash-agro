import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  if (!await validateApiKey(req)) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const status = searchParams.get('status')

  const supabase = getSupabaseServer()
  let query = supabase
    .from('pedido_rondas')
    .select('*, pedido_clientes(id)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(offset, offset + limit - 1)

  if (status) query = query.eq('status', status)

  const { data, error, count } = await query

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 500 })

  const mapped = (data ?? []).map((r) => ({
    id: r.id,
    nombre: r.nombre,
    fecha: r.fecha,
    status: r.status,
    notas: r.notas,
    created_at: r.created_at,
    clientes_count: Array.isArray(r.pedido_clientes) ? r.pedido_clientes.length : 0,
  }))

  return NextResponse.json({ data: mapped, error: null, meta: { total: count, limit, offset } })
}

export async function POST(req: NextRequest) {
  if (!await validateApiKey(req)) return unauthorizedResponse()

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ data: null, error: 'JSON inválido' }, { status: 400 })
  }

  if (!body.fecha) {
    return NextResponse.json({ data: null, error: 'fecha es requerido' }, { status: 400 })
  }

  const supabase = getSupabaseServer()

  const { data: ronda, error: rErr } = await supabase
    .from('pedido_rondas')
    .insert({
      nombre: (body.nombre as string | null) ?? null,
      fecha: body.fecha as string,
      notas: (body.notas as string | null) ?? null,
    })
    .select()
    .single()

  if (rErr || !ronda) {
    return NextResponse.json({ data: null, error: rErr?.message ?? 'Error creando ronda' }, { status: 400 })
  }

  return NextResponse.json({ data: ronda, error: null }, { status: 201 })
}
