'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO, generateNumeroCompra, formatFormaPago } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { FORMAS_PAGO } from '@/lib/constants'
import type { Compra, Persona, Proveedor, Ubicacion, FormaPago, StatusPago, InventarioRegistro, UnidadMedida } from '@/lib/types/database.types'
import { FotoUploader } from '@/components/ui/FotoUploader'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { logActivity } from '@/lib/activity-log'

// Item local (en el formulario, antes de guardar)
interface CompraItemLocal {
  inventario_registro_id: string
  nombre: string
  unidad: UnidadMedida
  stock_actual: number
  precio_compra_actual: number
  lote: string | null
  cantidad: string
  precio_unitario: string
}

const emptyForm = () => ({
  numero_compra: generateNumeroCompra(),
  fecha: todayISO(),
  descripcion: '',
  ubicacion_id: '',
  proveedor_id: '',
  forma_pago: 'efectivo' as FormaPago,
  monto_efectivo: '',
  monto_bonos: '',
  monto_otro: '',
  gastos: '',
  costo_flete: '',
  costo_otros: '',
  notas: '',
  status_pago: 'pagado' as StatusPago,
  fecha_vencimiento: '',
})

export default function ComprasPage() {
  const [compras, setCompras] = useState<Compra[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formFotos, setFormFotos] = useState<string[]>([])

  // Items de inventario para esta compra
  const [items, setItems] = useState<CompraItemLocal[]>([])
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [productosResultados, setProductosResultados] = useState<InventarioRegistro[]>([])
  const [buscandoProducto, setBuscandoProducto] = useState(false)

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroPago, setFiltroPago] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: comprasData }, { data: personasData }, { data: proveedoresData }, { data: ubicData }] = await Promise.all([
      supabase
        .from('compras')
        .select('*, proveedores(nombre), personas(nombre), ubicaciones(nombre), compras_items(*, inventario_registros(nombre_producto, unidad_medida))')
        .order('fecha', { ascending: false })
        .limit(500),
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre'),
    ])
    setCompras((comprasData ?? []) as Compra[])
    setPersonas(personasData ?? [])
    setProveedores((proveedoresData ?? []) as Proveedor[])
    setUbicaciones(ubicData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Buscar productos en inventario (debounced)
  useEffect(() => {
    if (!busquedaProducto.trim()) { setProductosResultados([]); return }
    const t = setTimeout(async () => {
      setBuscandoProducto(true)
      const term = `%${busquedaProducto.trim()}%`
      const { data } = await supabase
        .from('inventario_registros')
        .select('*')
        .or(`nombre_producto.ilike.${term},ean.ilike.${term},sku.ilike.${term}`)
        .order('nombre_producto')
        .limit(10)
      setProductosResultados((data ?? []) as InventarioRegistro[])
      setBuscandoProducto(false)
    }, 300)
    return () => clearTimeout(t)
  }, [busquedaProducto])

  // Auto-total desde items
  const montoCalculado = items.reduce((s, i) => {
    const c = parseFloat(i.cantidad) || 0
    const p = parseFloat(i.precio_unitario) || 0
    return s + c * p
  }, 0)

  const tieneItems = items.length > 0

  // Filtrado en cliente
  const comprasFiltradas = useMemo(() => {
    let result = compras
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter((c) =>
        c.numero_compra?.toLowerCase().includes(q) ||
        c.descripcion?.toLowerCase().includes(q) ||
        c.notas?.toLowerCase().includes(q) ||
        (c.proveedores as { nombre: string } | null)?.nombre?.toLowerCase().includes(q) ||
        (c.personas as { nombre: string } | null)?.nombre?.toLowerCase().includes(q)
      )
    }
    if (filtroDesde) result = result.filter((c) => c.fecha >= filtroDesde)
    if (filtroHasta) result = result.filter((c) => c.fecha <= filtroHasta)
    if (filtroPago) result = result.filter((c) => c.forma_pago === filtroPago)
    return result
  }, [compras, busqueda, filtroDesde, filtroHasta, filtroPago])

  const hayFiltros = busqueda || filtroDesde || filtroHasta || filtroPago

  function limpiarFiltros() {
    setBusqueda(''); setFiltroDesde(''); setFiltroHasta(''); setFiltroPago('')
  }

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setItems([])
    setFormFotos([])
    setBusquedaProducto('')
    setProductosResultados([])
    setError('')
    setView('form')
  }

  async function openEdit(c: Compra) {
    setEditId(c.id)
    setForm({
      numero_compra: c.numero_compra ?? '',
      fecha: c.fecha,
      descripcion: c.descripcion ?? '',
      ubicacion_id: c.ubicacion_id ?? '',
      proveedor_id: c.proveedor_id ?? '',
      forma_pago: c.forma_pago,
      monto_efectivo: c.monto_efectivo ? String(c.monto_efectivo) : '',
      monto_bonos: c.monto_bonos ? String(c.monto_bonos) : '',
      monto_otro: c.monto_otro ? String(c.monto_otro) : '',
      gastos: c.gastos != null ? String(c.gastos) : '',
      costo_flete: c.costo_flete > 0 ? String(c.costo_flete) : '',
      costo_otros: c.costo_otros > 0 ? String(c.costo_otros) : '',
      notas: c.notas ?? '',
      status_pago: c.status_pago,
      fecha_vencimiento: c.fecha_vencimiento ?? '',
    })

    // Cargar items existentes
    const { data: existingItems } = await supabase
      .from('compras_items')
      .select('*, inventario_registros(nombre_producto, unidad_medida, cantidad, precio_compra_unitario, ean, sku, numero_lote)')
      .eq('compra_id', c.id)

    const loaded: CompraItemLocal[] = (existingItems ?? []).map((it: any) => ({
      inventario_registro_id: it.inventario_registro_id,
      nombre: it.inventario_registros?.nombre_producto ?? '',
      unidad: it.inventario_registros?.unidad_medida ?? 'unidad',
      stock_actual: (it.inventario_registros?.cantidad ?? 0),
      precio_compra_actual: it.inventario_registros?.precio_compra_unitario ?? 0,
      lote: it.inventario_registros?.numero_lote ?? null,
      cantidad: String(it.cantidad),
      precio_unitario: String(it.precio_unitario),
    }))

    setItems(loaded)
    setFormFotos(c.fotos ?? [])
    setBusquedaProducto('')
    setProductosResultados([])
    setError('')
    setView('form')
  }

  function agregarProducto(p: InventarioRegistro) {
    if (items.some((i) => i.inventario_registro_id === p.id)) return
    setItems((prev) => [...prev, {
      inventario_registro_id: p.id,
      nombre: p.nombre_producto,
      unidad: p.unidad_medida,
      stock_actual: p.cantidad,
      precio_compra_actual: p.precio_compra_unitario,
      lote: p.numero_lote ?? null,
      cantidad: '1',
      precio_unitario: String(p.precio_compra_unitario || ''),
    }])
    setBusquedaProducto('')
    setProductosResultados([])
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta compra?')) return

    // Revertir incremento de inventario
    const { data: compraItems } = await supabase
      .from('compras_items')
      .select('inventario_registro_id, cantidad')
      .eq('compra_id', id)

    for (const item of compraItems ?? []) {
      const { data: inv } = await supabase
        .from('inventario_registros')
        .select('cantidad')
        .eq('id', item.inventario_registro_id)
        .single()
      if (inv) {
        await supabase
          .from('inventario_registros')
          .update({ cantidad: Math.max(0, inv.cantidad - item.cantidad) })
          .eq('id', item.inventario_registro_id)
      }
    }

    const { error: delErr } = await supabase.from('compras').delete().eq('id', id)
    if (delErr) { setError(`Error al eliminar: ${delErr.message}`); return }
    logActivity({ accion: 'eliminar', modulo: 'compras', detalle: `Compra eliminada`, registro_id: id })
    setCompras((cs) => cs.filter((c) => c.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    const montoFinal = tieneItems ? montoCalculado : 0
    if (!form.fecha) { setError('La fecha es requerida'); return }
    if (!tieneItems && montoFinal === 0) { setError('Agrega productos o un monto total'); return }
    setSaving(true)
    setError('')

    const payload = {
      numero_compra: form.numero_compra || generateNumeroCompra(),
      fecha: form.fecha,
      descripcion: form.descripcion || null,
      ubicacion_id: form.ubicacion_id || null,
      proveedor_id: form.proveedor_id || null,
      forma_pago: form.forma_pago,
      monto_total: montoFinal,
      monto_efectivo: form.forma_pago === 'mixto' ? (parseFloat(form.monto_efectivo) || 0) : 0,
      monto_bonos: form.forma_pago === 'mixto' ? (parseFloat(form.monto_bonos) || 0) : 0,
      monto_otro: form.forma_pago === 'mixto' ? (parseFloat(form.monto_otro) || 0) : 0,
      gastos: form.gastos ? parseFloat(form.gastos) : 0,
      costo_flete: parseFloat(form.costo_flete) || 0,
      costo_otros: parseFloat(form.costo_otros) || 0,
      notas: form.notas || null,
      status_pago: form.status_pago,
      fecha_vencimiento: form.fecha_vencimiento || null,
      fotos: formFotos,
    }

    if (editId) {
      // Revertir items anteriores (decrementar lo que se había incrementado)
      const { data: oldItems } = await supabase
        .from('compras_items')
        .select('inventario_registro_id, cantidad')
        .eq('compra_id', editId)

      for (const old of oldItems ?? []) {
        const { data: inv } = await supabase
          .from('inventario_registros').select('cantidad').eq('id', old.inventario_registro_id).single()
        if (inv) {
          await supabase.from('inventario_registros')
            .update({ cantidad: Math.max(0, inv.cantidad - old.cantidad) })
            .eq('id', old.inventario_registro_id)
        }
      }

      const { error: updErr } = await supabase.from('compras').update(payload).eq('id', editId)
      if (updErr) { setError(`Error: ${updErr.message}`); setSaving(false); return }

      await supabase.from('compras_items').delete().eq('compra_id', editId)
    } else {
      const { data: inserted, error: insErr } = await supabase.from('compras').insert(payload).select('id').single()
      if (insErr || !inserted) { setError(`Error: ${insErr?.message}`); setSaving(false); return }
      ;(payload as any)._id = inserted.id
    }

    const compraId = editId ?? (payload as any)._id
    if (!compraId) { setSaving(false); setView('list'); loadData(); return }

    // Insertar nuevos items + incrementar inventario
    for (const item of items) {
      const cant = parseFloat(item.cantidad) || 0
      const precio = parseFloat(item.precio_unitario) || 0
      if (cant <= 0) continue

      await supabase.from('compras_items').insert({
        compra_id: compraId,
        inventario_registro_id: item.inventario_registro_id,
        cantidad: cant,
        precio_unitario: precio,
      })

      const { data: inv } = await supabase
        .from('inventario_registros').select('cantidad').eq('id', item.inventario_registro_id).single()
      if (inv) {
        await supabase.from('inventario_registros')
          .update({ cantidad: inv.cantidad + cant })
          .eq('id', item.inventario_registro_id)
      }
    }

    logActivity({ accion: editId ? 'editar' : 'crear', modulo: 'compras', detalle: `${form.descripcion || 'Compra'} — $${montoFinal}` })

    setSaving(false)
    setView('list')
    loadData()
  }

  if (loading) return <Spinner fullPage />

  // ─── FORM ─────────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title={editId ? 'Editar compra' : 'Nueva compra'} onBack={() => setView('list')} />

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <FormField label="Folio">
            <Input
              type="text"
              value={form.numero_compra}
              onChange={(e) => setForm((f) => ({ ...f, numero_compra: e.target.value }))}
              placeholder="Auto-generado"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
            </FormField>
            <FormField label="Gastos extra (MXN)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.gastos}
                onChange={(e) => setForm((f) => ({ ...f, gastos: e.target.value }))}
              />
            </FormField>
          </div>

          {/* Productos de inventario */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <p className="text-sm font-semibold text-[var(--nm-text)] mb-2">Productos recibidos</p>

            {/* Buscador */}
            <div className="relative mb-2">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              <input
                type="text"
                placeholder="Buscar producto por nombre, EAN, SKU…"
                value={busquedaProducto}
                onChange={(e) => setBusquedaProducto(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-[var(--nm-text)] placeholder:text-[var(--nm-text-subtle)]"
              />
            </div>

            {buscandoProducto && <p className="text-xs text-[var(--nm-text-subtle)] px-1 mb-2">Buscando…</p>}
            {productosResultados.length > 0 && (
              <div className="border border-gray-200 rounded-lg overflow-hidden mb-2">
                {productosResultados.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => agregarProducto(p)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-blue-50 border-b last:border-b-0 border-gray-100 text-left"
                  >
                    <div>
                      <span className="font-medium text-[var(--nm-text)]">{p.nombre_producto}</span>
                      {p.numero_lote && <span className="text-xs text-[var(--nm-text-subtle)] ml-2">Lote: {p.numero_lote}</span>}
                    </div>
                    <span className="text-xs font-semibold text-[var(--nm-text-muted)] ml-2 shrink-0">
                      {p.cantidad} {p.unidad_medida}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {items.length > 0 && (
              <div className="flex flex-col gap-2 mb-2">
                {items.map((item, idx) => {
                  const cant = parseFloat(item.cantidad) || 0
                  const precio = parseFloat(item.precio_unitario) || 0
                  const subtotal = cant * precio
                  return (
                    <div key={item.inventario_registro_id} className="rounded-lg p-2 border border-blue-100 bg-blue-50 text-sm">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-[var(--nm-text)] truncate">{item.nombre}</p>
                          {item.lote && <p className="text-xs text-[var(--nm-text-subtle)]">Lote: {item.lote}</p>}
                          <p className="text-xs text-gray-400">Stock: {item.stock_actual} {item.unidad} · Costo actual: {formatMxn(item.precio_compra_actual)}</p>
                        </div>
                        <button type="button" onClick={() => removeItem(idx)} className="text-red-400 hover:text-red-600 shrink-0 mt-0.5">
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 mt-2">
                        <div>
                          <label className="text-xs text-[var(--nm-text-subtle)]">Cantidad ({item.unidad})</label>
                          <input
                            type="number" min="0.001" step="0.001"
                            value={item.cantidad}
                            onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, cantidad: e.target.value } : it))}
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-[var(--nm-text-subtle)]">Precio compra (MXN)</label>
                          <input
                            type="number" min="0" step="0.01" placeholder="0.00"
                            value={item.precio_unitario}
                            onChange={(e) => setItems((prev) => prev.map((it, i) => i === idx ? { ...it, precio_unitario: e.target.value } : it))}
                            className="w-full mt-0.5 px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:border-blue-500"
                          />
                        </div>
                      </div>
                      {subtotal > 0 && (
                        <p className="text-xs text-blue-700 font-semibold mt-1 text-right">{formatMxn(subtotal)}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {tieneItems && (
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-[var(--nm-text-subtle)]">{items.length} producto{items.length !== 1 ? 's' : ''}</span>
                <span className="text-sm font-bold text-blue-700">Total: {formatMxn(montoCalculado)}</span>
              </div>
            )}

            {items.length === 0 && !buscandoProducto && !busquedaProducto && (
              <p className="text-xs text-[var(--nm-text-subtle)] text-center py-2">Busca y selecciona los productos recibidos</p>
            )}
          </div>

          <FormField label="¿Qué se compró? (descripción)">
            <Input
              type="text"
              placeholder="Ej. Aguacate Hass 10 cajas"
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Forma de pago">
              <Select value={form.forma_pago} onChange={(e) => setForm((f) => ({ ...f, forma_pago: e.target.value as FormaPago }))}>
                {FORMAS_PAGO.map((fp) => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
              </Select>
            </FormField>
          </div>

          {form.forma_pago === 'mixto' && (
            <div className="border border-gray-200 rounded-xl p-3 bg-gray-50 flex flex-col gap-2">
              <p className="text-xs font-semibold text-[var(--nm-text-muted)]">Desglose de pago</p>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Efectivo</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="$0"
                    value={form.monto_efectivo}
                    onChange={(e) => setForm((f) => ({ ...f, monto_efectivo: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Bonos</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="$0"
                    value={form.monto_bonos}
                    onChange={(e) => setForm((f) => ({ ...f, monto_bonos: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="text-xs text-gray-500 mb-0.5 block">Otro</label>
                  <input
                    type="number" min="0" step="0.01" placeholder="$0"
                    value={form.monto_otro}
                    onChange={(e) => setForm((f) => ({ ...f, monto_otro: e.target.value }))}
                    className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <p className="text-xs text-right text-gray-500">
                Suma: {formatMxn((parseFloat(form.monto_efectivo) || 0) + (parseFloat(form.monto_bonos) || 0) + (parseFloat(form.monto_otro) || 0))}
              </p>
            </div>
          )}

          <FormField label="Proveedor">
            <SearchSelect
              options={proveedores.map((p) => ({ id: p.id, label: p.nombre }))}
              value={form.proveedor_id}
              onChange={(id) => setForm((f) => ({ ...f, proveedor_id: id }))}
              placeholder="Buscar proveedor…"
            />
          </FormField>

          <FormField label="Ubicación">
            <SearchSelect
              options={ubicaciones.map((u) => ({ id: u.id, label: u.nombre }))}
              value={form.ubicacion_id}
              onChange={(id) => setForm((f) => ({ ...f, ubicacion_id: id }))}
              placeholder="Buscar ubicación…"
              emptyLabel="— Ninguna —"
            />
          </FormField>

          {/* Costos adicionales (costo aterrizado) */}
          <div className="border border-blue-100 rounded-xl p-3 bg-blue-50/40">
            <p className="text-sm font-semibold text-blue-800 mb-2">Costos adicionales</p>
            <div className="grid grid-cols-2 gap-3">
              <FormField label="Flete / Envío">
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.costo_flete}
                  onChange={(e) => setForm((f) => ({ ...f, costo_flete: e.target.value }))}
                />
              </FormField>
              <FormField label="Otros costos">
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.costo_otros}
                  onChange={(e) => setForm((f) => ({ ...f, costo_otros: e.target.value }))}
                />
              </FormField>
            </div>
            {(() => {
              const totalUnidades = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0), 0)
              const costoBase = items.reduce((s, i) => s + (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0), 0)
              const flete = parseFloat(form.costo_flete) || 0
              const otros = parseFloat(form.costo_otros) || 0
              if ((flete > 0 || otros > 0) && totalUnidades > 0) {
                const costoAterrizado = (costoBase + flete + otros) / totalUnidades
                return (
                  <p className="text-xs text-blue-700 mt-2 font-medium">
                    Costo real unitario promedio: {new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(costoAterrizado)}
                  </p>
                )
              }
              return null
            })()}
          </div>

          <FormField label="Notas">
            <Textarea placeholder="Observaciones opcionales..." value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Estado de pago">
              <Select value={form.status_pago} onChange={(e) => setForm((f) => ({ ...f, status_pago: e.target.value as StatusPago }))}>
                <option value="pagado">Pagado</option>
                <option value="parcial">Parcial</option>
                <option value="pendiente">Pendiente</option>
              </Select>
            </FormField>
            <FormField label="Fecha vencimiento">
              <Input type="date" value={form.fecha_vencimiento} onChange={(e) => setForm((f) => ({ ...f, fecha_vencimiento: e.target.value }))} />
            </FormField>
          </div>

          {/* Fotos de evidencia */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <p className="text-sm font-semibold text-[var(--nm-text)] mb-2">Fotos de evidencia</p>
            <FotoUploader fotos={formFotos} onChange={setFormFotos} tabla="compras" maxFotos={5} />
          </div>

          <div className="flex gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">
              {tieneItems ? `Guardar (${formatMxn(montoCalculado)})` : 'Guardar'}
            </Btn>
          </div>
        </form>
      </div>
    )
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Compras"
        subtitle={`${comprasFiltradas.length} de ${compras.length}`}
        action={{ label: 'Nueva compra', onClick: openNew }}
      />

      {/* Búsqueda y filtros */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar folio, descripción, persona..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            />
          </div>
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFiltros || (filtroDesde || filtroHasta || filtroPago) ? 'bg-blue-50 border-blue-300 text-blue-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Filtros {(filtroDesde || filtroHasta || filtroPago) ? '●' : ''}
          </button>
        </div>

        {showFiltros && (
          <div className="nm-inset p-3 flex flex-col gap-2 border border-gray-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--nm-text-muted)] mb-1 block">Desde</label>
                <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label className="text-xs text-[var(--nm-text-muted)] mb-1 block">Hasta</label>
                <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--nm-text-muted)] mb-1 block">Forma de pago</label>
              <select value={filtroPago} onChange={(e) => setFiltroPago(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                <option value="">Todas</option>
                {FORMAS_PAGO.map((fp) => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
              </select>
            </div>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="text-xs text-red-500 hover:underline text-left">
                Limpiar filtros
              </button>
            )}
          </div>
        )}
      </div>

      {comprasFiltradas.length === 0 ? (
        hayFiltros
          ? <p className="text-sm text-[var(--nm-text-subtle)] py-8 text-center">Sin resultados para esta búsqueda</p>
          : <EmptyState message="No hay compras registradas" action={{ label: 'Registrar primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {comprasFiltradas.map((c) => {
            const compraItems = (c as any).compras_items as Array<{ cantidad: number; precio_unitario: number; inventario_registros: { nombre_producto: string; unidad_medida: string } | null }> | undefined
            return (
              <div key={c.id} className="nm-card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--nm-text)]">{formatMxn(c.monto_total)}</p>
                        {c.numero_compra && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{c.numero_compra}</span>
                        )}
                        {c.status_pago !== 'pagado' && (
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${c.status_pago === 'pendiente' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                            {c.status_pago === 'pendiente' ? 'Pendiente' : 'Parcial'}
                          </span>
                        )}
                      </div>
                      {c.descripcion && <p className="text-sm text-gray-700 mt-0.5">{c.descripcion}</p>}
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--nm-text-muted)]">
                        <span>{formatDate(c.fecha)}</span>
                        {((c.proveedores as { nombre: string } | null)?.nombre ?? (c.personas as { nombre: string } | null)?.nombre) && (
                          <span>{(c.proveedores as { nombre: string } | null)?.nombre ?? (c.personas as { nombre: string } | null)?.nombre}</span>
                        )}
                        <span>{formatFormaPago(c.forma_pago)}</span>
                        {c.gastos ? <span>+{formatMxn(c.gastos)} gastos</span> : null}
                        {c.costo_flete > 0 ? <span>flete {formatMxn(c.costo_flete)}</span> : null}
                        {c.costo_otros > 0 ? <span>otros {formatMxn(c.costo_otros)}</span> : null}
                      </div>
                      {/* Chips de productos */}
                      {compraItems && compraItems.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {compraItems.map((it, idx) => (
                            <span key={idx} className="text-xs bg-blue-50 text-blue-700 border border-blue-100 rounded-full px-2 py-0.5">
                              {it.inventario_registros?.nombre_producto ?? '—'} ×{it.cantidad}
                            </span>
                          ))}
                        </div>
                      )}
                      {c.notas && <p className="text-xs text-[var(--nm-text-subtle)] mt-1 line-clamp-1">{c.notas}</p>}
                      {c.fotos && c.fotos.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {c.fotos.slice(0, 3).map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="" className="w-10 h-10 rounded-md object-cover border border-gray-200" />
                          ))}
                          {c.fotos.length > 3 && (
                            <span className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-[var(--nm-text-subtle)] font-medium">+{c.fotos.length - 3}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex border-t border-[var(--nm-bg-inset)]">
                  <button onClick={() => openEdit(c)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Editar</button>
                  <div className="w-px bg-gray-100" />
                  <button onClick={() => handleDelete(c.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva compra"
      >
        +
      </button>
    </div>
  )
}
