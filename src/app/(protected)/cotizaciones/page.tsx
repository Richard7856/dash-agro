'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, todayISO, generateNumeroPedido, formatMxn } from '@/lib/format'
import { FormField, Input, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { FotoUploader } from '@/components/ui/FotoUploader'
import { useAuth } from '@/lib/auth-context'
import type {
  Tienda,
  PedidoRonda,
  PedidoRondaStatus,
  ConsolidadoItem,
  ConsolidadoPrecio,
  PedidoCliente,
} from '@/lib/types/database.types'

type View = 'list' | 'form' | 'wizard'

interface ParsedRow { producto: string; cantidad: number; precio_min: number | null; precio_max: number | null }
interface UploadedFile { clienteNombre: string; fileName: string; rows: ParsedRow[] }

// ─── status helpers ─────────────────────────────────────────────────────────

const STATUS_LABELS: Record<PedidoRondaStatus, string> = {
  pedidos: 'Pedidos', consolidado: 'Consolidado', cotizando: 'Cotizando',
  asignado: 'Asignado', comprando: 'Comprando', separando: 'Separando', completado: 'Completado',
}
const STATUS_COLORS: Record<PedidoRondaStatus, string> = {
  pedidos: 'bg-amber-50 text-amber-700', consolidado: 'bg-blue-50 text-blue-700',
  cotizando: 'bg-purple-50 text-purple-700', asignado: 'bg-cyan-50 text-cyan-700',
  comprando: 'bg-orange-50 text-orange-700', separando: 'bg-pink-50 text-pink-700',
  completado: 'bg-green-50 text-green-700',
}
const STEP_FOR_STATUS: Record<PedidoRondaStatus, number> = {
  pedidos: 1, consolidado: 2, cotizando: 3, asignado: 4, comprando: 5, separando: 6, completado: 6,
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function CotizacionesPage() {
  const { isAdmin } = useAuth()

  /* list */
  const [rondas, setRondas] = useState<(PedidoRonda & { _clienteCount: number; _itemCount: number })[]>([])
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')

  /* form (crear ronda) */
  const [formNombre, setFormNombre] = useState('')
  const [formFecha, setFormFecha] = useState(todayISO())
  const [formNotas, setFormNotas] = useState('')
  const [uploads, setUploads] = useState<UploadedFile[]>([])
  const [uploadingIdx, setUploadingIdx] = useState(-1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  /* wizard */
  const [wizRonda, setWizRonda] = useState<PedidoRonda | null>(null)
  const [wizStep, setWizStep] = useState(1)
  const [wizClientes, setWizClientes] = useState<PedidoCliente[]>([])
  const [wizConsolidado, setWizConsolidado] = useState<ConsolidadoItem[]>([])
  const [wizPrecios, setWizPrecios] = useState<Map<string, number>>(new Map())
  const [wizAsignacion, setWizAsignacion] = useState<Map<string, string>>(new Map()) // consolidadoItemId → tiendaId
  const [wizCompras, setWizCompras] = useState<Map<string, number>>(new Map()) // "consolidadoId|tiendaId" → qty
  const [wizFotos, setWizFotos] = useState<string[]>([])
  const [wizSaving, setWizSaving] = useState(false)

  // ─── data loading ─────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    const [{ data: rondasData }, { data: tiendasData }] = await Promise.all([
      supabase
        .from('pedido_rondas')
        .select('*, pedido_clientes(id, pedido_items(id))')
        .order('fecha', { ascending: false })
        .limit(200),
      supabase.from('tiendas').select('*').eq('activo', true).order('nombre'),
    ])
    const mapped = (rondasData ?? []).map((r) => {
      const clientes = Array.isArray(r.pedido_clientes) ? r.pedido_clientes : []
      const itemCount = clientes.reduce((sum: number, c: { pedido_items?: unknown[] }) =>
        sum + (Array.isArray(c.pedido_items) ? c.pedido_items.length : 0), 0)
      return { ...r, pedido_clientes: undefined, _clienteCount: clientes.length, _itemCount: itemCount }
    }) as (PedidoRonda & { _clienteCount: number; _itemCount: number })[]
    setRondas(mapped)
    setTiendas((tiendasData ?? []) as Tienda[])
    setLoading(false)
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // ─── form helpers ─────────────────────────────────────────────────────────

  function openNew() {
    setFormNombre(generateNumeroPedido())
    setFormFecha(todayISO())
    setFormNotas('')
    setUploads([])
    setError('')
    setView('form')
  }

  async function handleFileUpload(idx: number, file: File) {
    setUploadingIdx(idx)
    const fd = new FormData()
    fd.append('file', file)
    const res = await fetch('/api/v1/cotizaciones/upload', { method: 'POST', body: fd })
    const json = await res.json()
    setUploadingIdx(-1)
    if (!res.ok) { setError(json.error); return }
    setUploads((prev) => {
      const next = [...prev]
      next[idx] = { ...next[idx], fileName: file.name, rows: json.data }
      return next
    })
  }

  function addUploadSlot() {
    setUploads((prev) => [...prev, { clienteNombre: '', fileName: '', rows: [] }])
  }

  function removeUploadSlot(idx: number) {
    setUploads((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleSaveRonda(e: React.FormEvent) {
    e.preventDefault()
    if (!formFecha) { setError('Fecha requerida'); return }
    if (uploads.length === 0 || uploads.some((u) => !u.clienteNombre.trim())) {
      setError('Agrega al menos un pedido con nombre de cliente'); return
    }
    if (uploads.some((u) => u.rows.length === 0)) {
      setError('Todos los pedidos deben tener archivo Excel cargado'); return
    }
    setSaving(true); setError('')

    // Create ronda
    const { data: ronda, error: rErr } = await supabase
      .from('pedido_rondas')
      .insert({ nombre: formNombre || null, fecha: formFecha, notas: formNotas || null, status: 'pedidos' })
      .select().single()
    if (rErr || !ronda) { setError(rErr?.message ?? 'Error'); setSaving(false); return }

    // Create clientes + items
    for (const u of uploads) {
      const { data: cliente, error: cErr } = await supabase
        .from('pedido_clientes')
        .insert({ ronda_id: ronda.id, cliente_nombre: u.clienteNombre.trim(), archivo_nombre: u.fileName || null })
        .select().single()
      if (cErr || !cliente) { setError(cErr?.message ?? 'Error'); setSaving(false); return }

      const items = u.rows.map((r) => ({
        pedido_cliente_id: cliente.id,
        ronda_id: ronda.id,
        nombre_producto: r.producto,
        cantidad: r.cantidad,
        precio_min: r.precio_min,
        precio_max: r.precio_max,
      }))
      const { error: iErr } = await supabase.from('pedido_items').insert(items)
      if (iErr) { setError(iErr.message); setSaving(false); return }
    }

    setSaving(false)
    setView('list')
    loadList()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta ronda?')) return
    await supabase.from('pedido_rondas').delete().eq('id', id)
    loadList()
  }

  // ─── wizard helpers ───────────────────────────────────────────────────────

  async function openWizard(ronda: PedidoRonda) {
    setWizRonda(ronda)
    setWizStep(STEP_FOR_STATUS[ronda.status])
    setWizFotos(ronda.fotos ?? [])
    setError('')

    // Load clientes
    const { data: clientes } = await supabase
      .from('pedido_clientes').select('*, pedido_items(*)').eq('ronda_id', ronda.id)
    setWizClientes((clientes ?? []) as PedidoCliente[])

    // Load consolidado + precios
    const { data: consolidado } = await supabase
      .from('consolidado_items').select('*, consolidado_precios(*, tiendas(nombre))')
      .eq('ronda_id', ronda.id).order('cantidad_total', { ascending: false })
    setWizConsolidado((consolidado ?? []) as ConsolidadoItem[])

    // Build price map
    const pMap = new Map<string, number>()
    for (const c of (consolidado ?? []) as ConsolidadoItem[]) {
      for (const p of c.consolidado_precios ?? []) {
        pMap.set(`${c.id}|${p.tienda_id}`, p.precio)
      }
    }
    setWizPrecios(pMap)

    // Load compras for assignment
    const { data: compras } = await supabase
      .from('compra_items').select('*').eq('ronda_id', ronda.id)
    const aMap = new Map<string, string>()
    const cMap = new Map<string, number>()
    for (const ci of compras ?? []) {
      aMap.set(ci.consolidado_item_id, ci.tienda_id)
      cMap.set(`${ci.consolidado_item_id}|${ci.tienda_id}`, ci.cantidad_comprada)
    }
    setWizAsignacion(aMap)
    setWizCompras(cMap)

    setView('wizard')
  }

  // ─── Step 2: Generate consolidado ─────────────────────────────────────────

  async function generateConsolidado() {
    if (!wizRonda) return
    setWizSaving(true)

    // Get all pedido_items for this ronda
    const { data: items } = await supabase
      .from('pedido_items').select('*').eq('ronda_id', wizRonda.id)

    if (!items || items.length === 0) { setError('No hay items'); setWizSaving(false); return }

    // Group by product name (case-insensitive)
    const grouped = new Map<string, { total: number; min: number | null; max: number | null }>()
    for (const item of items) {
      const key = item.nombre_producto.trim().toLowerCase()
      const existing = grouped.get(key) ?? { total: 0, min: null as number | null, max: null as number | null }
      existing.total += Number(item.cantidad)
      if (item.precio_min != null) existing.min = Math.min(existing.min ?? Infinity, Number(item.precio_min))
      if (item.precio_max != null) existing.max = Math.max(existing.max ?? 0, Number(item.precio_max))
      grouped.set(key, existing)
    }

    // Get original names (first occurrence)
    const nameMap = new Map<string, string>()
    for (const item of items) {
      const key = item.nombre_producto.trim().toLowerCase()
      if (!nameMap.has(key)) nameMap.set(key, item.nombre_producto.trim())
    }

    // Delete old consolidado
    await supabase.from('consolidado_items').delete().eq('ronda_id', wizRonda.id)

    // Cross with inventory and insert
    const inserts: Array<{
      ronda_id: string; nombre_producto: string; cantidad_total: number;
      cantidad_inventario: number; cantidad_neta: number;
      precio_min: number | null; precio_max: number | null;
      inventario_registro_id: string | null
    }> = []

    for (const [key, val] of Array.from(grouped.entries())) {
      const nombre = nameMap.get(key)!
      // Try to match inventory
      const { data: inv } = await supabase
        .from('inventario_registros')
        .select('id, cantidad')
        .ilike('nombre_producto', `%${nombre}%`)
        .limit(1)
        .maybeSingle()

      const stockQty = inv ? Number(inv.cantidad) : 0
      const neta = Math.max(0, val.total - stockQty)

      inserts.push({
        ronda_id: wizRonda.id,
        nombre_producto: nombre,
        cantidad_total: val.total,
        cantidad_inventario: stockQty,
        cantidad_neta: neta,
        precio_min: val.min === Infinity ? null : val.min,
        precio_max: val.max === 0 ? null : val.max,
        inventario_registro_id: inv?.id ?? null,
      })
    }

    const { error: cErr } = await supabase.from('consolidado_items').insert(inserts)
    if (cErr) { setError(cErr.message); setWizSaving(false); return }

    // Update status
    await supabase.from('pedido_rondas').update({ status: 'consolidado' }).eq('id', wizRonda.id)
    setWizRonda({ ...wizRonda, status: 'consolidado' })
    setWizStep(2)
    setWizSaving(false)

    // Reload consolidado
    const { data: fresh } = await supabase
      .from('consolidado_items').select('*, consolidado_precios(*, tiendas(nombre))')
      .eq('ronda_id', wizRonda.id).order('cantidad_total', { ascending: false })
    setWizConsolidado((fresh ?? []) as ConsolidadoItem[])
  }

  // ─── Step 3: Save prices ─────────────────────────────────────────────────

  async function savePrices() {
    if (!wizRonda) return
    setWizSaving(true)
    const upserts: { consolidado_item_id: string; tienda_id: string; precio: number }[] = []
    wizPrecios.forEach((precio, key) => {
      const [consolidado_item_id, tienda_id] = key.split('|')
      upserts.push({ consolidado_item_id, tienda_id, precio })
    })
    if (upserts.length > 0) {
      const { error: err } = await supabase
        .from('consolidado_precios')
        .upsert(upserts, { onConflict: 'consolidado_item_id,tienda_id' })
      if (err) { setError(err.message); setWizSaving(false); return }
    }
    // Save fotos
    await supabase.from('pedido_rondas').update({ status: 'cotizando', fotos: wizFotos }).eq('id', wizRonda.id)
    setWizRonda({ ...wizRonda, status: 'cotizando' })
    setWizSaving(false)
    setError('')
  }

  // ─── Step 4: Auto-assign best price ───────────────────────────────────────

  function autoAssign() {
    const aMap = new Map<string, string>()
    for (const item of wizConsolidado) {
      if (item.cantidad_neta <= 0) continue
      let bestTienda: string | null = null
      let bestPrice = Infinity
      for (const t of tiendas) {
        const p = wizPrecios.get(`${item.id}|${t.id}`)
        if (p !== undefined && p < bestPrice) {
          bestPrice = p
          bestTienda = t.id
        }
      }
      if (bestTienda) aMap.set(item.id, bestTienda)
    }
    setWizAsignacion(aMap)
  }

  async function saveAssignment() {
    if (!wizRonda) return
    setWizSaving(true)
    // Delete old compra_items
    await supabase.from('compra_items').delete().eq('ronda_id', wizRonda.id)
    // Insert assignments
    const inserts: { ronda_id: string; consolidado_item_id: string; tienda_id: string; cantidad_comprada: number; precio_comprado: number }[] = []
    wizAsignacion.forEach((tiendaId, consolidadoId) => {
      const item = wizConsolidado.find((c) => c.id === consolidadoId)
      const precio = wizPrecios.get(`${consolidadoId}|${tiendaId}`) ?? 0
      inserts.push({
        ronda_id: wizRonda.id,
        consolidado_item_id: consolidadoId,
        tienda_id: tiendaId,
        cantidad_comprada: 0, // starts at 0, cotizadora fills it
        precio_comprado: precio,
      })
    })
    if (inserts.length > 0) {
      const { error: err } = await supabase.from('compra_items').insert(inserts)
      if (err) { setError(err.message); setWizSaving(false); return }
    }
    await supabase.from('pedido_rondas').update({ status: 'asignado' }).eq('id', wizRonda.id)
    setWizRonda({ ...wizRonda, status: 'asignado' })
    setWizStep(4)
    setWizSaving(false)
  }

  // ─── Step 5: Save compras ─────────────────────────────────────────────────

  async function saveCompras() {
    if (!wizRonda) return
    setWizSaving(true)
    // Update each compra_item
    for (const [key, qty] of Array.from(wizCompras.entries())) {
      const [consolidadoId, tiendaId] = key.split('|')
      await supabase.from('compra_items')
        .update({ cantidad_comprada: qty })
        .eq('ronda_id', wizRonda.id)
        .eq('consolidado_item_id', consolidadoId)
        .eq('tienda_id', tiendaId)
    }
    await supabase.from('pedido_rondas').update({ status: 'comprando', fotos: wizFotos }).eq('id', wizRonda.id)
    setWizRonda({ ...wizRonda, status: 'comprando' })
    setWizSaving(false)
  }

  // ─── Step 6: Generate separación + remisión ───────────────────────────────

  async function generateSeparacion() {
    if (!wizRonda) return
    setWizSaving(true)

    // Get pedido_items grouped by cliente
    const { data: pItems } = await supabase
      .from('pedido_items').select('*').eq('ronda_id', wizRonda.id)
    // Build map: productName → [{clienteId, qty}]
    const demand = new Map<string, { clienteId: string; qty: number }[]>()
    for (const pi of pItems ?? []) {
      const key = pi.nombre_producto.trim().toLowerCase()
      const arr = demand.get(key) ?? []
      arr.push({ clienteId: pi.pedido_cliente_id, qty: Number(pi.cantidad) })
      demand.set(key, arr)
    }

    // Delete old
    await supabase.from('separacion_items').delete().eq('ronda_id', wizRonda.id)

    // For each consolidado item, distribute proportionally
    const inserts: { ronda_id: string; pedido_cliente_id: string; consolidado_item_id: string; cantidad: number }[] = []
    for (const ci of wizConsolidado) {
      const key = ci.nombre_producto.trim().toLowerCase()
      const demandArr = demand.get(key) ?? []
      const totalDemand = demandArr.reduce((s, d) => s + d.qty, 0)
      // Get total comprado for this item
      let totalComprado = 0
      wizCompras.forEach((qty, k) => {
        if (k.startsWith(ci.id + '|')) totalComprado += qty
      })
      if (totalDemand === 0 || totalComprado === 0) continue

      for (const d of demandArr) {
        const proportion = d.qty / totalDemand
        const assigned = Math.round(totalComprado * proportion * 1000) / 1000
        inserts.push({
          ronda_id: wizRonda.id,
          pedido_cliente_id: d.clienteId,
          consolidado_item_id: ci.id,
          cantidad: assigned,
        })
      }
    }

    if (inserts.length > 0) {
      await supabase.from('separacion_items').insert(inserts)
    }

    await supabase.from('pedido_rondas').update({ status: 'completado' }).eq('id', wizRonda.id)
    setWizRonda({ ...wizRonda, status: 'completado' })
    setWizStep(6)
    setWizSaving(false)
  }

  // ─── best price helper ────────────────────────────────────────────────────

  function bestTiendaFor(consolidadoId: string): string | null {
    let min = Infinity; let best: string | null = null
    for (const t of tiendas) {
      const p = wizPrecios.get(`${consolidadoId}|${t.id}`)
      if (p !== undefined && p < min) { min = p; best = t.id }
    }
    return best
  }

  // ─── render ───────────────────────────────────────────────────────────────

  if (loading) return <Spinner fullPage />

  // ═══ WIZARD VIEW ══════════════════════════════════════════════════════════
  if (view === 'wizard' && wizRonda) {
    const stepTitles = ['Pedidos', 'Consolidado', 'Cotización', 'Asignación', 'Compras', 'Separación']

    return (
      <div className="max-w-4xl mx-auto px-4 py-5">
        <FormHeader title={wizRonda.nombre ?? 'Ronda'} onBack={() => { setView('list'); setError(''); loadList() }} />

        {/* Step indicators */}
        <div className="flex gap-1 mb-4 overflow-x-auto">
          {stepTitles.map((t, i) => (
            <button key={i} onClick={() => setWizStep(i + 1)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                wizStep === i + 1 ? 'bg-blue-600 text-white' :
                STEP_FOR_STATUS[wizRonda.status] > i ? 'bg-blue-50 text-blue-700' :
                'bg-gray-100 text-gray-400'
              }`}>
              {i + 1}. {t}
            </button>
          ))}
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* ── STEP 1: Pedidos ── */}
        {wizStep === 1 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Pedidos de clientes</h3>
            {wizClientes.length === 0 ? (
              <p className="text-sm text-gray-400 italic">Sin pedidos cargados</p>
            ) : (
              <div className="flex flex-col gap-3">
                {wizClientes.map((c) => (
                  <div key={c.id} className="nm-card p-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-sm">{c.cliente_nombre}</p>
                      <span className="text-xs text-gray-400">{c.archivo_nombre}</span>
                    </div>
                    <p className="text-xs text-gray-500">
                      {(c.pedido_items ?? []).length} productos
                    </p>
                  </div>
                ))}
              </div>
            )}
            {isAdmin && wizRonda.status === 'pedidos' && (
              <Btn onClick={generateConsolidado} loading={wizSaving} className="w-full mt-4">
                Generar consolidado
              </Btn>
            )}
          </div>
        )}

        {/* ── STEP 2: Consolidado ── */}
        {wizStep === 2 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">
              Consolidado — {wizConsolidado.length} productos ({wizConsolidado.filter(c => c.cantidad_neta > 0).length} a comprar)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold border-b">Producto</th>
                    <th className="text-right px-3 py-2 font-semibold border-b">Total</th>
                    <th className="text-right px-3 py-2 font-semibold border-b text-blue-600">Stock</th>
                    <th className="text-right px-3 py-2 font-semibold border-b text-amber-700">Neto</th>
                    <th className="text-right px-3 py-2 font-semibold border-b">Min</th>
                    <th className="text-right px-3 py-2 font-semibold border-b">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {wizConsolidado.map((c) => (
                    <tr key={c.id} className={`border-b border-gray-100 ${c.cantidad_neta <= 0 ? 'opacity-40' : ''}`}>
                      <td className="px-3 py-2 font-medium">{c.nombre_producto}</td>
                      <td className="px-3 py-2 text-right">{c.cantidad_total}</td>
                      <td className="px-3 py-2 text-right text-blue-600">{c.cantidad_inventario}</td>
                      <td className="px-3 py-2 text-right font-semibold text-amber-700">{c.cantidad_neta}</td>
                      <td className="px-3 py-2 text-right text-xs">{c.precio_min != null ? formatMxn(c.precio_min) : '—'}</td>
                      <td className="px-3 py-2 text-right text-xs">{c.precio_max != null ? formatMxn(c.precio_max) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {isAdmin && (
              <Btn onClick={async () => {
                await supabase.from('pedido_rondas').update({ status: 'cotizando' }).eq('id', wizRonda.id)
                setWizRonda({ ...wizRonda, status: 'cotizando' })
                setWizStep(3)
              }} className="w-full mt-4">
                Enviar a cotizar
              </Btn>
            )}
          </div>
        )}

        {/* ── STEP 3: Cotización (prices matrix) ── */}
        {wizStep === 3 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Cotización — Precios por tienda</h3>

            <FotoUploader fotos={wizFotos} onChange={setWizFotos} tabla="cotizaciones" maxFotos={10} />

            <div className="flex flex-wrap gap-2 my-3 text-[10px] text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-300" /> Mejor</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-300" /> Fuera de rango</span>
            </div>

            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="text-left px-3 py-2 font-semibold border-b sticky left-0 bg-gray-50 z-10 min-w-[160px]">Producto</th>
                    <th className="text-center px-3 py-2 font-semibold border-b min-w-[80px] text-amber-700">Rango</th>
                    {tiendas.map((t) => (
                      <th key={t.id} className="text-center px-3 py-2 font-semibold border-b min-w-[110px]">{t.nombre}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {wizConsolidado.filter(c => c.cantidad_neta > 0).map((item) => {
                    const best = bestTiendaFor(item.id)
                    return (
                      <tr key={item.id} className="border-b border-gray-100">
                        <td className="px-3 py-2 font-medium sticky left-0 bg-white z-10">{item.nombre_producto}</td>
                        <td className="px-2 py-1.5 text-center text-xs text-amber-700">
                          {item.precio_min != null || item.precio_max != null
                            ? `${item.precio_min ?? '?'}-${item.precio_max ?? '?'}`
                            : '—'}
                        </td>
                        {tiendas.map((t) => {
                          const val = wizPrecios.get(`${item.id}|${t.id}`)
                          const isBest = best === t.id && val !== undefined
                          const outOfRange = val !== undefined && (
                            (item.precio_max != null && val > item.precio_max) ||
                            (item.precio_min != null && val < item.precio_min)
                          )
                          return (
                            <td key={t.id} className="px-2 py-1.5">
                              <input type="number" step="0.01" min="0" placeholder="—"
                                value={val ?? ''}
                                onChange={(e) => {
                                  const num = parseFloat(e.target.value)
                                  setWizPrecios((prev) => {
                                    const next = new Map(prev)
                                    if (isNaN(num) || e.target.value === '') next.delete(`${item.id}|${t.id}`)
                                    else next.set(`${item.id}|${t.id}`, num)
                                    return next
                                  })
                                }}
                                className={`w-full text-center px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                  isBest ? 'bg-blue-50 border-blue-300 font-semibold text-blue-700' :
                                  outOfRange ? 'bg-red-50 border-red-300 text-red-600' :
                                  'border-gray-200'
                                }`}
                              />
                            </td>
                          )
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden flex flex-col gap-3 mb-4">
              {wizConsolidado.filter(c => c.cantidad_neta > 0).map((item) => {
                const best = bestTiendaFor(item.id)
                return (
                  <div key={item.id} className="nm-card p-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-sm">{item.nombre_producto}</h3>
                      {(item.precio_min != null || item.precio_max != null) && (
                        <span className="text-xs text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                          {item.precio_min ?? '?'}-{item.precio_max ?? '?'}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {tiendas.map((t) => {
                        const val = wizPrecios.get(`${item.id}|${t.id}`)
                        const isBest = best === t.id && val !== undefined
                        const outOfRange = val !== undefined && (
                          (item.precio_max != null && val > item.precio_max) ||
                          (item.precio_min != null && val < item.precio_min)
                        )
                        return (
                          <div key={t.id}>
                            <label className="text-xs text-gray-500 mb-1 block">{t.nombre}</label>
                            <input type="number" step="0.01" min="0" placeholder="$"
                              value={val ?? ''}
                              onChange={(e) => {
                                const num = parseFloat(e.target.value)
                                setWizPrecios((prev) => {
                                  const next = new Map(prev)
                                  if (isNaN(num) || e.target.value === '') next.delete(`${item.id}|${t.id}`)
                                  else next.set(`${item.id}|${t.id}`, num)
                                  return next
                                })
                              }}
                              className={`w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                                isBest ? 'bg-blue-50 border-blue-300 font-semibold text-blue-700' :
                                outOfRange ? 'bg-red-50 border-red-300 text-red-600' :
                                'border-gray-200'
                              }`}
                            />
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>

            <Btn onClick={savePrices} loading={wizSaving} className="w-full">Guardar precios</Btn>
          </div>
        )}

        {/* ── STEP 4: Asignación ── */}
        {wizStep === 4 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Asignación de compras</h3>
            {wizAsignacion.size === 0 && (
              <Btn onClick={() => { autoAssign(); }} variant="secondary" className="w-full mb-4">
                Auto-asignar mejores precios
              </Btn>
            )}
            <div className="flex flex-col gap-2 mb-4">
              {wizConsolidado.filter(c => c.cantidad_neta > 0).map((item) => {
                const assigned = wizAsignacion.get(item.id)
                const assignedTienda = tiendas.find(t => t.id === assigned)
                const precio = assigned ? wizPrecios.get(`${item.id}|${assigned}`) : undefined
                const outOfRange = precio !== undefined && item.precio_max != null && precio > item.precio_max

                return (
                  <div key={item.id} className={`nm-card p-3 flex items-center gap-3 ${outOfRange ? 'border-red-200 bg-red-50/30' : ''}`}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.nombre_producto}</p>
                      <p className="text-xs text-gray-500">{item.cantidad_neta} uds</p>
                    </div>
                    <select
                      value={assigned ?? ''}
                      onChange={(e) => {
                        setWizAsignacion((prev) => {
                          const next = new Map(prev)
                          if (e.target.value) next.set(item.id, e.target.value)
                          else next.delete(item.id)
                          return next
                        })
                      }}
                      className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white min-w-[120px]"
                    >
                      <option value="">Sin asignar</option>
                      {tiendas.map((t) => {
                        const p = wizPrecios.get(`${item.id}|${t.id}`)
                        return (
                          <option key={t.id} value={t.id}>
                            {t.nombre} {p !== undefined ? `(${formatMxn(p)})` : ''}
                          </option>
                        )
                      })}
                    </select>
                    {precio !== undefined && (
                      <span className={`text-xs font-semibold ${outOfRange ? 'text-red-600' : 'text-blue-600'}`}>
                        {formatMxn(precio)}
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
            {isAdmin && (
              <Btn onClick={saveAssignment} loading={wizSaving} className="w-full">
                Confirmar asignación
              </Btn>
            )}
          </div>
        )}

        {/* ── STEP 5: Compras ── */}
        {wizStep === 5 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Registro de compras</h3>
            <FotoUploader fotos={wizFotos} onChange={setWizFotos} tabla="cotizaciones" maxFotos={20} />

            <div className="flex flex-col gap-2 mt-3 mb-4">
              {wizConsolidado.filter(c => c.cantidad_neta > 0).map((item) => {
                const assigned = wizAsignacion.get(item.id)
                const assignedTienda = tiendas.find(t => t.id === assigned)
                const comprado = assigned ? (wizCompras.get(`${item.id}|${assigned}`) ?? 0) : 0

                return (
                  <div key={item.id} className="nm-card p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-sm font-medium">{item.nombre_producto}</p>
                      <span className="text-xs text-gray-400">{assignedTienda?.nombre ?? '—'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">Necesario: {item.cantidad_neta}</span>
                      <input
                        type="number" step="0.01" min="0"
                        placeholder="Comprado"
                        value={comprado || ''}
                        onChange={(e) => {
                          const num = parseFloat(e.target.value)
                          if (!assigned) return
                          setWizCompras((prev) => {
                            const next = new Map(prev)
                            if (isNaN(num) || e.target.value === '') next.delete(`${item.id}|${assigned}`)
                            else next.set(`${item.id}|${assigned}`, num)
                            return next
                          })
                        }}
                        className={`flex-1 px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                          comprado > 0 && comprado < item.cantidad_neta ? 'border-amber-300 bg-amber-50' :
                          comprado >= item.cantidad_neta ? 'border-blue-300 bg-blue-50' :
                          'border-gray-200'
                        }`}
                      />
                    </div>
                    {comprado > 0 && comprado < item.cantidad_neta && (
                      <p className="text-xs text-amber-600 mt-1">
                        Faltan {(item.cantidad_neta - comprado).toFixed(1)} — se buscará en 2da tienda
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
            <Btn onClick={saveCompras} loading={wizSaving} className="w-full">
              Guardar compras
            </Btn>
          </div>
        )}

        {/* ── STEP 6: Separación ── */}
        {wizStep === 6 && (
          <div>
            <h3 className="font-semibold text-sm mb-3">Separación por cliente</h3>
            {wizRonda.status !== 'completado' ? (
              <Btn onClick={generateSeparacion} loading={wizSaving} className="w-full mb-4">
                Generar separación
              </Btn>
            ) : (
              <div className="flex flex-col gap-3">
                {wizClientes.map((c) => (
                  <div key={c.id} className="nm-card p-4">
                    <h4 className="font-semibold text-sm mb-2">{c.cliente_nombre}</h4>
                    <p className="text-xs text-gray-500">Productos asignados proporcionalmente</p>
                  </div>
                ))}
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-800 text-center">
                  Ronda completada
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ═══ FORM VIEW (crear ronda + subir Excels) ═══════════════════════════════
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title="Nueva ronda de pedidos" onBack={() => { setView('list'); setError('') }} />
        <form onSubmit={handleSaveRonda} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombre / Folio">
              <Input type="text" value={formNombre} onChange={(e) => setFormNombre(e.target.value)} placeholder="PED-..." />
            </FormField>
            <FormField label="Fecha" required>
              <Input type="date" value={formFecha} onChange={(e) => setFormFecha(e.target.value)} required />
            </FormField>
          </div>

          <FormField label="Notas">
            <Textarea value={formNotas} onChange={(e) => setFormNotas(e.target.value)} placeholder="Opcional" />
          </FormField>

          {/* Upload slots */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Pedidos de clientes ({uploads.length})</label>
              <button type="button" onClick={addUploadSlot} className="text-xs text-blue-600 font-medium hover:text-blue-700">
                + Agregar pedido
              </button>
            </div>

            {uploads.length === 0 && (
              <button type="button" onClick={addUploadSlot}
                className="w-full py-8 border-2 border-dashed border-gray-200 rounded-xl text-sm text-gray-400 hover:border-blue-300 hover:text-blue-500 transition-colors">
                Agregar primer pedido de cliente
              </button>
            )}

            {uploads.map((u, idx) => (
              <div key={idx} className="nm-card p-4 mb-3">
                <div className="flex items-center gap-2 mb-3">
                  <input
                    type="text" placeholder="Nombre del cliente..."
                    value={u.clienteNombre}
                    onChange={(e) => {
                      setUploads((prev) => {
                        const next = [...prev]
                        next[idx] = { ...next[idx], clienteNombre: e.target.value }
                        return next
                      })
                    }}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  />
                  <button type="button" onClick={() => removeUploadSlot(idx)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
                </div>

                {u.rows.length > 0 ? (
                  <div>
                    <p className="text-xs text-blue-600 font-medium mb-2">{u.fileName} — {u.rows.length} productos</p>
                    <div className="max-h-40 overflow-y-auto text-xs">
                      <table className="w-full">
                        <thead><tr className="bg-gray-50"><th className="text-left px-2 py-1">Producto</th><th className="text-right px-2 py-1">Cant</th><th className="text-right px-2 py-1">Min</th><th className="text-right px-2 py-1">Max</th></tr></thead>
                        <tbody>
                          {u.rows.slice(0, 15).map((r, i) => (
                            <tr key={i} className="border-t border-gray-100">
                              <td className="px-2 py-1">{r.producto}</td>
                              <td className="px-2 py-1 text-right">{r.cantidad}</td>
                              <td className="px-2 py-1 text-right">{r.precio_min ?? '—'}</td>
                              <td className="px-2 py-1 text-right">{r.precio_max ?? '—'}</td>
                            </tr>
                          ))}
                          {u.rows.length > 15 && <tr><td colSpan={4} className="px-2 py-1 text-gray-400 text-center">...y {u.rows.length - 15} más</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  <label className="block cursor-pointer">
                    <div className={`py-6 border-2 border-dashed rounded-xl text-center text-sm transition-colors ${uploadingIdx === idx ? 'border-blue-300 bg-blue-50 text-blue-600' : 'border-gray-200 text-gray-400 hover:border-blue-300'}`}>
                      {uploadingIdx === idx ? 'Procesando...' : 'Subir archivo Excel (.xlsx)'}
                    </div>
                    <input type="file" accept=".xlsx,.xls" className="hidden"
                      onChange={(e) => { if (e.target.files?.[0]) handleFileUpload(idx, e.target.files[0]) }} />
                  </label>
                )}
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <Btn type="button" variant="secondary" onClick={() => { setView('list'); setError('') }} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">Crear ronda</Btn>
          </div>
        </form>
      </div>
    )
  }

  // ═══ LIST VIEW ════════════════════════════════════════════════════════════
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Pedidos y Cotizaciones"
        subtitle={`${rondas.length} rondas`}
        action={isAdmin ? { label: 'Nueva ronda', onClick: openNew } : undefined}
      />

      {rondas.length === 0 ? (
        <EmptyState message="No hay rondas" action={isAdmin ? { label: 'Crear primera', onClick: openNew } : undefined} />
      ) : (
        <div className="flex flex-col gap-2">
          {rondas.map((r) => (
            <div key={r.id} className="nm-card overflow-hidden">
              <button type="button" onClick={() => openWizard(r)}
                className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{r.nombre ?? 'Sin nombre'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[r.status]}`}>
                        {STATUS_LABELS[r.status]}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(r.fecha)} &middot; {r._clienteCount} clientes &middot; {r._itemCount} productos
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              {isAdmin && (
                <div className="flex border-t border-[var(--nm-bg-inset)]">
                  <button onClick={() => handleDelete(r.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
                    Eliminar
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {isAdmin && (
        <button onClick={openNew}
          className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20">
          +
        </button>
      )}
    </div>
  )
}
