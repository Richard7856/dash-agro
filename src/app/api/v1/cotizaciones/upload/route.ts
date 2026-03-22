import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/**
 * POST /api/v1/cotizaciones/upload
 * Accepts multipart form with an Excel file (.xlsx/.xls)
 * Returns parsed rows: { producto, cantidad, precio_min, precio_max }[]
 *
 * No auth required — used client-side only.
 * The actual data insertion happens on the client via Supabase.
 */
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
    }

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

    // Try to map columns flexibly
    const headers = Object.keys(rawRows[0])
    // Normalize: lowercase, strip accents, trim
    const norm = (s: string) =>
      s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()

    const findCol = (keywords: string[]) =>
      headers.find((h) => keywords.some((k) => norm(h).includes(k))) ?? null

    const colProducto = findCol(['descripcion', 'desc', 'producto', 'nombre', 'articulo', 'item'])
    const colCantidad = findCol(['ped', 'cantidad', 'qty', 'piezas', 'unidades', 'cant'])

    // Handle duplicate "COSTO MAXIMO" columns: first occurrence = min, second = max
    const costoHeaders = headers.filter((h) => norm(h).includes('costo'))
    let colPrecioMin: string | null = null
    let colPrecioMax: string | null = null

    if (costoHeaders.length >= 2) {
      // Two cost columns: first = min, second = max
      colPrecioMin = costoHeaders[0]
      colPrecioMax = costoHeaders[1]
    } else if (costoHeaders.length === 1) {
      // Single cost column → use as both min and max
      colPrecioMin = costoHeaders[0]
      colPrecioMax = costoHeaders[0]
    } else {
      // Fallback: look for explicit min/max keywords
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
      // Ensure min <= max (swap if inverted)
      .map((r) => {
        if (r.precio_min != null && r.precio_max != null && r.precio_min > r.precio_max) {
          return { ...r, precio_min: r.precio_max, precio_max: r.precio_min }
        }
        return r
      })

    return NextResponse.json({
      data: rows,
      meta: {
        filename: file.name,
        total_rows: rows.length,
        columns_detected: { colProducto, colCantidad, colPrecioMin, colPrecioMax },
      },
      error: null,
    })
  } catch (err) {
    return NextResponse.json({
      error: `Error procesando archivo: ${err instanceof Error ? err.message : 'desconocido'}`,
    }, { status: 500 })
  }
}
