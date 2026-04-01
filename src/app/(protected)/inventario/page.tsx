'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, generateSKU, generateLote } from '@/lib/format'
import { FormField, Input, Select } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import type { InventarioRegistro, Ubicacion, UnidadMedida } from '@/lib/types/database.types'
import { FotoUploader } from '@/components/ui/FotoUploader'
import { useToast } from '@/components/ui/Toast'
import { logActivity } from '@/lib/activity-log'

const EanScanner = dynamic(() => import('@/components/inventario/EanScanner').then((m) => m.EanScanner), { ssr: false })

const UNIDADES: UnidadMedida[] = ['unidad', 'kg', 'lt', 'caja', 'tarima', 'pieza', 'litro', 'gramo']
const PAGE_SIZES = [20, 50, 100] as const
type PageSize = (typeof PAGE_SIZES)[number]

const emptyForm = () => ({
  ean: '',
  sku: generateSKU(),
  nombre_producto: '',
  cantidad: '',
  stock_minimo: '',
  precio_compra_unitario: '',
  precio_venta_publico: '',
  precio_distribuidor: '',
  precio_minimo: '',
  unidad_medida: 'unidad' as UnidadMedida,
  cantidad_por_caja: '',
  cajas_por_tarima: '',
  numero_lote: generateLote(),
  fecha_caducidad: '',
  ubicacion_id: '',
  ubicacion_nueva: '',
})

function getExpiryStatus(fecha: string | null): 'expired' | 'soon' | 'ok' | null {
  if (!fecha) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(fecha + 'T00:00:00')
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 7) return 'soon'
  return 'ok'
}

