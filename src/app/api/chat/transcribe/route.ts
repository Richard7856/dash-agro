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
  const { error } = await supabaseAdmin.auth.getUser(token)
  if (error) return NextResponse.json({ error: 'No autorizado' }, { status: 401 })

  const formData = await req.formData()
  const audio = formData.get('audio') as File | null
  if (!audio) return NextResponse.json({ error: 'Audio requerido' }, { status: 400 })

  // Forward to Groq Whisper
  const groqForm = new FormData()
  groqForm.append('file', audio, audio.name || 'audio.webm')
  groqForm.append('model', 'whisper-large-v3-turbo')
  groqForm.append('language', 'es')
  groqForm.append('response_format', 'json')

  const groqRes = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.GROQ_API_KEY}` },
    body: groqForm,
  })

  if (!groqRes.ok) {
    const err = await groqRes.text()
    console.error('Groq error:', err)
    return NextResponse.json({ error: 'Error al transcribir el audio' }, { status: 502 })
  }

  const result = await groqRes.json()
  return NextResponse.json({ text: result.text ?? '' })
}
