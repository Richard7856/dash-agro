import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/v1/cotizaciones/upload-precios
 * Accepts Excel (.xlsx/.xls/.csv), PDF, or image
 * Returns parsed: { producto, tienda, precio }[]
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
      return parsePricesPdfOrImage(file, isPdf)
    }

    return parseExcelPrices(file)
  } catch (err) {
    return NextResponse.json({
      error: `Error procesando: ${err instanceof Error ? err.message : 'desconocido'}`,
    }, { status: 500 })
  }
}

// ─── Excel price parser ───────────────────────────────────────────────────────

async function parseExcelPrices(file: File) {
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

  if (!colProducto) {
    return NextResponse.json({
      error: `No se encontró columna de producto. Columnas: ${headers.join(', ')}`,
    }, { status: 400 })
  }

  const colTienda = findCol(['tienda', 'store', 'sucursal'])
  const colPrecio = findCol(['precio', 'price', 'costo', 'valor'])

  const results: { producto: string; tienda: string; precio: number }[] = []

  if (colTienda && colPrecio) {
    for (const r of rawRows) {
      const prod = String(r[colProducto] ?? '').trim()
      const tienda = String(r[colTienda] ?? '').trim()
      const precio = parseFloat(String(r[colPrecio])) || 0
      if (prod && tienda && precio > 0) {
        results.push({ producto: prod, tienda, precio })
      }
    }
  } else {
    const tiendaCols = headers.filter((h) => h !== colProducto)
    for (const r of rawRows) {
      const prod = String(r[colProducto] ?? '').trim()
      if (!prod) continue
      for (const tc of tiendaCols) {
        const precio = parseFloat(String(r[tc])) || 0
        if (precio > 0) {
          results.push({ producto: prod, tienda: tc.trim(), precio })
        }
      }
    }
  }

  return NextResponse.json({
    data: results,
    meta: { filename: file.name, total: results.length, source: 'excel', format: colTienda ? 'long' : 'wide' },
    error: null,
  })
}

// ─── PDF / Image price parser (via Claude Vision) ─────────────────────────────

async function parsePricesPdfOrImage(file: File, isPdf: boolean) {
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
          text: `Extrae los precios por producto y tienda de esta hoja de cotización/precios.

Para cada precio encontrado, genera un objeto con:
- producto: nombre/descripción del producto (string)
- tienda: nombre de la tienda donde se cotizó (string)
- precio: el precio encontrado (number)

Si el documento tiene una tabla con tiendas como columnas (ej: Garis, Anicetos, etc.) y productos como filas, extrae cada celda de precio.
Si el documento lista precios uno por uno, extrae cada línea.

Responde SOLO con un JSON array, sin markdown, sin explicación. Ejemplo:
[{"producto":"NESCAFE CLASICO","tienda":"Garis","precio":978},{"producto":"NESCAFE CLASICO","tienda":"Anicetos","precio":950}]`
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  let rows: { producto: string; tienda: string; precio: number }[]
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found')
    rows = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({
      error: `No se pudo extraer precios del ${isPdf ? 'PDF' : 'imagen'}. Intenta con Excel.`,
      raw_response: text.substring(0, 500),
    }, { status: 400 })
  }

  return NextResponse.json({
    data: rows,
    meta: { filename: file.name, total: rows.length, source: isPdf ? 'pdf-ai' : 'image-ai' },
    error: null,
  })
}
