'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO, generateNumeroCompra } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Compra, Persona, Proveedor, Ubicacion, FormaPago } from '@/lib/types/database.types'

const FORMAS_PAGO: { value: FormaPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'bonos_gasolina', label: 'Bonos gasolina' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'otro', label: 'Otro' },
]

const emptyForm = () => ({
  numero_compra: generateNumeroCompra(),
  fecha: todayISO(),
  descripcion: '',
  ubicacion_id: '',
  proveedor_id: '',
  forma_pago: 'efectivo' as FormaPago,
  monto_total: '',
  gastos: '',
  notas: '',
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
        .select('*, proveedores(nombre), personas(nombre), ubicaciones(nombre)')
        .order('fecha', { ascending: false })
        .limit(100),
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
    setBusqueda('')
    setFiltroDesde('')
    setFiltroHasta('')
    setFiltroPago('')
  }

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(c: Compra) {
    setEditId(c.id)
    setForm({
      numero_compra: c.numero_compra ?? '',
      fecha: c.fecha,
      descripcion: c.descripcion ?? '',
      ubicacion_id: c.ubicacion_id ?? '',
      proveedor_id: c.proveedor_id ?? '',
      forma_pago: c.forma_pago,
      monto_total: String(c.monto_total),
      gastos: c.gastos != null ? String(c.gastos) : '',
      notas: c.notas ?? '',
    })
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta compra?')) return
    await supabase.from('compras').delete().eq('id', id)
    setCompras((cs) => cs.filter((c) => c.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || !form.monto_total) { setError('Fecha y monto son requeridos'); return }
    setSaving(true)
    setError('')

    const payload = {
      numero_compra: form.numero_compra || generateNumeroCompra(),
      fecha: form.fecha,
      descripcion: form.descripcion || null,
      ubicacion_id: form.ubicacion_id || null,
      proveedor_id: form.proveedor_id || null,
      forma_pago: form.forma_pago,
      monto_total: parseFloat(form.monto_total),
      gastos: form.gastos ? parseFloat(form.gastos) : 0,
      notas: form.notas || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('compras').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('compras').insert(payload))
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

  // ─── FORM ─────────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView('list')} className="p-1 text-[var(--nm-text-muted)] hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[var(--nm-text)]">{editId ? 'Editar compra' : 'Nueva compra'}</h1>
        </div>

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
            <FormField label="Monto total (MXN)" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.monto_total}
                onChange={(e) => setForm((f) => ({ ...f, monto_total: e.target.value }))}
                required
              />
            </FormField>
          </div>

          <FormField label="¿Qué se compró?">
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
            <FormField label="Gastos extra (MXN)">
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.gastos}
                onChange={(e) => setForm((f) => ({ ...f, gastos: e.target.value }))}
              />
            </FormField>
          </div>

          <FormField label="Proveedor">
            <Select value={form.proveedor_id} onChange={(e) => setForm((f) => ({ ...f, proveedor_id: e.target.value }))}>
              <option value="">— Ninguno —</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </FormField>

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
          <div className="nm-inset p-3 flex flex-col gap-2 border border-gray-200">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--nm-text-muted)] mb-1 block">Desde</label>
                <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
              <div>
                <label className="text-xs text-[var(--nm-text-muted)] mb-1 block">Hasta</label>
                <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white" />
              </div>
            </div>
            <div>
              <label className="text-xs text-[var(--nm-text-muted)] mb-1 block">Forma de pago</label>
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

      {comprasFiltradas.length === 0 ? (
        hayFiltros
          ? <p className="text-sm text-[var(--nm-text-subtle)] py-8 text-center">Sin resultados para esta búsqueda</p>
          : <EmptyState message="No hay compras registradas" action={{ label: 'Registrar primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {comprasFiltradas.map((c) => (
            <div key={c.id} className="nm-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[var(--nm-text)]">{formatMxn(c.monto_total)}</p>
                      {c.numero_compra && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-mono">{c.numero_compra}</span>
                      )}
                    </div>
                    {c.descripcion && <p className="text-sm text-gray-700 mt-0.5">{c.descripcion}</p>}
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--nm-text-muted)]">
                      <span>{formatDate(c.fecha)}</span>
                      {((c.proveedores as { nombre: string } | null)?.nombre ?? (c.personas as { nombre: string } | null)?.nombre) && (
                        <span>{(c.proveedores as { nombre: string } | null)?.nombre ?? (c.personas as { nombre: string } | null)?.nombre}</span>
                      )}
                      <span className="capitalize">{c.forma_pago.replace('_', ' ')}</span>
                      {(c.ubicaciones as { nombre: string } | null)?.nombre && (
                        <span>{(c.ubicaciones as { nombre: string }).nombre}</span>
                      )}
                      {c.gastos ? <span>+{formatMxn(c.gastos)} gastos</span> : null}
                    </div>
                    {c.notas && <p className="text-xs text-[var(--nm-text-subtle)] mt-1 line-clamp-1">{c.notas}</p>}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-[var(--nm-bg-inset)]">
                <button onClick={() => openEdit(c)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Editar</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => handleDelete(c.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva compra"
      >
        +
      </button>
    </div>
  )
}
