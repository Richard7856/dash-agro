import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/v1/tickets/analyze
 * Accepts image of a ticket/receipt
 * Returns extracted: tienda, fecha, items[], subtotal, iva, total, metodo_pago
 */
export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
  }

  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió imagen' }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const base64 = Buffer.from(buffer).toString('base64')

    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    const isPdf = ext === 'pdf' || file.type === 'application/pdf'
    const mediaType = isPdf ? 'application/pdf' as const
      : file.type === 'image/png' ? 'image/png' as const
      : file.type === 'image/webp' ? 'image/webp' as const
      : 'image/jpeg' as const

    const client = new Anthropic({ apiKey })

    const sourceBlock = isPdf
      ? { type: 'document' as const, source: { type: 'base64' as const, media_type: mediaType as 'application/pdf', data: base64 } }
      : { type: 'image' as const, source: { type: 'base64' as const, media_type: mediaType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64 } }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [{
        role: 'user',
        content: [
          sourceBlock,
          {
            type: 'text',
            text: `Analiza este ticket de compra/recibo y extrae toda la información en JSON.

Extrae:
- tienda: nombre de la tienda/establecimiento (string o null)
- fecha: fecha del ticket en formato YYYY-MM-DD (string o null)
- metodo_pago: efectivo, tarjeta, etc. (string o null)
- subtotal: subtotal antes de impuestos (number o null)
- iva: monto de IVA/impuestos (number o null)
- total: total pagado (number)
- items: array de productos comprados, cada uno con:
  - descripcion: nombre del producto (string)
  - cantidad: cuántas unidades (number, default 1)
  - precio_unitario: precio por unidad (number)
  - total: cantidad × precio_unitario (number)

Si un campo no es visible o legible, pon null.
Si la cantidad no se ve, asume 1.
Si el precio unitario no se ve pero el total sí, calcula unitario = total / cantidad.

Responde SOLO con JSON, sin markdown:
{"tienda":"...","fecha":"...","metodo_pago":"...","subtotal":0,"iva":0,"total":0,"items":[{"descripcion":"...","cantidad":1,"precio_unitario":0,"total":0}]}`
          },
        ],
      }],
    })

    const text = response.content[0].type === 'text' ? response.content[0].text : ''

    let parsed: {
      tienda: string | null
      fecha: string | null
      metodo_pago: string | null
      subtotal: number | null
      iva: number | null
      total: number
      items: { descripcion: string; cantidad: number; precio_unitario: number; total: number }[]
    }

    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/)
      if (!jsonMatch) throw new Error('No JSON found')
      parsed = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({
        error: 'No se pudo extraer información del ticket. Intenta con una foto más clara.',
        raw_response: text.substring(0, 500),
      }, { status: 400 })
    }

    return NextResponse.json({ data: parsed, error: null })
  } catch (err) {
    return NextResponse.json({
      error: `Error analizando ticket: ${err instanceof Error ? err.message : 'desconocido'}`,
    }, { status: 500 })
  }
}