export default function InventarioPage() {
  const { toast } = useToast()
  const [registros, setRegistros] = useState<InventarioRegistro[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [formFotos, setFormFotos] = useState<string[]>([])
  const [scanning, setScanning] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)

  // Aviso EAN duplicado
  const [eanDuplicates, setEanDuplicates] = useState<InventarioRegistro[]>([])
  const [showEanWarning, setShowEanWarning] = useState(false)

  // Búsqueda y filtros
  const [busqueda, setBusqueda] = useState('')
  const [debouncedBusqueda, setDebouncedBusqueda] = useState('')
  const [filtroVencimiento, setFiltroVencimiento] = useState<'' | 'pronto' | 'caducado' | 'vigente' | 'sin_fecha'>('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroUbicacion, setFiltroUbicacion] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  // Paginación
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState<PageSize>(20)
  const [totalCount, setTotalCount] = useState(0)
  const [totalCantidad, setTotalCantidad] = useState(0)
  const [totalValor, setTotalValor] = useState(0)
  const [refreshKey, setRefreshKey] = useState(0)

  useEffect(() => {
    setHasCamera(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
  }, [])

  // Debounce búsqueda 400ms
  useEffect(() => {
    const t = setTimeout(() => setDebouncedBusqueda(busqueda), 400)
    return () => clearTimeout(t)
  }, [busqueda])

  // Reset página al cambiar filtros
  useEffect(() => { setPage(1) }, [debouncedBusqueda, filtroVencimiento, filtroDesde, filtroHasta, filtroUbicacion])

  // Ubicaciones: solo una vez al montar
  useEffect(() => {
    supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre')
      .then(({ data }) => setUbicaciones(data ?? []))
  }, [])

  // Aplica filtros activos a cualquier query de Supabase
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const applyFilters = useCallback(<T,>(q: T): T => {
    const today = new Date().toISOString().split('T')[0]
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
    if (debouncedBusqueda.trim()) {
      const term = `%${debouncedBusqueda.trim()}%`
      q = (q as any).or(`nombre_producto.ilike.${term},ean.ilike.${term},sku.ilike.${term},numero_lote.ilike.${term}`)
    }
    if (filtroVencimiento === 'pronto')    q = (q as any).gte('fecha_caducidad', today).lte('fecha_caducidad', soon)
    if (filtroVencimiento === 'caducado')  q = (q as any).lt('fecha_caducidad', today)
    if (filtroVencimiento === 'vigente')   q = (q as any).gt('fecha_caducidad', soon)
    if (filtroVencimiento === 'sin_fecha') q = (q as any).is('fecha_caducidad', null)
    if (filtroDesde) q = (q as any).gte('created_at', filtroDesde)
    if (filtroHasta) q = (q as any).lte('created_at', filtroHasta + 'T23:59:59')
    if (filtroUbicacion) q = (q as any).eq('ubicacion_id', filtroUbicacion)
    return q
  }, [debouncedBusqueda, filtroVencimiento, filtroDesde, filtroHasta, filtroUbicacion])

  const loadData = useCallback(async () => {
    setRefreshing(true)
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    const { data: regs, count } = await applyFilters(
      supabase
        .from('inventario_registros')
        .select('*, ubicaciones(nombre)', { count: 'exact' })
        .order('created_at', { ascending: false })
        .range(from, to)
    )

    setRegistros((regs ?? []) as InventarioRegistro[])
    setTotalCount(count ?? 0)

    const { data: cantData } = await applyFilters(
      supabase.from('inventario_registros').select('cantidad, precio_compra_total')
    )
    const rows = (cantData ?? []) as { cantidad: number; precio_compra_total: number }[]
    setTotalCantidad(rows.reduce((s, r) => s + (r.cantidad ?? 0), 0))
    setTotalValor(rows.reduce((s, r) => s + (r.precio_compra_total ?? 0), 0))

    setInitialLoading(false)
    setRefreshing(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, pageSize, refreshKey, applyFilters])

  useEffect(() => { loadData() }, [loadData])

  function forceRefresh() { setRefreshKey((k) => k + 1) }

  function handlePageSizeChange(size: PageSize) {
    setPage(1)
    setPageSize(size)
  }

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setFormFotos([])
    setError('')
    setEanDuplicates([])
    setShowEanWarning(false)
    setView('form')
  }

  function openEdit(r: InventarioRegistro) {
    setEanDuplicates([])
    setShowEanWarning(false)
    setEditId(r.id)
    setForm({
      ean: r.ean ?? '',
      sku: r.sku ?? '',
      nombre_producto: r.nombre_producto,
      cantidad: String(r.cantidad),
      stock_minimo: r.stock_minimo > 0 ? String(r.stock_minimo) : '',
      precio_compra_unitario: String(r.precio_compra_unitario),
      precio_venta_publico: r.precio_venta_publico > 0 ? String(r.precio_venta_publico) : '',
      precio_distribuidor: r.precio_distribuidor > 0 ? String(r.precio_distribuidor) : '',
      precio_minimo: r.precio_minimo > 0 ? String(r.precio_minimo) : '',
      unidad_medida: r.unidad_medida,
      cantidad_por_caja: r.cantidad_por_caja != null ? String(r.cantidad_por_caja) : '',
      cajas_por_tarima: r.cajas_por_tarima != null ? String(r.cajas_por_tarima) : '',
      numero_lote: r.numero_lote ?? '',
      fecha_caducidad: r.fecha_caducidad ?? '',
      ubicacion_id: r.ubicacion_id ?? '',
      ubicacion_nueva: '',
    })
    setFormFotos(r.fotos ?? [])
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro?')) return
    const toDelete = registros.find(r => r.id === id)
    const { error: delErr } = await supabase.from('inventario_registros').delete().eq('id', id)
    if (delErr) { setError(`Error al eliminar: ${delErr.message}`); return }
    logActivity({ accion: 'eliminar', modulo: 'inventario', detalle: toDelete?.nombre_producto ?? id, registro_id: id })
    // Si era el único de la página y hay más páginas, retroceder
    if (registros.length === 1 && page > 1) {
      setPage((p) => p - 1)
    } else {
      forceRefresh()
    }
  }

  async function performSave() {
    setSaving(true)
    setError('')

    const cantidad = parseFloat(form.cantidad)
    const precio_compra_unitario = parseFloat(form.precio_compra_unitario)
    const precio_compra_total = parseFloat((cantidad * precio_compra_unitario).toFixed(2))

    // Create new ubicación if "Otro" selected
    let ubicacionId: string | null = form.ubicacion_id || null
    if (form.ubicacion_id === '__nuevo__' && form.ubicacion_nueva.trim()) {
      const codigo = form.ubicacion_nueva.trim().toUpperCase().replace(/\s+/g, '-').substring(0, 20)
      const { data: newUbi, error: ubiErr } = await supabase
        .from('ubicaciones')
        .insert({ codigo, nombre: form.ubicacion_nueva.trim() })
        .select()
        .single()
      if (ubiErr || !newUbi) {
        setError(`Error creando ubicación: ${ubiErr?.message ?? 'desconocido'}`)
        setSaving(false)
        return
      }
      ubicacionId = newUbi.id
      setUbicaciones((prev) => [...prev, newUbi as Ubicacion].sort((a, b) => a.nombre.localeCompare(b.nombre)))
      setForm((f) => ({ ...f, ubicacion_id: newUbi.id, ubicacion_nueva: '' }))
    } else if (form.ubicacion_id === '__nuevo__') {
      ubicacionId = null
    }

    const payload = {
      ean: form.ean || null,
      sku: form.sku || generateSKU(),
      nombre_producto: form.nombre_producto,
      cantidad,
      stock_minimo: form.stock_minimo ? parseFloat(form.stock_minimo) : 0,
      precio_compra_unitario,
      precio_compra_total,
      precio_venta_publico: form.precio_venta_publico ? parseFloat(form.precio_venta_publico) : 0,
      precio_distribuidor: form.precio_distribuidor ? parseFloat(form.precio_distribuidor) : 0,
      precio_minimo: form.precio_minimo ? parseFloat(form.precio_minimo) : 0,
      unidad_medida: form.unidad_medida,
      cantidad_por_caja: form.cantidad_por_caja ? parseFloat(form.cantidad_por_caja) : null,
      cajas_por_tarima: form.cajas_por_tarima ? parseInt(form.cajas_por_tarima) : null,
      numero_lote: form.numero_lote || generateLote(),
      fecha_caducidad: form.fecha_caducidad || null,
      ubicacion_id: ubicacionId,
      fotos: formFotos,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('inventario_registros').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('inventario_registros').insert(payload))
    }

    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    setSaving(false)
    logActivity({ accion: editId ? 'editar' : 'crear', modulo: 'inventario', detalle: `${form.nombre_producto} — ${form.cantidad} ${form.unidad_medida}` })
    toast({ type: 'success', message: editId ? 'Registro actualizado correctamente' : 'Artículo agregado al inventario' })
    setView('list')
    if (!editId) setPage(1)
    forceRefresh()
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre_producto || !form.cantidad || !form.precio_compra_unitario) {
      setError('Nombre, cantidad y precio son requeridos')
      return
    }

    // Verificar EAN duplicado solo en registros nuevos con EAN
    if (!editId && form.ean) {
      const { data: existing } = await supabase
        .from('inventario_registros')
        .select('*, ubicaciones(nombre)')
        .eq('ean', form.ean)
        .order('created_at', { ascending: false })

      if (existing && existing.length > 0) {
        setEanDuplicates(existing as InventarioRegistro[])
        setShowEanWarning(true)
        return
      }
    }

    await performSave()
  }

  async function handleConfirmNewLot() {
    setShowEanWarning(false)
    setEanDuplicates([])
    await performSave()
  }

  const precioTotal = form.cantidad && form.precio_compra_unitario
    ? (parseFloat(form.cantidad) * parseFloat(form.precio_compra_unitario)).toFixed(2)
    : '0.00'

  // Stats de la página actual
  const totalValorPagina = registros.reduce((s, r) => s + (r.precio_compra_total ?? 0), 0)
  const vencenProto = registros.filter((r) => {
    const s = getExpiryStatus(r.fecha_caducidad ?? null)
    return s === 'soon' || s === 'expired'
  }).length

  // Filtros activos
  const hayFiltros = !!(debouncedBusqueda || filtroVencimiento || filtroDesde || filtroHasta || filtroUbicacion)
  const filtrosActivos = [debouncedBusqueda, filtroVencimiento, filtroDesde, filtroHasta, filtroUbicacion].filter(Boolean).length
  function limpiarFiltros() {
    setBusqueda(''); setDebouncedBusqueda(''); setFiltroVencimiento(''); setFiltroDesde(''); setFiltroHasta(''); setFiltroUbicacion('')
  }

  const totalPages = Math.ceil(totalCount / pageSize)
  const desde = totalCount === 0 ? 0 : (page - 1) * pageSize + 1
  const hasta = Math.min(page * pageSize, totalCount)

  if (initialLoading) return <Spinner fullPage />

  // ─── FORM VIEW ───────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        {scanning && (
          <EanScanner
            onScan={(ean) => { setForm((f) => ({ ...f, ean })); setScanning(false) }}
            onClose={() => setScanning(false)}
          />
        )}

        <FormHeader title={editId ? 'Editar registro' : 'Nuevo registro'} onBack={() => setView('list')} />

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* EAN */}
          <FormField label="Código EAN">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Escanear o ingresar manual"
                value={form.ean}
                onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))}
              />
              {hasCamera && (
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors shrink-0"
                  title="Escanear"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a2 2 0 012-2h3M3 15v3a2 2 0 002 2h3m9-16h3a2 2 0 012 2v3m0 6v3a2 2 0 01-2 2h-3" />
                    <rect x="7" y="7" width="10" height="10" rx="1" />
                  </svg>
                </button>
              )}
            </div>
          </FormField>

          <FormField label="Nombre del producto" required>
            <Input
              type="text"
              placeholder="Ej. Aguacate Hass"
              value={form.nombre_producto}
              onChange={(e) => setForm((f) => ({ ...f, nombre_producto: e.target.value }))}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cantidad" required>
              <Input
                type="number" min="0" step="0.001" placeholder="0"
                value={form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Unidad">
              <Select value={form.unidad_medida} onChange={(e) => setForm((f) => ({ ...f, unidad_medida: e.target.value as UnidadMedida }))}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Stock mínimo (alerta)">
            <Input
              type="number" min="0" step="0.001" placeholder="Opcional — ej. 10"
              value={form.stock_minimo}
              onChange={(e) => setForm((f) => ({ ...f, stock_minimo: e.target.value }))}
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Precio compra unitario" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.precio_compra_unitario}
                onChange={(e) => setForm((f) => ({ ...f, precio_compra_unitario: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Precio total compra">
              <div className="flex items-center min-h-[44px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
                {formatMxn(parseFloat(precioTotal))}
              </div>
            </FormField>
          </div>

          {/* Precios de venta — al estilo SAE */}
          <div className="border border-blue-100 rounded-xl p-3 bg-blue-50/40">
            <p className="text-xs font-semibold text-blue-700 mb-2">Precios de venta</p>
            <div className="grid grid-cols-3 gap-2">
              <FormField label="Público">
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.precio_venta_publico}
                  onChange={(e) => setForm((f) => ({ ...f, precio_venta_publico: e.target.value }))}
                />
              </FormField>
              <FormField label="Distribuidor">
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.precio_distribuidor}
                  onChange={(e) => setForm((f) => ({ ...f, precio_distribuidor: e.target.value }))}
                />
              </FormField>
              <FormField label="Mínimo">
                <Input
                  type="number" min="0" step="0.01" placeholder="0.00"
                  value={form.precio_minimo}
                  onChange={(e) => setForm((f) => ({ ...f, precio_minimo: e.target.value }))}
                />
              </FormField>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cant. por caja">
              <Input
                type="number" min="0" step="0.001" placeholder="Opcional"
                value={form.cantidad_por_caja}
                onChange={(e) => setForm((f) => ({ ...f, cantidad_por_caja: e.target.value }))}
              />
            </FormField>
            <FormField label="Cajas / tarima">
              <Input
                type="number" min="0" step="1" placeholder="Opcional"
                value={form.cajas_por_tarima}
                onChange={(e) => setForm((f) => ({ ...f, cajas_por_tarima: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="SKU">
              <Input type="text" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </FormField>
            <FormField label="Lote">
              <Input type="text" value={form.numero_lote} onChange={(e) => setForm((f) => ({ ...f, numero_lote: e.target.value }))} />
            </FormField>
          </div>

          <FormField label="Fecha de caducidad">
            <Input
              type="date"
              value={form.fecha_caducidad}
              onChange={(e) => setForm((f) => ({ ...f, fecha_caducidad: e.target.value }))}
            />
          </FormField>

          <FormField label="Almacén / Ubicación">
            <Select value={form.ubicacion_id} onChange={(e) => setForm((f) => ({ ...f, ubicacion_id: e.target.value, ubicacion_nueva: '' }))}>
              <option value="">— Ninguna —</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
              <option value="__nuevo__">+ Otro (escribir nombre)</option>
            </Select>
          </FormField>
          {form.ubicacion_id === '__nuevo__' && (
            <FormField label="Nombre del nuevo almacén">
              <Input
                type="text"
                value={form.ubicacion_nueva}
                onChange={(e) => setForm((f) => ({ ...f, ubicacion_nueva: e.target.value }))}
                placeholder="Ej: Bodega norte, Sucursal centro..."
                autoFocus
              />
            </FormField>
          )}

          {/* Fotos de evidencia */}
          <div className="border border-gray-200 rounded-xl p-3 bg-white">
            <p className="text-sm font-semibold text-[var(--nm-text)] mb-2">Fotos del producto</p>
            <FotoUploader fotos={formFotos} onChange={setFormFotos} tabla="inventario" maxFotos={5} />
          </div>

          {/* Aviso EAN duplicado */}
          {showEanWarning && (
            <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5 text-amber-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                </svg>
                <div>
                  <p className="font-semibold text-amber-800 text-sm">EAN ya registrado</p>
                  <p className="text-xs text-amber-700">Este código existe en {eanDuplicates.length} registro{eanDuplicates.length > 1 ? 's' : ''}</p>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                {eanDuplicates.map((r) => {
                  const expiry = getExpiryStatus(r.fecha_caducidad ?? null)
                  return (
                    <div key={r.id} className="bg-white rounded-lg border border-amber-200 p-3">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <p className="font-medium text-sm text-[var(--nm-text)] truncate">{r.nombre_producto}</p>
                          <p className="text-xs text-[var(--nm-text-muted)] mt-0.5">
                            {r.cantidad} {r.unidad_medida} · {formatMxn(r.precio_compra_total)}
                          </p>
                          {r.numero_lote && <p className="text-xs text-[var(--nm-text-subtle)]">Lote: {r.numero_lote}</p>}
                          {r.fecha_caducidad && (
                            <p className={`text-xs font-medium ${expiry === 'expired' ? 'text-red-600' : expiry === 'soon' ? 'text-amber-600' : 'text-[var(--nm-text-subtle)]'}`}>
                              Cad: {formatDate(r.fecha_caducidad)}
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => openEdit(r)}
                          className="shrink-0 px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-200"
                        >
                          Editar
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex gap-2">
                <Btn type="button" variant="secondary" onClick={() => setShowEanWarning(false)} className="flex-1">
                  Cancelar
                </Btn>
                <Btn type="button" onClick={handleConfirmNewLot} loading={saving} className="flex-1">
                  Nuevo lote igualmente
                </Btn>
              </div>
            </div>
          )}

          {!showEanWarning && (
            <div className="flex gap-2 pt-1">
              <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
              <Btn type="submit" loading={saving} className="flex-1">Guardar</Btn>
            </div>
          )}
        </form>
      </div>
    )
  }

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Inventario"
        subtitle={`${hayFiltros ? `${totalCount} resultado${totalCount !== 1 ? 's' : ''}${filtroUbicacion ? ` en ${ubicaciones.find(u => u.id === filtroUbicacion)?.nombre ?? ''}` : ''}` : `${totalCount} registros en total`} · ${Math.round(totalCantidad)} piezas`}
        action={{ label: 'Nuevo registro', onClick: openNew }}
      />

      {/* Búsqueda + Filtros */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          {/* Input búsqueda */}
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar por nombre, EAN, SKU, lote…"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-8 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-[var(--nm-text)] placeholder:text-[var(--nm-text-subtle)]"
            />
            {refreshing ? (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            ) : busqueda ? (
              <button onClick={() => setBusqueda('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--nm-text-subtle)] hover:text-[var(--nm-text)]">
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
              </button>
            ) : null}
          </div>
          {/* Toggle filtros */}
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`relative flex items-center gap-1.5 px-3 py-2 text-sm rounded-xl border font-medium transition-colors ${showFiltros ? 'bg-blue-600 text-white border-blue-600' : 'bg-white border-gray-200 text-[var(--nm-text-muted)] hover:border-blue-400'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/></svg>
            Filtros
            {filtrosActivos > 0 && (
              <span className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] rounded-full text-[10px] font-bold flex items-center justify-center px-1 ${showFiltros ? 'bg-white text-blue-600' : 'bg-blue-600 text-white'}`}>
                {filtrosActivos}
              </span>
            )}
          </button>
        </div>

        {/* Panel de filtros colapsable */}
        {showFiltros && (
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex flex-col gap-4">
            {/* Almacén / Ubicación */}
            <div>
              <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wider mb-2">Almacén</p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => setFiltroUbicacion('')}
                  className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${
                    !filtroUbicacion
                      ? 'bg-gray-700 text-white border-gray-700'
                      : 'bg-gray-50 text-[var(--nm-text-muted)] border-gray-200 hover:border-gray-400'
                  }`}
                >
                  Todos
                </button>
                {ubicaciones.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => setFiltroUbicacion(u.id)}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${
                      filtroUbicacion === u.id
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'bg-gray-50 text-[var(--nm-text-muted)] border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {u.nombre}
                  </button>
                ))}
              </div>
            </div>

            {/* Vencimiento */}
            <div>
              <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wider mb-2">Vencimiento</p>
              <div className="flex flex-wrap gap-2">
                {([
                  { value: '', label: 'Todos' },
                  { value: 'pronto', label: '⚠ Pronto ≤7d' },
                  { value: 'caducado', label: '🔴 Caducados' },
                  { value: 'vigente', label: '✅ Vigentes' },
                  { value: 'sin_fecha', label: 'Sin fecha' },
                ] as const).map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setFiltroVencimiento(value)}
                    className={`px-3 py-1.5 text-xs rounded-full font-medium border transition-colors ${
                      filtroVencimiento === value
                        ? value === 'caducado' ? 'bg-red-600 text-white border-red-600'
                          : value === 'pronto' ? 'bg-amber-500 text-white border-amber-500'
                          : value === 'vigente' ? 'bg-blue-600 text-white border-blue-600'
                          : 'bg-gray-700 text-white border-gray-700'
                        : 'bg-gray-50 text-[var(--nm-text-muted)] border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Rango fecha de alta */}
            <div>
              <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wider mb-2">Fecha de alta</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-[var(--nm-text-subtle)] mb-1 block">Desde</label>
                  <input
                    type="date"
                    value={filtroDesde}
                    onChange={(e) => setFiltroDesde(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-[var(--nm-text)]"
                  />
                </div>
                <div>
                  <label className="text-xs text-[var(--nm-text-subtle)] mb-1 block">Hasta</label>
                  <input
                    type="date"
                    value={filtroHasta}
                    onChange={(e) => setFiltroHasta(e.target.value)}
                    className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-500 text-[var(--nm-text)]"
                  />
                </div>
              </div>
            </div>

            {hayFiltros && (
              <button onClick={limpiarFiltros} className="self-end text-xs text-red-500 hover:text-red-700 font-medium underline">
                Limpiar todos los filtros
              </button>
            )}
          </div>
        )}
      </div>

      {/* Stats */}
      {totalCount > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          {/* Totales generales */}
          <p className="text-[10px] font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wider">
            Totales{filtroUbicacion ? ` — ${ubicaciones.find(u => u.id === filtroUbicacion)?.nombre ?? ''}` : ''}
          </p>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-white rounded-xl p-2.5 border border-gray-200 text-center">
              <p className="text-[10px] text-[var(--nm-text-subtle)]">Productos</p>
              <p className="text-base font-bold text-[var(--nm-text)]">{totalCount}</p>
            </div>
            <div className="bg-white rounded-xl p-2.5 border border-gray-200 text-center">
              <p className="text-[10px] text-[var(--nm-text-subtle)]">Piezas</p>
              <p className="text-base font-bold text-blue-700">{totalCantidad.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-white rounded-xl p-2.5 border border-gray-200 text-center">
              <p className="text-[10px] text-[var(--nm-text-subtle)]">Valor</p>
              <p className="text-sm font-bold text-blue-700 truncate">{formatMxn(totalValor)}</p>
            </div>
            <div className={`rounded-xl p-2.5 border text-center ${vencenProto > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
              <p className="text-[10px] text-[var(--nm-text-subtle)]">Por vencer</p>
              <p className={`text-base font-bold ${vencenProto > 0 ? 'text-amber-700' : 'text-[var(--nm-text-subtle)]'}`}>{vencenProto}</p>
            </div>
          </div>
          {/* Página actual */}
          <p className="text-[10px] font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wider mt-1">
            Página {page} de {totalPages}
          </p>
          <div className="grid grid-cols-4 gap-2">
            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Productos</p>
              <p className="text-base font-bold text-gray-600">{registros.length}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Piezas</p>
              <p className="text-base font-bold text-gray-600">{registros.reduce((s, r) => s + r.cantidad, 0).toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Valor</p>
              <p className="text-sm font-bold text-gray-600 truncate">{formatMxn(totalValorPagina)}</p>
            </div>
            <div className="bg-gray-50 rounded-xl p-2.5 border border-gray-100 text-center">
              <p className="text-[10px] text-gray-400">Por vencer</p>
              <p className="text-base font-bold text-gray-600">{vencenProto}</p>
            </div>
          </div>
        </div>
      )}

      {totalCount === 0 ? (
        hayFiltros
          ? <EmptyState message="No hay resultados para los filtros seleccionados" action={{ label: 'Limpiar filtros', onClick: limpiarFiltros }} />
          : <EmptyState message="No hay registros de inventario" action={{ label: 'Agregar primero', onClick: openNew }} />
      ) : (
        <>
          {/* Controles: rango + selector de página */}
          <div className="flex items-center justify-between mb-3 gap-2">
            <p className="text-sm text-[var(--nm-text-muted)] shrink-0">
              {desde}–{hasta} de {totalCount}
            </p>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[var(--nm-text-subtle)]">Mostrar</span>
              {PAGE_SIZES.map((size) => (
                <button
                  key={size}
                  onClick={() => handlePageSizeChange(size)}
                  className={`px-2.5 py-1 text-xs rounded-lg font-medium transition-colors ${
                    pageSize === size
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* Lista */}
          <div className="flex flex-col gap-2">
            {registros.map((r) => {
              const expiryStatus = getExpiryStatus(r.fecha_caducidad ?? null)
              const stockBajo = r.stock_minimo > 0 && r.cantidad <= r.stock_minimo
              return (
                <div
                  key={r.id}
                  className={`nm-card p-4 ${expiryStatus === 'expired' ? 'border-red-200' : expiryStatus === 'soon' ? 'border-amber-200' : stockBajo ? 'border-orange-200' : 'border-gray-200'}`}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-[var(--nm-text)] truncate">{r.nombre_producto}</p>
                        {expiryStatus === 'expired' && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium shrink-0">Vencido</span>
                        )}
                        {expiryStatus === 'soon' && (
                          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">Vence pronto</span>
                        )}
                        {stockBajo && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full font-medium shrink-0">Stock bajo</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--nm-text-muted)]">
                        {r.sku && <span>SKU: {r.sku}</span>}
                        {r.numero_lote && <span>Lote: {r.numero_lote}</span>}
                        {(r.ubicaciones as { nombre: string } | null)?.nombre && (
                          <span>{(r.ubicaciones as { nombre: string }).nombre}</span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-sm">
                        <span className="text-gray-600">{r.cantidad} {r.unidad_medida}</span>
                        {r.stock_minimo > 0 && (
                          <span className={`text-xs ${stockBajo ? 'text-orange-600 font-medium' : 'text-gray-400'}`}>
                            mín {r.stock_minimo}
                          </span>
                        )}
                        <span className="text-[var(--nm-text-subtle)]">·</span>
                        <span className="font-medium text-gray-800">{formatMxn(r.precio_compra_total)}</span>
                      </div>
                      {(r.precio_venta_publico > 0 || r.precio_distribuidor > 0 || r.precio_minimo > 0) && (
                        <div className="flex flex-wrap gap-2 mt-1.5">
                          {r.precio_venta_publico > 0 && (
                            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                              Público {formatMxn(r.precio_venta_publico)}
                            </span>
                          )}
                          {r.precio_distribuidor > 0 && (
                            <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">
                              Dist. {formatMxn(r.precio_distribuidor)}
                            </span>
                          )}
                          {r.precio_minimo > 0 && (
                            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                              Mín {formatMxn(r.precio_minimo)}
                            </span>
                          )}
                        </div>
                      )}
                      <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-[var(--nm-text-subtle)]">
                        <span>Alta: {formatDate(r.created_at.split('T')[0])}</span>
                        {r.fecha_caducidad && (
                          <span className={expiryStatus === 'expired' ? 'text-red-600 font-medium' : expiryStatus === 'soon' ? 'text-amber-600 font-medium' : ''}>
                            Cad: {formatDate(r.fecha_caducidad)}
                          </span>
                        )}
                      </div>
                      {r.fotos && r.fotos.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {r.fotos.slice(0, 3).map((url) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img key={url} src={url} alt="" className="w-10 h-10 rounded-md object-cover border border-gray-200 cursor-pointer" onClick={() => openEdit(r)} />
                          ))}
                          {r.fotos.length > 3 && (
                            <span className="w-10 h-10 rounded-md bg-gray-100 border border-gray-200 flex items-center justify-center text-xs text-[var(--nm-text-subtle)] font-medium">
                              +{r.fotos.length - 3}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1 shrink-0">
                      <button onClick={() => openEdit(r)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">
                        Borrar
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Paginación */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-5 pb-2">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2.5 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Primera página"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                ← Anterior
              </button>
              <span className="text-sm text-[var(--nm-text-muted)] px-1 min-w-[80px] text-center">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                Siguiente →
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2.5 py-1.5 text-sm rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                title="Última página"
              >
                »
              </button>
            </div>
          )}
        </>
      )}

      {/* FAB móvil */}
      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nuevo registro"
      >
        +
      </button>
    </div>
  )
}
