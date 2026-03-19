import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const VALID_ROLES = ['admin', 'cotizador']

export async function POST(req: NextRequest) {
  // Auth check: require bearer token from logged-in admin
  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const email = body.email as string | undefined
  const password = body.password as string | undefined
  const nombre = (body.nombre as string | undefined) ?? null
  const rol = (body.rol as string | undefined) ?? 'cotizador'

  if (!email || !password) {
    return NextResponse.json({ error: 'email y password son requeridos' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
  }
  if (!VALID_ROLES.includes(rol)) {
    return NextResponse.json({ error: `rol debe ser: ${VALID_ROLES.join(', ')}` }, { status: 400 })
  }

  // Verify caller is admin
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  const token = authHeader.split(' ')[1]
  const { data: { user: caller } } = await supabaseAdmin.auth.getUser(token)
  if (!caller) {
    return NextResponse.json({ error: 'Token inválido' }, { status: 401 })
  }

  // Check caller is admin
  const { data: callerProfile } = await supabaseAdmin
    .from('user_profiles')
    .select('rol')
    .eq('id', caller.id)
    .single()

  if (!callerProfile || callerProfile.rol !== 'admin') {
    return NextResponse.json({ error: 'Solo administradores pueden crear usuarios' }, { status: 403 })
  }

  // Create auth user
  const { data: newUser, error: authErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  })

  if (authErr || !newUser.user) {
    return NextResponse.json({ error: authErr?.message ?? 'Error creando usuario' }, { status: 400 })
  }

  // Create profile
  const { error: profErr } = await supabaseAdmin
    .from('user_profiles')
    .insert({
      id: newUser.user.id,
      email,
      nombre,
      rol,
      activo: true,
    })

  if (profErr) {
    return NextResponse.json({ error: profErr.message }, { status: 400 })
  }

  return NextResponse.json({
    id: newUser.user.id,
    email,
    nombre,
    rol,
    activo: true,
  }, { status: 201 })
}
