'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, formatMxn } from '@/lib/format'
import { FormField, Input } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import type { Persona } from '@/lib/types/database.types'

const ROLES = ['', 'Vendedor', 'Comprador', 'Administrativo', 'Bodeguero', 'Chofer', 'Cliente', 'Proveedor', 'Otro']

const emptyForm = () => ({
  nombre: '',
  rol: '',
  email: '',
  telefono: '',
  descripcion_puesto: '',
  impacto_operativo: '',
  estructura: '',
})

interface Movimiento {
  tipo: 'venta' | 'compra'
  fecha: string
  numero: string | null
  monto: number
  descripcion: string | null
}

interface InventarioItem {
  id: string
  nombre_producto: string
  cantidad: number
  unidad_medida: string
  precio_compra_unitario: number
}

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  // Detail view state
  const [detailTab, setDetailTab] = useState<'historial' | 'sugerencias'>('historial')
  const [movimientos, setMovimientos] = useState<Movimiento[]>([])
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('personas').select('*').order('nombre')
    setPersonas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = personas.filter((p) => {
    const q = search.toLowerCase()
    return p.nombre.toLowerCase().includes(q) || (p.rol ?? '').toLowerCase().includes(q)
  })

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(p: Persona) {
    setEditId(p.id)
    setForm({
      nombre: p.nombre,
      rol: p.rol ?? '',
      email: p.email ?? '',
      telefono: p.telefono ?? '',
      descripcion_puesto: p.descripcion_puesto ?? '',
      impacto_operativo: p.impacto_operativo ?? '',
      estructura: p.estructura ?? '',
    })
    setError('')
    setView('form')
  }

  async function openDetail(p: Persona) {
    setSelectedId(p.id)
    setDetailTab('historial')
    setView('detail')
    setLoadingDetail(true)

    const [{ data: ventas }, { data: compras }, { data: inv }] = await Promise.all([
      supabase
        .from('ventas')
        .select('fecha, numero_venta, monto_total, notas')
        .eq('persona_id', p.id)
        .order('fecha', { ascending: false }),
      supabase
        .from('compras')
        .select('fecha, numero_compra, monto_total, descripcion')
        .eq('persona_id', p.id)
        .order('fecha', { ascending: false }),
      supabase
        .from('inventario_registros')
        .select('id, nombre_producto, cantidad, unidad_medida, precio_compra_unitario')
        .gt('cantidad', 0)
        .order('cantidad', { ascending: false }),
    ])

    const movs: Movimiento[] = [
      ...(ventas ?? []).map((v) => ({
        tipo: 'venta' as const,
        fecha: v.fecha,
        numero: v.numero_venta,
        monto: v.monto_total,
        descripcion: v.notas,
      })),
      ...(compras ?? []).map((c) => ({
        tipo: 'compra' as const,
        fecha: c.fecha,
        numero: c.numero_compra,
        monto: c.monto_total,
        descripcion: c.descripcion,
      })),
    ].sort((a, b) => b.fecha.localeCompare(a.fecha))

    setMovimientos(movs)
    setInventario((inv ?? []) as InventarioItem[])
    setLoadingDetail(false)
  }

  async function toggleActivo(p: Persona) {
    await supabase.from('personas').update({ activo: !p.activo }).eq('id', p.id)
    setPersonas((ps) => ps.map((x) => x.id === p.id ? { ...x, activo: !x.activo } : x))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError('')

    const payload = {
      nombre: form.nombre.trim(),
      rol: form.rol || null,
      email: form.email || null,
      telefono: form.telefono || null,
      descripcion_puesto: form.descripcion_puesto || null,
      impacto_operativo: form.impacto_operativo || null,
      estructura: form.estructura || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('personas').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('personas').insert({ ...payload, activo: true }))
    }

    if (err) { setError('Error al guardar. Revisa los datos.'); setSaving(false); return }

    setSaving(false)
    setView('list')
    setLoading(true)
    loadData()
  }

  const selectedPersona = selectedId ? personas.find((p) => p.id === selectedId) : null

  // ─── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── Form view ──────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView('list')} className="p-1 text-gray-500 hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar persona' : 'Nueva persona'}</h1>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <FormField label="Nombre" required>
            <Input
              type="text"
              placeholder="Nombre completo"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              required
              autoFocus
            />
          </FormField>

          <FormField label="Rol">
            <select
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent"
              value={form.rol}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r || '— Sin rol —'}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Teléfono">
              <Input
                type="tel"
                placeholder="33 1234 5678"
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Capital humano</p>
            <div className="flex flex-col gap-3">
              <FormField label="Descripción de puesto">
                <textarea
                  rows={3}
                  placeholder="Describe las actividades que realiza en su puesto..."
                  value={form.descripcion_puesto}
                  onChange={(e) => setForm((f) => ({ ...f, descripcion_puesto: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent resize-none"
                />
              </FormField>
              <FormField label="Impacto operativo">
                <textarea
                  rows={2}
                  placeholder="¿Cómo influye su labor en otros procesos o personas?"
                  value={form.impacto_operativo}
                  onChange={(e) => setForm((f) => ({ ...f, impacto_operativo: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent resize-none"
                />
              </FormField>
              <FormField label="Estructura">
                <textarea
                  rows={2}
                  placeholder="Área, jerarquía y función específica dentro de la organización..."
                  value={form.estructura}
                  onChange={(e) => setForm((f) => ({ ...f, estructura: e.target.value }))}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent resize-none"
                />
              </FormField>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">Guardar</Btn>
          </div>
        </form>
      </div>
    )
  }

  // ─── Detail view ────────────────────────────────────────────────────────────
  if (view === 'detail' && selectedPersona) {
    const p = selectedPersona
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('list')} className="p-1 text-gray-500 hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-gray-900">{p.nombre}</h1>
              {p.rol && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.rol}</span>}
              {!p.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactiva</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-gray-400 mt-0.5">
              {p.telefono && <span>{p.telefono}</span>}
              {p.email && <span>{p.email}</span>}
            </div>
          </div>
          <Btn variant="secondary" size="sm" onClick={() => openEdit(p)}>Editar</Btn>
        </div>

        {/* Capital humano cards */}
        {(p.descripcion_puesto || p.impacto_operativo || p.estructura) && (
          <div className="flex flex-col gap-2 mb-4">
            {p.descripcion_puesto && (
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-blue-600 mb-1">Descripción de puesto</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.descripcion_puesto}</p>
              </div>
            )}
            {p.impacto_operativo && (
              <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-green-700 mb-1">Impacto operativo</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.impacto_operativo}</p>
              </div>
            )}
            {p.estructura && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Estructura</p>
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{p.estructura}</p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(['historial', 'sugerencias'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setDetailTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                detailTab === tab
                  ? 'border-green-600 text-green-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab === 'historial' ? 'Historial' : 'Sugerencias'}
            </button>
          ))}
        </div>

        {loadingDetail ? (
          <div className="flex justify-center py-10">
            <div className="w-7 h-7 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : detailTab === 'historial' ? (
          movimientos.length === 0 ? (
            <div className="text-center py-10 text-gray-400 text-sm">Sin movimientos registrados para esta persona.</div>
          ) : (
            <div className="flex flex-col gap-2">
              {movimientos.map((m, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-start gap-3">
                  <span className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full mt-0.5 ${
                    m.tipo === 'venta' ? 'bg-blue-100 text-blue-700' : 'bg-orange-100 text-orange-700'
                  }`}>
                    {m.tipo === 'venta' ? 'Venta' : 'Compra'}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-gray-900">{formatMxn(m.monto)}</span>
                      <span className="text-xs text-gray-400">{formatDate(m.fecha)}</span>
                    </div>
                    {m.numero && <p className="text-xs text-gray-400">#{m.numero}</p>}
                    {m.descripcion && <p className="text-xs text-gray-500 mt-0.5 truncate">{m.descripcion}</p>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>
            <p className="text-xs text-gray-400 mb-3">Productos con existencia en almacén, ordenados por mayor stock disponible.</p>
            {inventario.length === 0 ? (
              <div className="text-center py-10 text-gray-400 text-sm">Sin productos en existencia actualmente.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {inventario.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{item.nombre_producto}</p>
                      <p className="text-xs text-gray-400 mt-0.5">
                        {item.cantidad} {item.unidad_medida} · {formatMxn(item.precio_compra_unitario)}/u
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold bg-green-50 text-green-700 px-2 py-1 rounded-lg">
                      {item.cantidad} en stock
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── List view ──────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Personas</h1>
          <p className="text-sm text-gray-500 mt-0.5">{personas.filter((p) => p.activo).length} activas</p>
        </div>
        <Btn onClick={openNew} className="hidden md:flex">+ Nueva persona</Btn>
      </div>

      {/* Buscador */}
      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          type="text"
          placeholder="Buscar por nombre o rol..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm">
          {search ? 'Sin resultados para tu búsqueda.' : 'No hay personas registradas.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 shadow-sm ${p.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-gray-900">{p.nombre}</p>
                    {p.rol && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.rol}</span>}
                    {!p.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactiva</span>}
                  </div>
                  {p.descripcion_puesto && (
                    <p className="text-xs text-gray-400 mt-1 line-clamp-1">{p.descripcion_puesto}</p>
                  )}
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-gray-400">
                    {p.telefono && <span>{p.telefono}</span>}
                    {p.email && <span>{p.email}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openDetail(p)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">
                    Ver
                  </button>
                  <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActivo(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${p.activo ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva persona"
      >
        +
      </button>
    </div>
  )
}
