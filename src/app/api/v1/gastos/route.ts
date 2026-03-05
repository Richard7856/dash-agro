import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServer } from '@/lib/supabase/server'
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth'

export async function GET(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse()

  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '100'), 500)
  const offset = parseInt(searchParams.get('offset') ?? '0')
  const desde = searchParams.get('desde')
  const hasta = searchParams.get('hasta')

  const supabase = getSupabaseServer()
  let query = supabase
    .from('gastos')
    .select('*, personas(nombre)', { count: 'exact' })
    .order('fecha', { ascending: false })
    .range(offset, offset + limit - 1)

  if (desde) query = query.gte('fecha', desde)
  if (hasta) query = query.lte('fecha', hasta)

  const { data, error, count } = await query

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

  if (!body.fecha || !body.concepto || !body.monto) {
    return NextResponse.json({ data: null, error: 'fecha, concepto y monto son requeridos' }, { status: 400 })
  }

  const payload = {
    fecha: body.fecha as string,
    concepto: body.concepto as string,
    monto: parseFloat(String(body.monto)),
    categoria: (body.categoria as string | null) ?? null,
    persona_id: (body.persona_id as string | null) ?? null,
    notas: (body.notas as string | null) ?? null,
  }

  const supabase = getSupabaseServer()
  const { data, error } = await supabase.from('gastos').insert(payload).select().single()

  if (error) return NextResponse.json({ data: null, error: error.message }, { status: 400 })

  return NextResponse.json({ data, error: null }, { status: 201 })
}
