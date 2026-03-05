import { createClient } from '@supabase/supabase-js'

// Placeholder para que el build no falle si faltan las env vars.
// En runtime siempre estarán presentes vía .env.local / Vercel.
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'https://placeholder.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? 'placeholder'
)
