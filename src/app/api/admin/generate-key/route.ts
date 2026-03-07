import { NextRequest, NextResponse } from 'next/server'
import { createHash, randomBytes } from 'crypto'
import { getSupabaseServer } from '@/lib/supabase/server'

async function requireAuth(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '')
  if (!token) return null
  const supabase = getSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser(token)
  return user
}

// POST /api/admin/generate-key  { nombre: string }
// Returns the full key ONCE.
export async function POST(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  let body: { nombre?: string }
  try { body = await req.json() } catch { body = {} }

  const nombre = (body.nombre ?? '').trim()
  if (!nombre) return NextResponse.json({ error: 'El campo nombre es requerido' }, { status: 400 })

  const rawKey = `agro_${randomBytes(20).toString('hex')}`
  const keyHash = createHash('sha256').update(rawKey).digest('hex')
  const keyPrefix = rawKey.slice(0, 12)

  const supabase = getSupabaseServer()
  const { data, error } = await supabase
    .from('api_keys')
    .insert({ nombre, key_hash: keyHash, key_prefix: keyPrefix, activo: true })
    .select('id, nombre, key_prefix, activo, created_at')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ...data, full_key: rawKey }, { status: 201 })
}

// DELETE /api/admin/generate-key?id=uuid  — revoke a key
export async function DELETE(req: NextRequest) {
  const user = await requireAuth(req)
  if (!user) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id requerido' }, { status: 400 })

  const supabase = getSupabaseServer()
  const { error } = await supabase.from('api_keys').update({ activo: false }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
