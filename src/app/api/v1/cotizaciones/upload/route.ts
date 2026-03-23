import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import Anthropic from '@anthropic-ai/sdk'

/**
 * POST /api/v1/cotizaciones/upload
 * Accepts multipart form with Excel (.xlsx/.xls), PDF, or image
 * Returns parsed rows: { producto, cantidad, precio_min, precio_max }[]
 * Also returns tiendas_precios if the sheet has price columns per tienda.
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

    return parseExcel(file)
  } catch (err) {
    return NextResponse.json({
      error: `Error procesando archivo: ${err instanceof Error ? err.message : 'desconocido'}`,
    }, { status: 500 })
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const norm = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

function findCol(headers: string[], keywords: string[]): string | null {
  return headers.find((h) => keywords.some((k) => norm(h).includes(k))) ?? null
}

// Known column keywords (not tienda names)
const KNOWN_COL_KEYWORDS = [
  'articulo', 'art', 'descripcion', 'desc', 'producto', 'nombre', 'item',
  'ped', 'cantidad', 'qty', 'piezas', 'unidades', 'cant', 'total',
  'precio', 'costo', 'min', 'max', 'minimo', 'maximo',
]

function isKnownColumn(header: string): boolean {
  const n = norm(header)
  return KNOWN_COL_KEYWORDS.some((k) => n.includes(k)) || n.startsWith('__empty')
}

// ─── Excel parser ─────────────────────────────────────────────────────────────

async function parseExcel(file: File) {
  const buffer = await file.arrayBuffer()
  const wb = XLSX.read(buffer, { type: 'array' })
  const ws = wb.Sheets[wb.SheetNames[0]]

  if (!ws) {
    return NextResponse.json({ error: 'El archivo no tiene hojas de cálculo' }, { status: 400 })
  }

  // Read raw (header: 1) to detect if row 0 is a meta-header (e.g., client names)
  const allRows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, defval: '' })
  if (allRows.length < 2) {
    return NextResponse.json({ error: 'El archivo está vacío' }, { status: 400 })
  }

  // Detect if row 0 is a meta-header by checking if row 1 looks like actual headers
  let headerRow: string[]
  let dataStartIdx: number

  const row0 = (allRows[0] as unknown[]).map(String)
  const row1 = (allRows[1] as unknown[]).map(String)

  const row0HasDescripcion = row0.some((c) => ['descripcion', 'desc', 'producto', 'nombre'].some((k) => norm(String(c)).includes(k)))
  const row1HasDescripcion = row1.some((c) => ['descripcion', 'desc', 'producto', 'nombre'].some((k) => norm(String(c)).includes(k)))

  if (!row0HasDescripcion && row1HasDescripcion) {
    // Row 0 is meta (client names above PED columns), row 1 is the real header
    headerRow = row1
    dataStartIdx = 2
  } else {
    // Row 0 is the header
    headerRow = row0
    dataStartIdx = 1
  }

  // Build data rows as objects keyed by headerRow
  const dataRows: Record<string, unknown>[] = []
  for (let i = dataStartIdx; i < allRows.length; i++) {
    const raw = allRows[i] as unknown[]
    const obj: Record<string, unknown> = {}
    for (let j = 0; j < headerRow.length; j++) {
      const key = headerRow[j] || `_col_${j}`
      obj[key] = raw[j] ?? ''
    }
    dataRows.push(obj)
  }

  if (dataRows.length === 0) {
    return NextResponse.json({ error: 'No hay datos en el archivo' }, { status: 400 })
  }

  const headers = headerRow.filter(h => h && !h.startsWith('_col_'))

  // Find core columns
  const colProducto = findCol(headers, ['descripcion', 'desc', 'producto', 'nombre', 'articulo', 'item'])
  const colTotal = findCol(headers, ['total'])

  // Find PED columns: could be multiple (one per client) or single
  const pedCols = headers.filter((h) => norm(h) === 'ped' || norm(h).includes('cantidad') || norm(h).includes('qty'))
  const colCantidad = colTotal ?? (pedCols.length === 1 ? pedCols[0] : null)

  // If multiple PED columns and TOTAL exists, use TOTAL for cantidad
  // Otherwise sum PED columns

  // Find price columns
  const precioHeaders = headers.filter((h) => norm(h).includes('precio') || norm(h).includes('costo'))
  let colPrecioMin: string | null = null
  let colPrecioMax: string | null = null

  if (precioHeaders.length >= 2) {
    // Sort: the one with "min" first, then "max"
    const minCol = precioHeaders.find((h) => norm(h).includes('min'))
    const maxCol = precioHeaders.find((h) => norm(h).includes('max'))
    if (minCol && maxCol) {
      colPrecioMin = minCol
      colPrecioMax = maxCol
    } else {
      colPrecioMin = precioHeaders[0]
      colPrecioMax = precioHeaders[1]
    }
  } else if (precioHeaders.length === 1) {
    colPrecioMin = precioHeaders[0]
    colPrecioMax = precioHeaders[0]
  }

  if (!colProducto) {
    return NextResponse.json({
      error: `No se encontró columna de producto. Columnas disponibles: ${headers.join(', ')}`,
    }, { status: 400 })
  }

  // Detect tienda columns: columns after PRECIO MAX that are not known keywords
  // These are columns that might have tienda names (Inspector, Zorro, Sahuayo, PROMOTORA, etc.)
  const precioMaxIdx = colPrecioMax ? headers.indexOf(colPrecioMax) : -1
  const tiendaColumns: string[] = []
  if (precioMaxIdx >= 0) {
    for (let i = precioMaxIdx + 1; i < headers.length; i++) {
      if (!isKnownColumn(headers[i]) && headers[i].trim().length > 0) {
        tiendaColumns.push(headers[i])
      }
    }
  }

  // Parse rows
  const rows = dataRows
    .filter((r) => {
      const prod = String(r[colProducto] ?? '').trim()
      return prod.length > 0 && prod !== 'Articulo' && prod !== 'Descripción'
    })
    .map((r) => {
      // Calculate cantidad
      let cantidad = 0
      if (colTotal && r[colTotal] !== undefined && r[colTotal] !== '') {
        cantidad = parseFloat(String(r[colTotal])) || 0
      } else if (pedCols.length > 0) {
        // Sum all PED columns
        cantidad = pedCols.reduce((sum, col) => sum + (parseFloat(String(r[col])) || 0), 0)
      } else if (colCantidad) {
        cantidad = parseFloat(String(r[colCantidad])) || 0
      }

      const precioMinVal = colPrecioMin ? parseFloat(String(r[colPrecioMin])) || null : null
      const precioMaxVal = colPrecioMax ? parseFloat(String(r[colPrecioMax])) || null : null

      // Extract tienda prices if present
      const tiendaPrecios: Record<string, number> = {}
      for (const tc of tiendaColumns) {
        const val = parseFloat(String(r[tc]))
        if (!isNaN(val) && val > 0) {
          tiendaPrecios[tc.trim()] = val
        }
      }

      return {
        producto: String(r[colProducto] ?? '').trim(),
        cantidad,
        precio_min: precioMinVal,
        precio_max: precioMaxVal,
        ...(Object.keys(tiendaPrecios).length > 0 ? { tienda_precios: tiendaPrecios } : {}),
      }
    })
    .map((r) => {
      if (r.precio_min != null && r.precio_max != null && r.precio_min > r.precio_max) {
        return { ...r, precio_min: r.precio_max, precio_max: r.precio_min }
      }
      return r
    })

  // If we found tienda columns, also include the detected client names from row 0
  const clientNames: string[] = []
  if (!row0HasDescripcion && row1HasDescripcion) {
    // Row 0 has client names above PED columns
    for (const cell of row0) {
      const s = String(cell).trim()
      if (s && s !== '' && !s.startsWith('__')) clientNames.push(s)
    }
  }

  return NextResponse.json({
    data: rows,
    meta: {
      filename: file.name,
      total_rows: rows.length,
      source: 'excel',
      columns_detected: { colProducto, colCantidad: colTotal ?? colCantidad, colPrecioMin, colPrecioMax },
      tienda_columns: tiendaColumns.length > 0 ? tiendaColumns : undefined,
      client_names: clientNames.length > 0 ? clientNames : undefined,
    },
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
- cantidad: cantidad pedida o total (number, si no se ve pon 0)
- precio_min: precio mínimo o costo mínimo (number o null)
- precio_max: precio máximo o costo máximo (number o null)
- tienda_precios: objeto con nombre_tienda → precio para cada tienda donde haya un precio (opcional)

Si hay columnas con nombres de tiendas (Inspector, Zorro, etc.) y precios, inclúyelos en tienda_precios.
Si hay dos columnas de costo/precio, la menor es precio_min y la mayor es precio_max.

Responde SOLO con un JSON array, sin markdown. Ejemplo:
[{"producto":"NESCAFE CLASICO 6/350 G","cantidad":14,"precio_min":978,"precio_max":1084,"tienda_precios":{"Inspector":990,"Zorro":1010}}]`
        },
      ],
    }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text : ''

  let rows: { producto: string; cantidad: number; precio_min: number | null; precio_max: number | null; tienda_precios?: Record<string, number> }[]
  try {
    const jsonMatch = text.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array found')
    rows = JSON.parse(jsonMatch[0])
  } catch {
    return NextResponse.json({
      error: `No se pudo extraer datos del ${isPdf ? 'PDF' : 'imagen'}. Intenta con un archivo Excel.`,
      raw_response: text.substring(0, 500),
    }, { status: 400 })
  }

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
