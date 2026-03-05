export function validateApiKey(req: Request): boolean {
  const key = req.headers.get('X-API-Key')
  const expected = process.env.AGRO_API_KEY
  if (!expected) return false
  return key === expected
}

export function unauthorizedResponse(): Response {
  return new Response(
    JSON.stringify({ error: 'API key inválida o ausente' }),
    { status: 401, headers: { 'Content-Type': 'application/json' } }
  )
}
