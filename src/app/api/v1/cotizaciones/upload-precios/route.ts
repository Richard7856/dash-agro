import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'

/**
 * POST /api/v1/cotizaciones/upload-precios
 * Accepts Excel with columns: Producto + one column per tienda (precio)
 * OR columns: Producto, Tienda, Precio (long format)
 * Returns parsed: { producto, tienda, precio }[]
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

    // Check if it's a "long format" (Producto, Tienda, Precio) or "wide format" (Producto, Garis, Anicetos, ...)
    const colTienda = findCol(['tienda', 'store', 'sucursal'])
    const colPrecio = findCol(['precio', 'price', 'costo', 'valor'])

    const results: { producto: string; tienda: string; precio: number }[] = []

    if (colTienda && colPrecio) {
      // Long format
      for (const r of rawRows) {
        const prod = String(r[colProducto] ?? '').trim()
        const tienda = String(r[colTienda] ?? '').trim()
        const precio = parseFloat(String(r[colPrecio])) || 0
        if (prod && tienda && precio > 0) {
          results.push({ producto: prod, tienda, precio })
        }
      }
    } else {
      // Wide format: every column except the product column is a tienda
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
      meta: { filename: file.name, total: results.length, format: colTienda ? 'long' : 'wide' },
      error: null,
    })
  } catch (err) {
    return NextResponse.json({
      error: `Error procesando: ${err instanceof Error ? err.message : 'desconocido'}`,
    }, { status: 500 })
  }
}
