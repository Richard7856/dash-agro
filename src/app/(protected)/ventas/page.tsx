'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO, generateNumeroVenta } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Venta, Persona, Cliente, Ubicacion, FormaPago } from '@/lib/types/database.types'

const FORMAS_PAGO: { value: FormaPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'bonos_gasolina', label: 'Bonos gasolina' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'otro', label: 'Otro' },
]

const emptyForm = () => ({
  numero_venta: generateNumeroVenta(),
  fecha: todayISO(),
  fecha_entrega: '',
  ubicacion_id: '',
  cliente_id: '',
  vendedor_id: '',
  forma_pago: 'efectivo' as FormaPago,
  monto_total: '',
  gastos_extras: '',
  notas: '',
})

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Filtros
  const [busqueda, setBusqueda] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [filtroPago, setFiltroPago] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: ventasData }, { data: personasData }, { data: clientesData }, { data: ubicData }] = await Promise.all([
      supabase
        .from('ventas')
        .select('*, clientes(nombre), personas(nombre), ubicaciones(nombre)')
        .order('fecha', { ascending: false })
        .limit(100),
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre'),
    ])
    setVentas((ventasData ?? []) as Venta[])
    setPersonas(personasData ?? [])
    setClientes((clientesData ?? []) as Cliente[])
    setUbicaciones(ubicData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Filtrado en cliente
  const ventasFiltradas = useMemo(() => {
    let result = ventas
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter((v) =>
        v.numero_venta?.toLowerCase().includes(q) ||
        v.notas?.toLowerCase().includes(q) ||
        (v.clientes as { nombre: string } | null)?.nombre?.toLowerCase().includes(q) ||
        (v.personas as { nombre: string } | null)?.nombre?.toLowerCase().includes(q)
      )
    }
    if (filtroDesde) result = result.filter((v) => v.fecha >= filtroDesde)
    if (filtroHasta) result = result.filter((v) => v.fecha <= filtroHasta)
    if (filtroPago) result = result.filter((v) => v.forma_pago === filtroPago)
    return result
  }, [ventas, busqueda, filtroDesde, filtroHasta, filtroPago])

  const hayFiltros = busqueda || filtroDesde || filtroHasta || filtroPago

  function limpiarFiltros() {
    setBusqueda('')
    setFiltroDesde('')
    setFiltroHasta('')
    setFiltroPago('')
  }

  const vendedores = personas.filter((p) => p.rol === 'Vendedor')

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(v: Venta) {
    setEditId(v.id)
    setForm({
      numero_venta: v.numero_venta ?? '',
      fecha: v.fecha,
      fecha_entrega: v.fecha_entrega ?? '',
      ubicacion_id: v.ubicacion_id ?? '',
      cliente_id: v.cliente_id ?? '',
      vendedor_id: v.vendedor_id ?? '',
      forma_pago: v.forma_pago,
      monto_total: String(v.monto_total),
      gastos_extras: v.gastos_extras != null ? String(v.gastos_extras) : '',
      notas: v.notas ?? '',
    })
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta venta?')) return
    await supabase.from('ventas').delete().eq('id', id)
    setVentas((vs) => vs.filter((v) => v.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || !form.monto_total) { setError('Fecha y monto son requeridos'); return }
    setSaving(true)
    setError('')

    const payload = {
      numero_venta: form.numero_venta || generateNumeroVenta(),
      fecha: form.fecha,
      fecha_entrega: form.fecha_entrega || null,
      ubicacion_id: form.ubicacion_id || null,
      cliente_id: form.cliente_id || null,
      vendedor_id: form.vendedor_id || null,
      forma_pago: form.forma_pago,
      monto_total: parseFloat(form.monto_total),
      gastos_extras: form.gastos_extras ? parseFloat(form.gastos_extras) : 0,
      notas: form.notas || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('ventas').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('ventas').insert(payload))
    }

    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    setSaving(false)
    setView('list')
    setLoading(true)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView('list')} className="p-1 text-gray-500 hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar venta' : 'Nueva venta'}</h1>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <FormField label="Folio">
            <Input
              type="text"
              value={form.numero_venta}
              onChange={(e) => setForm((f) => ({ ...f, numero_venta: e.target.value }))}
              placeholder="Auto-generado"
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
            </FormField>
            <FormField label="Monto total (MXN)" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.monto_total}
                onChange={(e) => setForm((f) => ({ ...f, monto_total: e.target.value }))}
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha de entrega">
              <Input type="date" value={form.fecha_entrega} onChange={(e) => setForm((f) => ({ ...f, fecha_entrega: e.target.value }))} />
            </FormField>
            <FormField label="Gastos extra (MXN)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.gastos_extras}
                onChange={(e) => setForm((f) => ({ ...f, gastos_extras: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Forma de pago">
              <Select value={form.forma_pago} onChange={(e) => setForm((f) => ({ ...f, forma_pago: e.target.value as FormaPago }))}>
                {FORMAS_PAGO.map((fp) => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Cliente">
              <Select value={form.cliente_id} onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}>
                <option value="">— Ninguno —</option>
                {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Select>
            </FormField>
          </div>

          {vendedores.length > 0 && (
            <FormField label="Vendedor">
              <Select value={form.vendedor_id} onChange={(e) => setForm((f) => ({ ...f, vendedor_id: e.target.value }))}>
                <option value="">— Ninguno —</option>
                {vendedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            </FormField>
          )}

          <FormField label="Ubicación">
            <Select value={form.ubicacion_id} onChange={(e) => setForm((f) => ({ ...f, ubicacion_id: e.target.value }))}>
              <option value="">— Ninguna —</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </FormField>

          <FormField label="Notas">
            <Textarea placeholder="Observaciones opcionales..." value={form.notas} onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))} />
          </FormField>

          <div className="flex gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">Guardar</Btn>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Ventas"
        subtitle={`${ventasFiltradas.length} de ${ventas.length}`}
        action={{ label: 'Nueva venta', onClick: openNew }}
      />

      {/* Búsqueda y filtros */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar folio, persona, notas..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
            />
          </div>
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors ${showFiltros || (filtroDesde || filtroHasta || filtroPago) ? 'bg-green-50 border-green-300 text-green-700' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            Filtros {(filtroDesde || filtroHasta || filtroPago) ? '●' : ''}
          </button>
        </div>

        {showFiltros && (
          <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2 border border-gray-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Desde</label>
                <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
                <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Forma de pago</label>
              <select value={filtroPago} onChange={(e) => setFiltroPago(e.target.value)}
                className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
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

      {ventasFiltradas.length === 0 ? (
        hayFiltros
          ? <p className="text-sm text-gray-400 py-8 text-center">Sin resultados para esta búsqueda</p>
          : <EmptyState message="No hay ventas registradas" action={{ label: 'Registrar primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {ventasFiltradas.map((v) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-green-700">{formatMxn(v.monto_total)}</p>
                      {v.numero_venta && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{v.numero_venta}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span>{formatDate(v.fecha)}</span>
                      {v.fecha_entrega && <span>Entrega: {formatDate(v.fecha_entrega)}</span>}
                      {((v.clientes as { nombre: string } | null)?.nombre ?? (v.personas as { nombre: string } | null)?.nombre) && (
                        <span>{(v.clientes as { nombre: string } | null)?.nombre ?? (v.personas as { nombre: string } | null)?.nombre}</span>
                      )}
                      <span className="capitalize">{v.forma_pago.replace('_', ' ')}</span>
                      {(v.ubicaciones as { nombre: string } | null)?.nombre && (
                        <span>{(v.ubicaciones as { nombre: string }).nombre}</span>
                      )}
                      {v.gastos_extras ? <span>+{formatMxn(v.gastos_extras)} extras</span> : null}
                    </div>
                    {v.notas && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{v.notas}</p>}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-gray-100">
                <button onClick={() => openEdit(v)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Editar</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => handleDelete(v.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva venta"
      >
        +
      </button>
    </div>
  )
}
