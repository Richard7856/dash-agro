import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/v1/cotizaciones/upload
 * Accepts multipart form with Excel (.xlsx/.xls) or PDF file
 * Returns parsed rows: { producto, cantidad, precio_min, precio_max }[]
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

    const ext = file.name.toLowerCase().split('.').pop() ?? ''
    const isPdf = ext === 'pdf' || file.type === 'application/pdf'
    const isImage = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) || file.type.startsWith('image/')

    if (isPdf || isImage) {
      return parsePdfOrImage(file, isPdf)
    }

    // Excel/CSV path
    return parseExcel(file)
  } catch (err) {
    return NextResponse.json({
      error: `Error procesando archivo: ${err instanceof Error ? err.message : 'desconocido'}`,
    }, { status: 500 })
  }
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

async function parseExcel(file: File) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]

  if (!ws) {
    return NextResponse.json({ error: 'El archivo no tiene hojas de cálculo' }, { status: 400 })
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' })

  if (rawRows.length === 0) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }

  const headers = Object.keys(rawRows[0])
  const norm = (s: string) =>
    s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

  const findCol = (keywords: string[]) =>
    headers.find((h) => keywords.some((k) => norm(h).includes(k))) ?? null

  const colProducto = findCol(['descripcion', 'desc', 'producto', 'nombre', 'articulo', 'item'])
  const colCantidad = findCol(['ped', 'cantidad', 'qty', 'piezas', 'unidades', 'cant'])

  // Handle duplicate "COSTO MAXIMO" columns
  const costoHeaders = headers.filter((h) => norm(h).includes('costo'))
  let colPrecioMin: string | null = null
  let colPrecioMax: string | null = null

  if (costoHeaders.length >= 2) {
    colPrecioMin = costoHeaders[0]
    colPrecioMax = costoHeaders[1]
  } else if (costoHeaders.length === 1) {
    colPrecioMin = costoHeaders[0]
    colPrecioMax = costoHeaders[0]
  } else {
    colPrecioMin = findCol(['precio_min', 'min', 'minimo', 'precio minimo', 'pmin'])
    colPrecioMax = findCol(['precio_max', 'max', 'maximo', 'precio maximo', 'pmax'])
  }

  if (!colProducto) {
    return NextResponse.json({
      error: `No se encontró columna de producto. Columnas disponibles: ${headers.join(', ')}`,
    }, { status: 400 })
  }

  const rows = rawRows
    .filter((r) => {
      const prod = String(r[colProducto] ?? '').trim()
      return prod.length > 0
    })
    .map((r) => ({
      producto: String(r[colProducto] ?? '').trim(),
      cantidad: colCantidad ? parseFloat(String(r[colCantidad])) || 0 : 0,
      precio_min: colPrecioMin ? parseFloat(String(r[colPrecioMin])) || null : null,
      precio_max: colPrecioMax ? parseFloat(String(r[colPrecioMax])) || null : null,
    }))
    .map((r) => {
      if (r.precio_min != null && r.precio_max != null && r.precio_min > r.precio_max) {
        return { ...r, precio_min: r.precio_max, precio_max: r.precio_min }
      }
      return r
    })

  return NextResponse.json({
    data: rows,
    meta: { filename: file.name, total_rows: rows.length, source: 'excel',
      columns_detected: { colProducto, colCantidad, colPrecioMin, colPrecioMax } },
    error: null,
  })
}

// ─── PDF / Image parser (via Claude Vision) ───────────────────────────────────

async function parsePdfOrImage(file: File, isPdf: boolean) {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'ANTHROPIC_API_KEY no configurada' }, { status: 500 })
  }

  const buffer = await file.arrayBuffer()
  const base64 = Buffer.from(buffer).toString('base64')
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
          text: `Extrae todos los productos de esta hoja de pedido/cotización en formato JSON.

Para cada producto extrae:
- producto: nombre/descripción del producto (string)
- cantidad: cantidad pedida (number, si no se ve pon 0)
- precio_min: precio mínimo o costo mínimo (number o null si no existe)
- precio_max: precio máximo o costo máximo (number o null si no existe)

Si hay dos columnas de costo/precio, la menor es precio_min y la mayor es precio_max.
Si solo hay una columna de precio, úsala como precio_min y precio_max.

Responde SOLO con un JSON array, sin markdown, sin explicación. Ejemplo:
[{"producto":"NESCAFE CLASICO 6/350 G","cantidad":14,"precio_min":978,"precio_max":1084}]`
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  // Extract JSON from response
  let rows: { producto: string; cantidad: number; precio_min: number | null; precio_max: number | null }[]
  try {
    // Try to find JSON array in the response
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found')
    rows = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({
      error: `No se pudo extraer datos del ${isPdf ? 'PDF' : 'imagen'}. Intenta con un archivo Excel.`,
      raw_response: text.substring(0, 500),
    }, { status: 400 })
  }

  // Normalize min/max
  rows = rows.map((r) => {
    if (r.precio_min != null && r.precio_max != null && r.precio_min > r.precio_max) {
      return { ...r, precio_min: r.precio_max, precio_max: r.precio_min }
    }
    return r
  })

  return NextResponse.json({
    data: rows,
    meta: { filename: file.name, total_rows: rows.length, source: isPdf ? 'pdf-ai' : 'image-ai' },
    error: null,
  })
}
