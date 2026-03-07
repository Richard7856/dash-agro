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
  method: 'GET' | 'POST'
  path: string
  description: string
  params?: EndpointParam[]
  body?: EndpointParam[]
  exampleResponse: object
}

const endpoints: Endpoint[] = [
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
]

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false)
  function copy() {
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} className={`text-xs px-2 py-1 rounded font-medium transition-colors ${copied ? 'bg-green-700 text-green-100' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'}`}>
      {copied ? '✓ Copiado' : 'Copiar'}
    </button>
  )
}

function EndpointCard({ ep, baseUrl }: { ep: Endpoint; baseUrl: string }) {
  const [open, setOpen] = useState(false)

  const curlGet = ep.method === 'GET'
    ? `curl -H "X-API-Key: TU_CLAVE_AQUI" \\\n  "${baseUrl}${ep.path}${ep.params?.length ? '?limit=10' : ''}"`
    : `curl -X POST \\\n  -H "X-API-Key: TU_CLAVE_AQUI" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(
        Object.fromEntries((ep.body ?? []).filter((b) => b.required).map((b) => [b.name, b.type === 'number' ? 0 : 'valor'])),
        null, 2
      )}' \\\n  "${baseUrl}${ep.path}"`

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-gray-50 transition-colors"
      >
        <span className={`text-xs font-bold px-2 py-1 rounded font-mono w-14 text-center ${ep.method === 'GET' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
          {ep.method}
        </span>
        <span className="font-mono text-sm text-gray-800 font-medium flex-1">{ep.path}</span>
        <span className="text-xs text-gray-400 hidden sm:block">{ep.description}</span>
        <svg className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="border-t border-gray-100 p-4 flex flex-col gap-4">
          <p className="text-sm text-gray-600">{ep.description}</p>

          {ep.params && ep.params.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Query params</p>
              <div className="flex flex-col gap-1">
                {ep.params.map((p) => (
                  <div key={p.name} className="flex gap-2 text-sm">
                    <code className="text-blue-700 font-mono w-28 shrink-0">{p.name}</code>
                    <span className="text-gray-400 font-mono text-xs w-14 shrink-0">{p.type}</span>
                    <span className="text-gray-600">{p.description}</span>
                    {!p.required && <span className="text-gray-400 text-xs ml-auto shrink-0">opcional</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {ep.body && ep.body.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Body JSON</p>
              <div className="flex flex-col gap-1">
                {ep.body.map((p) => (
                  <div key={p.name} className="flex gap-2 text-sm">
                    <code className="text-green-700 font-mono w-36 shrink-0">{p.name}</code>
                    <span className="text-gray-400 font-mono text-xs w-14 shrink-0">{p.type}</span>
                    <span className="text-gray-600 flex-1">{p.description}</span>
                    {p.required
                      ? <span className="text-red-500 text-xs shrink-0">requerido</span>
                      : <span className="text-gray-400 text-xs shrink-0">opcional</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Ejemplo curl</p>
              <CopyButton text={curlGet} />
            </div>
            <pre className="bg-gray-900 text-gray-100 rounded-xl p-3 text-xs overflow-x-auto whitespace-pre-wrap break-all">{curlGet}</pre>
          </div>

          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Respuesta ejemplo</p>
            <pre className="bg-gray-50 border border-gray-200 rounded-xl p-3 text-xs overflow-x-auto">
              {JSON.stringify(ep.exampleResponse, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function ApiDocsPage() {
  const [baseUrl, setBaseUrl] = useState('https://tu-dominio.vercel.app')

  useEffect(() => {
    setBaseUrl(window.location.origin)
  }, [])

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-gray-900">Documentación API</h1>
        <p className="text-sm text-gray-500 mt-0.5">REST API v1 — Agrodelicias</p>
      </div>

      {/* Autenticación */}
      <section className="mb-6 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-3">Autenticación</h2>
        <p className="text-sm text-gray-600 mb-3">
          Todos los endpoints requieren el header <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-xs">X-API-Key</code> con una clave activa.
          Genera y administra tus claves en{' '}
          <Link href="/configuracion" className="text-green-700 hover:underline font-medium">Configuración</Link>.
        </p>
        <div className="flex items-center gap-2">
          <pre className="flex-1 bg-gray-900 text-green-400 rounded-xl p-3 text-xs overflow-x-auto">
            {`X-API-Key: agro_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`}
          </pre>
          <CopyButton text="X-API-Key: agro_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx" />
        </div>
      </section>

      {/* Base URL */}
      <section className="mb-6 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-2">URL base</h2>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-gray-100 rounded-xl px-3 py-2 text-sm font-mono text-gray-800 break-all">
            {baseUrl}/api/v1
          </code>
          <CopyButton text={`${baseUrl}/api/v1`} />
        </div>
      </section>

      {/* Respuesta estándar */}
      <section className="mb-6 bg-white rounded-xl border border-gray-200 p-5">
        <h2 className="font-semibold text-gray-900 mb-2">Formato de respuesta</h2>
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
        <div className="mt-3 flex gap-4 text-xs text-gray-500">
          <span><span className="font-mono text-green-700">200</span> — OK (GET)</span>
          <span><span className="font-mono text-green-700">201</span> — Creado (POST)</span>
          <span><span className="font-mono text-red-600">401</span> — API key inválida</span>
          <span><span className="font-mono text-red-600">400</span> — Error de validación</span>
        </div>
      </section>

      {/* Resumen tabla */}
      <section className="mb-4">
        <h2 className="font-semibold text-gray-900 mb-3">Endpoints disponibles</h2>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2 text-xs font-semibold text-gray-500 uppercase">Endpoint</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-center">GET</th>
                <th className="px-3 py-2 text-xs font-semibold text-gray-500 uppercase text-center">POST</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {['/api/v1/inventario', '/api/v1/compras', '/api/v1/ventas', '/api/v1/gastos'].map((path) => (
                <tr key={path} className="hover:bg-gray-50">
                  <td className="px-4 py-2 font-mono text-xs text-gray-700">{path}</td>
                  <td className="px-3 py-2 text-center text-green-600">✓</td>
                  <td className="px-3 py-2 text-center text-green-600">✓</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Detalle de endpoints */}
      <div className="flex flex-col gap-3">
        {endpoints.map((ep) => (
          <EndpointCard key={`${ep.method}-${ep.path}`} ep={ep} baseUrl={baseUrl} />
        ))}
      </div>

      <div className="mt-8 text-center text-xs text-gray-400">
        Administra tus claves en{' '}
        <Link href="/configuracion" className="text-green-700 hover:underline">Configuración</Link>
      </div>
    </div>
  )
}
