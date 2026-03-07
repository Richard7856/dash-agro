import { createHash } from 'crypto'
import { getSupabaseServer } from '@/lib/supabase/server'

function hashKey(key: string): string {
  return createHash('sha256').update(key).digest('hex')
}

export async function validateApiKey(req: Request): Promise<boolean> {
  const key = req.headers.get('X-API-Key')
  if (!key) return false

  const hash = hashKey(key)
  const supabase = getSupabaseServer()

  const { data, error } = await supabase
    .from('api_keys')
    .select('id')
    .eq('key_hash', hash)
    .eq('activo', true)
    .single()

  if (error || !data) return false

  // Update last_used_at without blocking the response
  supabase
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', data.id)
    .then(() => {})

  return true
}

export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'API key inválida o ausente' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}
