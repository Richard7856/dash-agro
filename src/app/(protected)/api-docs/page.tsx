'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface EndpointParam {
  name: string
  type: string
  required: boolean
  description: string
}

interface Endpoint {
  method: 'GET' | 'POST' | 'PUT'
  path: string
  description: string
  params?: EndpointParam[]
  body?: EndpointParam[]
  exampleResponse: object
}

const endpoints: Endpoint[] = [
  // ── Inventario ────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/v1/inventario',
    description: 'Lista los registros de inventario',
    params: [
      { name: 'limit', type: 'number', required: false, description: 'Máx resultados (default 100, máx 500)' },
      { name: 'offset', type: 'number', required: false, description: 'Paginación (default 0)' },
    ],
    exampleResponse: {
      data: [{
        id: 'uuid', nombre_producto: 'Aguacate Hass', cantidad: 50,
        unidad_medida: 'caja', precio_compra_unitario: 120, precio_compra_total: 6000,
        numero_lote: 'LOTE-20260301-AB12', ean: '7501234567890', sku: 'SKU-ABC123',
        fecha_caducidad: '2026-04-15', ubicaciones: { nombre: 'Bodega A' },
      }],
      error: null,
      meta: { total: 42, limit: 100, offset: 0 },
    },
  },
  {
    method: 'POST',
    path: '/api/v1/inventario',
    description: 'Crea un nuevo registro de inventario',
    body: [
      { name: 'nombre_producto', type: 'string', required: true, description: 'Nombre del producto' },
      { name: 'cantidad', type: 'number', required: true, description: 'Cantidad en inventario' },
      { name: 'precio_compra_unitario', type: 'number', required: true, description: 'Precio unitario de compra' },
      { name: 'ean', type: 'string', required: false, description: 'Código de barras EAN' },
      { name: 'sku', type: 'string', required: false, description: 'SKU (auto-generado si se omite)' },
      { name: 'unidad_medida', type: 'string', required: false, description: 'unidad|kg|lt|caja|tarima (default: unidad)' },
      { name: 'numero_lote', type: 'string', required: false, description: 'Número de lote (auto-generado si se omite)' },
      { name: 'fecha_caducidad', type: 'date', required: false, description: 'Fecha de caducidad YYYY-MM-DD' },
      { name: 'cantidad_por_caja', type: 'number', required: false, description: 'Unidades por caja' },
      { name: 'cajas_por_tarima', type: 'number', required: false, description: 'Cajas por tarima' },
      { name: 'ubicacion_id', type: 'uuid', required: false, description: 'ID de ubicación' },
    ],
    exampleResponse: { data: { id: 'uuid', nombre_producto: 'Aguacate Hass', cantidad: 50, numero_lote: 'LOTE-20260301-AB12' }, error: null },
  },
  // ── Compras ───────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/v1/compras',
    description: 'Lista las compras registradas',
    params: [
      { name: 'desde', type: 'date', required: false, description: 'Fecha inicio YYYY-MM-DD' },
      { name: 'hasta', type: 'date', required: false, description: 'Fecha fin YYYY-MM-DD' },
      { name: 'limit', type: 'number', required: false, description: 'Máx resultados (default 100, máx 500)' },
      { name: 'offset', type: 'number', required: false, description: 'Paginación (default 0)' },
    ],
    exampleResponse: {
      data: [{ id: 'uuid', numero_compra: 'COMP-20260301-AB12', fecha: '2026-03-01', monto_total: 15000, forma_pago: 'efectivo', descripcion: 'Aguacate 10 cajas' }],
      error: null, meta: { total: 10, limit: 100, offset: 0 },
    },
  },
  {
    method: 'POST',
    path: '/api/v1/compras',
    description: 'Registra una compra',
    body: [
      { name: 'fecha', type: 'date', required: true, description: 'Fecha de la compra YYYY-MM-DD' },
      { name: 'monto_total', type: 'number', required: true, description: 'Monto total MXN' },
      { name: 'descripcion', type: 'string', required: false, description: '¿Qué se compró?' },
      { name: 'forma_pago', type: 'string', required: false, description: 'efectivo|bonos_gasolina|mixto|otro' },
      { name: 'gastos', type: 'number', required: false, description: 'Gastos extra (flete, etc.)' },
      { name: 'persona_id', type: 'uuid', required: false, description: 'ID del proveedor/persona' },
      { name: 'ubicacion_id', type: 'uuid', required: false, description: 'ID de ubicación' },
      { name: 'notas', type: 'string', required: false, description: 'Observaciones' },
    ],
    exampleResponse: { data: { id: 'uuid', numero_compra: 'COMP-20260301-AB12', fecha: '2026-03-01', monto_total: 15000 }, error: null },
  },
  // ── Ventas ────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/v1/ventas',
    description: 'Lista las ventas registradas',
    params: [
      { name: 'desde', type: 'date', required: false, description: 'Fecha inicio YYYY-MM-DD' },
      { name: 'hasta', type: 'date', required: false, description: 'Fecha fin YYYY-MM-DD' },
      { name: 'limit', type: 'number', required: false, description: 'Máx resultados (default 100, máx 500)' },
      { name: 'offset', type: 'number', required: false, description: 'Paginación (default 0)' },
    ],
    exampleResponse: {
      data: [{ id: 'uuid', numero_venta: 'VENTA-20260301-CD34', fecha: '2026-03-01', monto_total: 22000, forma_pago: 'efectivo' }],
      error: null, meta: { total: 5, limit: 100, offset: 0 },
    },
  },
  {
    method: 'POST',
    path: '/api/v1/ventas',
    description: 'Registra una venta',
    body: [
      { name: 'fecha', type: 'date', required: true, description: 'Fecha de la venta YYYY-MM-DD' },
      { name: 'monto_total', type: 'number', required: true, description: 'Monto total MXN' },
      { name: 'forma_pago', type: 'string', required: false, description: 'efectivo|bonos_gasolina|mixto|otro' },
      { name: 'fecha_entrega', type: 'date', required: false, description: 'Fecha de entrega al cliente' },
      { name: 'gastos_extras', type: 'number', required: false, description: 'Gastos de envío/extras' },
      { name: 'persona_id', type: 'uuid', required: false, description: 'ID del cliente/persona' },
      { name: 'vendedor_id', type: 'uuid', required: false, description: 'ID del vendedor' },
      { name: 'ubicacion_id', type: 'uuid', required: false, description: 'ID de ubicación' },
      { name: 'notas', type: 'string', required: false, description: 'Observaciones' },
    ],
    exampleResponse: { data: { id: 'uuid', numero_venta: 'VENTA-20260301-CD34', fecha: '2026-03-01', monto_total: 22000 }, error: null },
  },
  // ── Gastos ────────────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/v1/gastos',
    description: 'Lista los gastos operacionales',
    params: [
      { name: 'desde', type: 'date', required: false, description: 'Fecha inicio YYYY-MM-DD' },
      { name: 'hasta', type: 'date', required: false, description: 'Fecha fin YYYY-MM-DD' },
      { name: 'limit', type: 'number', required: false, description: 'Máx resultados (default 100, máx 500)' },
      { name: 'offset', type: 'number', required: false, description: 'Paginación (default 0)' },
    ],
    exampleResponse: {
      data: [{ id: 'uuid', concepto: 'Flete aguacate', monto: 1200, categoria: 'flete', fecha: '2026-03-01' }],
      error: null, meta: { total: 8, limit: 100, offset: 0 },
    },
  },
  {
    method: 'POST',
    path: '/api/v1/gastos',
    description: 'Registra un gasto operacional',
    body: [
      { name: 'fecha', type: 'date', required: true, description: 'Fecha del gasto YYYY-MM-DD' },
      { name: 'concepto', type: 'string', required: true, description: 'Descripción del gasto' },
      { name: 'monto', type: 'number', required: true, description: 'Monto MXN' },
      { name: 'categoria', type: 'string', required: false, description: 'flete|combustible|personal|arrendamiento|otro' },
      { name: 'persona_id', type: 'uuid', required: false, description: 'ID de persona relacionada' },
      { name: 'notas', type: 'string', required: false, description: 'Observaciones' },
    ],
    exampleResponse: { data: { id: 'uuid', concepto: 'Flete aguacate', monto: 1200, categoria: 'flete' }, error: null },
  },
  // ── Cotizaciones ──────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/api/v1/cotizaciones',
    description: 'Lista las rondas de cotización',
    params: [
      { name: 'status', type: 'string', required: false, description: 'Filtrar por status: abierta|cerrada' },
      { name: 'limit', type: 'number', required: false, description: 'Máx resultados (default 100, máx 500)' },
      { name: 'offset', type: 'number', required: false, description: 'Paginación (default 0)' },
    ],
    exampleResponse: {
      data: [{ id: 'uuid', nombre: 'COT-20260318-AB12', fecha: '2026-03-18', status: 'abierta', productos_count: 5 }],
      error: null, meta: { total: 3, limit: 100, offset: 0 },
    },
  },
  {
    method: 'POST',
    path: '/api/v1/cotizaciones',
    description: 'Crea una ronda de cotización con productos',
    body: [
      { name: 'fecha', type: 'date', required: true, description: 'Fecha de la ronda YYYY-MM-DD' },
      { name: 'productos', type: 'string[]', required: true, description: 'Array de nombres de productos a cotizar' },
      { name: 'nombre', type: 'string', required: false, description: 'Nombre/folio de la ronda' },
      { name: 'notas', type: 'string', required: false, description: 'Observaciones' },
    ],
    exampleResponse: { data: { id: 'uuid', nombre: 'COT-20260318-AB12', fecha: '2026-03-18', status: 'abierta', productos_count: 3 }, error: null },
  },
  {
    method: 'GET',
    path: '/api/v1/cotizaciones/:id',
    description: 'Obtiene una ronda con productos, precios por tienda y lista de tiendas',
    params: [],
    exampleResponse: {
      data: {
        id: 'uuid', nombre: 'Semana 12', fecha: '2026-03-13', status: 'abierta',
        productos: [
          { id: 'uuid', nombre_producto: 'Leche 1L', precios: [{ tienda_id: 'uuid', tienda_nombre: 'Garis', precio: 18.00 }] },
        ],
        tiendas: [{ id: 'uuid', nombre: 'Garis' }],
      },
      error: null,
    },
  },
  {
    method: 'PUT',
    path: '/api/v1/cotizaciones/:id',
    description: 'Actualiza precios de una ronda (upsert por producto+tienda)',
    body: [
      { name: 'precios', type: 'array', required: true, description: 'Array de {producto_id, tienda_id, precio}' },
    ],
    exampleResponse: { data: { updated: 5 }, error: null },
  },
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className={`text-xs px-2 py-1 rounded font-medium transition-colors ${copied ? 'bg-blue-700 text-blue-100' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}

function CopyButtonLight({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className={`text-xs px-3 py-1.5 rounded-lg font-medium transition-colors ${copied ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
      {copied ? '✓ Copiado' : label ?? 'Copiar'}
    </button>
  )
}

