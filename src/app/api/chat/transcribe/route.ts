import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

export async function POST(req: NextRequest) {
  // Verify Supabase session via Bearer token
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })
  const { error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  // Check GROQ_API_KEY is configured
  if (!process.env.GROQ_API_KEY) {
    console.error('[transcribe] GROQ_API_KEY not set in environment')
    return NextResponse.json(
      { error: 'Servicio de transcripción no configurado (falta GROQ_API_KEY)' },
      { status: 503 }
    )
  }

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'Audio requerido' }, { status: 400 })

  console.log('[transcribe] audio size:', audio.size, 'type:', audio.type, 'name:', audio.name)

  // Build Groq request — ensure proper filename extension
  const ext = audio.name?.includes('.') ? audio.name.split('.').pop() :
    audio.type.includes('mp4') ? 'mp4' : 'webm'
  const groqForm = new FormData()
  groqForm.append('file', audio, `audio.${ext}`)
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'es')
  groqForm.append('response_format', 'json')
  groqForm.append('prompt', 'Agrodelicias. Inventario, ventas, compras, gastos, clientes, proveedores. Kilogramos, litros, cajas, piezas, tarimas, gramos. Bodega, precio unitario, monto total, folio, proveedor, factura.')

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  })

  if (!groqRes.ok) {
    const errText = await groqRes.text()
    console.error('[transcribe] Groq status:', groqRes.status, 'body:', errText)
    return NextResponse.json(
      { error: 'Error al transcribir', groqStatus: groqRes.status },
      { status: 502 }
    )
  }

  const result = await groqRes.json()
  return NextResponse.json({ text: result.text ?? '' })
}