function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: 'bg-blue-100 text-blue-700',
    POST: 'bg-blue-100 text-blue-700',
    PUT: 'bg-amber-100 text-amber-700',
  }
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded font-mono w-14 text-center ${colors[method] ?? 'bg-gray-100 text-gray-700'}`}>
      {method}
    </span>
  )
}

function EndpointCard({ ep, baseUrl }: { ep: Endpoint; baseUrl: string }) {
  const [open, setOpen] = useState(false)

  const curlExample = ep.method === 'GET'
    ? `curl -H "X-API-Key: TU_CLAVE" \\\n  "${baseUrl}${ep.path.replace(':id', 'UUID_AQUI')}${ep.params?.length ? '?limit=10' : ''}"`
    : ep.method === 'PUT'
    ? `curl -X PUT \\\n  -H "X-API-Key: TU_CLAVE" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
        Object.fromEntries((ep.body ?? []).filter((b) => b.required).map((b) => [b.name, b.type === 'number' ? 0 : b.type === 'array' ? [] : 'valor'])),
        null, 2
      )}' \\\n  "${baseUrl}${ep.path.replace(':id', 'UUID_AQUI')}"`
    : `curl -X POST \\\n  -H "X-API-Key: TU_CLAVE" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
        Object.fromEntries((ep.body ?? []).filter((b) => b.required).map((b) => [b.name, b.type === 'number' ? 0 : b.type === 'string[]' ? ['ejemplo'] : 'valor'])),
        null, 2
      )}' \\\n  "${baseUrl}${ep.path}"`

  return (
    <div className="nm-card overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <MethodBadge method={ep.method} />
        <span className="font-mono text-sm text-gray-800 font-medium flex-1">{ep.path}</span>
        <span className="text-xs text-[var(--nm-text-subtle)] hidden sm:block">{ep.description}</span>
        <svg className={`w-4 h-4 text-[var(--nm-text-subtle)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-[var(--nm-bg-inset)] p-4 flex flex-col gap-4">
          <p className="text-sm text-gray-600">{ep.description}</p>

          {ep.params && ep.params.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide mb-2">Query params</p>
              <div className="flex flex-col gap-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex gap-2 text-sm">
                    <code className="text-blue-700 font-mono w-28 shrink-0">{p.name}</code>
                    <span className="text-[var(--nm-text-subtle)] font-mono text-xs w-14 shrink-0">{p.type}</span>
                    <span className="text-gray-600">{p.description}</span>
                    {!p.required && <span className="text-[var(--nm-text-subtle)] text-xs ml-auto shrink-0">opcional</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && ep.body.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide mb-2">Body JSON</p>
              <div className="flex flex-col gap-1">
                {ep.body.map((p) => (
                  <div key={p.name} className="flex gap-2 text-sm">
                    <code className="text-blue-700 font-mono w-36 shrink-0">{p.name}</code>
                    <span className="text-[var(--nm-text-subtle)] font-mono text-xs w-14 shrink-0">{p.type}</span>
                    <span className="text-gray-600 flex-1">{p.description}</span>
                    {p.required
                      ? <span className="text-red-500 text-xs shrink-0">requerido</span>
                      : <span className="text-[var(--nm-text-subtle)] text-xs shrink-0">opcional</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide">Ejemplo curl</p>
              <CopyButton text={curlExample} />
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">{curlExample}</pre>
          </div>

          <div>
            <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide mb-1">Respuesta ejemplo</p>
            <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs overflow-x-auto">
              {JSON.stringify(ep.exampleResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── LLM Summary generator ────────────────────────────────────────────────

function generateLlmSummary(base: string): string {
  return `# Agrodelicias REST API v1

## Base URL
${base}/api/v1

## Auth
Header: X-API-Key: <clave_activa>
Todas las peticiones requieren este header.

## Formato de respuesta
Todas las respuestas son JSON:
{ "data": ..., "error": null | "mensaje", "meta": { "total", "limit", "offset" } }

Códigos: 200=OK, 201=Creado, 400=Validación, 401=Auth, 404=No encontrado, 500=Error

## Endpoints

### Inventario
- GET  /api/v1/inventario — Lista inventario. Params: limit, offset
- POST /api/v1/inventario — Crea producto. Body: nombre_producto*, cantidad*, precio_compra_unitario*, ean, sku, unidad_medida, numero_lote, fecha_caducidad, cantidad_por_caja, cajas_por_tarima, ubicacion_id

### Compras
- GET  /api/v1/compras — Lista compras. Params: desde, hasta, limit, offset
- POST /api/v1/compras — Registra compra. Body: fecha*, monto_total*, descripcion, forma_pago(efectivo|bonos_gasolina|mixto|otro), gastos, persona_id, ubicacion_id, notas

### Ventas
- GET  /api/v1/ventas — Lista ventas. Params: desde, hasta, limit, offset
- POST /api/v1/ventas — Registra venta. Body: fecha*, monto_total*, forma_pago, fecha_entrega, gastos_extras, persona_id, vendedor_id, ubicacion_id, notas

### Gastos
- GET  /api/v1/gastos — Lista gastos. Params: desde, hasta, limit, offset
- POST /api/v1/gastos — Registra gasto. Body: fecha*, concepto*, monto*, categoria(flete|combustible|personal|arrendamiento|otro), persona_id, notas

### Cotizaciones (rondas de cotización en tiendas)
- GET  /api/v1/cotizaciones — Lista rondas. Params: status(abierta|cerrada), limit, offset
- POST /api/v1/cotizaciones — Crea ronda. Body: fecha*, productos*(string[]), nombre, notas
- GET  /api/v1/cotizaciones/:id — Detalle: ronda + productos + precios por tienda + lista tiendas
- PUT  /api/v1/cotizaciones/:id — Upsert precios. Body: precios*([{producto_id, tienda_id, precio}])

Tiendas disponibles: Garis, Anicetos, La pasadita, Promotora del norte, Inspector, Génova, Sahuayo, Scorpion (dinámicas, pueden agregarse).

## Notas
- Fechas en formato YYYY-MM-DD
- IDs son UUID v4
- Montos en MXN (decimal 12,2)
- * = campo requerido
- Paginación: limit (default 100, máx 500), offset (default 0)
`
}

// ─── Page ──────────────────────────────────────────────────────────────────

export default function ApiDocsPage() {
  const [baseUrl, setBaseUrl] = useState('https://tu-dominio.vercel.app')
  const [showLlmSummary, setShowLlmSummary] = useState(false)

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  const llmSummary = generateLlmSummary(baseUrl)

  // group endpoints by resource
  const groups: { label: string; prefix: string }[] = [
    { label: 'Inventario', prefix: '/api/v1/inventario' },
    { label: 'Compras', prefix: '/api/v1/compras' },
    { label: 'Ventas', prefix: '/api/v1/ventas' },
    { label: 'Gastos', prefix: '/api/v1/gastos' },
    { label: 'Cotizaciones', prefix: '/api/v1/cotizaciones' },
  ]

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-[var(--nm-text)]">Documentación API</h1>
        <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">REST API v1 — Agrodelicias</p>
      </div>

      {/* Autenticación */}
      <section className="mb-6 nm-card p-5">
        <h2 className="font-semibold text-[var(--nm-text)] mb-3">Autenticación</h2>
        <p className="text-sm text-gray-600 mb-3">
          Todos los endpoints requieren el header <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">X-API-Key</code> con una clave activa.
          Genera y administra tus claves en{' '}
          <Link href="/configuracion" className="text-blue-700 hover:underline font-medium">Configuración</Link>.
        </p>
        <div className="flex items-center gap-2">
          <pre className="flex-1 bg-gray-900 text-blue-400 rounded-xl p-3 text-xs overflow-x-auto">
            {`X-API-Key: agro_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
          </pre>
          <CopyButton text="X-API-Key: agro_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
      </section>

      {/* Base URL */}
      <section className="mb-6 nm-card p-5">
        <h2 className="font-semibold text-[var(--nm-text)] mb-2">URL base</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 nm-inset px-3 py-2 text-sm font-mono text-gray-800 break-all">
            {baseUrl}/api/v1
          </code>
          <CopyButtonLight text={`${baseUrl}/api/v1`} />
        </div>
      </section>

      {/* Respuesta estándar */}
      <section className="mb-6 nm-card p-5">
        <h2 className="font-semibold text-[var(--nm-text)] mb-2">Formato de respuesta</h2>
        <p className="text-sm text-gray-600 mb-3">Todas las respuestas usan JSON con la misma estructura:</p>
        <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs overflow-x-auto">
{`{
  "data": [...],         // null si hubo error
  "error": null,         // string si hubo error
  "meta": {              // solo en GET con paginación
    "total": 42,
    "limit": 100,
    "offset": 0
  }
}`}
        </pre>
        <div className="mt-3 flex flex-wrap gap-4 text-xs text-[var(--nm-text-muted)]">
          <span><span className="font-mono text-blue-700">200</span> — OK (GET)</span>
          <span><span className="font-mono text-blue-700">201</span> — Creado (POST)</span>
          <span><span className="font-mono text-red-600">400</span> — Validación</span>
          <span><span className="font-mono text-red-600">401</span> — API key inválida</span>
          <span><span className="font-mono text-red-600">404</span> — No encontrado</span>
        </div>
      </section>

      {/* Resumen tabla */}
      <section className="mb-4">
        <h2 className="font-semibold text-[var(--nm-text)] mb-3">Endpoints disponibles</h2>
        <div className="nm-card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-[var(--nm-text-muted)] uppercase">Recurso</th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--nm-text-muted)] uppercase text-center">GET</th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--nm-text-muted)] uppercase text-center">POST</th>
                <th className="px-3 py-2 text-xs font-semibold text-[var(--nm-text-muted)] uppercase text-center">PUT</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                { path: '/api/v1/inventario', get: true, post: true, put: false },
                { path: '/api/v1/compras', get: true, post: true, put: false },
                { path: '/api/v1/ventas', get: true, post: true, put: false },
                { path: '/api/v1/gastos', get: true, post: true, put: false },
                { path: '/api/v1/cotizaciones', get: true, post: true, put: false },
                { path: '/api/v1/cotizaciones/:id', get: true, post: false, put: true },
              ].map((r) => (
                <tr key={r.path} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{r.path}</td>
                  <td className="px-3 py-2 text-center text-blue-600">{r.get ? '✓' : ''}</td>
                  <td className="px-3 py-2 text-center text-blue-600">{r.post ? '✓' : ''}</td>
                  <td className="px-3 py-2 text-center text-amber-600">{r.put ? '✓' : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detalle de endpoints, agrupados */}
      {groups.map((g) => {
        const groupEps = endpoints.filter((ep) => ep.path.startsWith(g.prefix) || ep.path.startsWith(g.prefix.replace('/api/v1/', '/api/v1/')))
        if (groupEps.length === 0) return null
        return (
          <section key={g.label} className="mb-6">
            <h3 className="text-sm font-semibold text-[var(--nm-text-muted)] uppercase tracking-wide mb-2">{g.label}</h3>
            <div className="flex flex-col gap-2">
              {groupEps.map((ep) => (
                <EndpointCard key={`${ep.method}-${ep.path}`} ep={ep} baseUrl={baseUrl} />
              ))}
            </div>
          </section>
        )
      })}

      {/* ── Resumen para LLM ─────────────────────────────────────────── */}
      <section className="mb-8 nm-card p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="font-semibold text-[var(--nm-text)]">Resumen para LLM</h2>
            <p className="text-xs text-[var(--nm-text-muted)] mt-0.5">Copia este resumen compacto para compartirlo con un asistente de IA</p>
          </div>
          <div className="flex gap-2">
            <CopyButtonLight text={llmSummary} label="Copiar resumen" />
            <button
              onClick={() => setShowLlmSummary((v) => !v)}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors bg-gray-100 text-gray-600 hover:bg-gray-200"
            >
              {showLlmSummary ? 'Ocultar' : 'Ver'}
            </button>
          </div>
        </div>
        {showLlmSummary && (
          <pre className="bg-gray-900 text-gray-100 rounded-xl p-4 text-xs overflow-x-auto whitespace-pre-wrap max-h-96 overflow-y-auto">
            {llmSummary}
          </pre>
        )}
      </section>

      <div className="text-center text-xs text-[var(--nm-text-subtle)]">
        Administra tus claves en{' '}
        <Link href="/configuracion" className="text-blue-700 hover:underline">Configuración</Link>
      </div>
    </div>
  )
}
