'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import type { Gasto, Persona } from '@/lib/types/database.types'
import { logActivity } from '@/lib/activity-log'

const CATEGORIAS = [
  'flete', 'combustible', 'personal', 'arrendamiento',
  'comidas', 'dádivas', 'operativos', 'variados',
  'mantenimiento', 'servicios', 'otro',
]

const emptyForm = () => ({
  fecha: todayISO(),
  concepto: '',
  monto: '',
  categoria: 'otro',
  persona_id: '',
  chofer: '',
  notas: '',
})

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')
  const [showFiltros, setShowFiltros] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: gastosData }, { data: personasData }] = await Promise.all([
      supabase
        .from('gastos')
        .select('*, personas(nombre)')
        .order('fecha', { ascending: false })
        .limit(500),
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
    ])
    setGastos((gastosData ?? []) as Gasto[])
    setPersonas(personasData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(g: Gasto) {
    setEditId(g.id)
    setForm({
      fecha: g.fecha,
      concepto: g.concepto,
      monto: String(g.monto),
      categoria: g.categoria ?? 'otro',
      persona_id: g.persona_id ?? '',
      chofer: (g as Gasto & { chofer?: string }).chofer ?? '',
      notas: g.notas ?? '',
    })
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    const { error: delErr } = await supabase.from('gastos').delete().eq('id', id)
    if (delErr) { setError(`Error al eliminar: ${delErr.message}`); return }
    logActivity({ accion: 'eliminar', modulo: 'gastos', detalle: `Gasto eliminado`, registro_id: id })
    setGastos((gs) => gs.filter((g) => g.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || !form.monto || !form.concepto) {
      setError('Fecha, concepto y monto son requeridos')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      fecha: form.fecha,
      concepto: form.concepto,
      monto: parseFloat(form.monto),
      categoria: form.categoria || null,
      persona_id: form.persona_id || null,
      chofer: form.categoria === 'combustible' ? (form.chofer.trim() || null) : null,
      notas: form.notas || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('gastos').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('gastos').insert(payload))
    }

    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    logActivity({ accion: editId ? 'editar' : 'crear', modulo: 'gastos', detalle: `${form.concepto} — $${form.monto}` })

    setSaving(false)
    setView('list')
    loadData()
  }

  const totalMes = gastos
    .filter((g) => g.fecha.startsWith(todayISO().slice(0, 7)))
    .reduce((s, g) => s + g.monto, 0)

  const gastosFiltrados = useMemo(() => {
    let result = gastos
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter((g) =>
        g.concepto.toLowerCase().includes(q) ||
        (g.categoria ?? '').toLowerCase().includes(q) ||
        (g.notas ?? '').toLowerCase().includes(q) ||
        ((g as Gasto & { chofer?: string }).chofer ?? '').toLowerCase().includes(q) ||
        (g.personas as { nombre: string } | null)?.nombre?.toLowerCase().includes(q)
      )
    }
    if (filtroCategoria) result = result.filter((g) => g.categoria === filtroCategoria)
    if (filtroDesde) result = result.filter((g) => g.fecha >= filtroDesde)
    if (filtroHasta) result = result.filter((g) => g.fecha <= filtroHasta)
    return result
  }, [gastos, busqueda, filtroCategoria, filtroDesde, filtroHasta])

  const hayFiltros = busqueda || filtroCategoria || filtroDesde || filtroHasta
  function limpiarFiltros() {
    setBusqueda(''); setFiltroCategoria(''); setFiltroDesde(''); setFiltroHasta('')
  }

  if (loading) return <Spinner color="red" fullPage />

  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title={editId ? 'Editar gasto' : 'Nuevo gasto'} onBack={() => setView('list')} />

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
            </FormField>
            <FormField label="Monto (MXN)" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                required
              />
            </FormField>
          </div>

          <FormField label="Concepto" required>
            <Input
              type="text"
              placeholder="Ej. Flete de aguacate, combustible"
              value={form.concepto}
              onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Categoría">
              <Select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value, chofer: '' }))}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Persona (pagada a)">
              <Select value={form.persona_id} onChange={(e) => setForm((f) => ({ ...f, persona_id: e.target.value }))}>
                <option value="">— Ninguna —</option>
                {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            </FormField>
          </div>

          {form.categoria === 'combustible' && (
            <FormField label="Chofer">
              <Input
                type="text"
                placeholder="Nombre del chofer"
                value={form.chofer}
                onChange={(e) => setForm((f) => ({ ...f, chofer: e.target.value }))}
              />
            </FormField>
          )}

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
        title="Gastos"
        subtitle={hayFiltros ? `${gastosFiltrados.length} de ${gastos.length}` : `${gastos.length} registros`}
        action={{ label: 'Nuevo gasto', onClick: openNew }}
      />
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {/* Búsqueda + Filtros */}
      <div className="mb-4 flex flex-col gap-2">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)] pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
            </svg>
            <input
              type="text"
              placeholder="Buscar concepto, persona, notas..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white"
            />
          </div>
          <button
            onClick={() => setShowFiltros((v) => !v)}
            className={`relative px-3 py-2 text-sm rounded-xl border font-medium transition-colors ${showFiltros ? 'bg-red-500 text-white border-red-500' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z"/></svg>
            {(filtroCategoria || filtroDesde || filtroHasta) && (
              <span className={`absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full text-[10px] font-bold flex items-center justify-center ${showFiltros ? 'bg-white text-red-500' : 'bg-red-500 text-white'}`}>
                {[filtroCategoria, filtroDesde, filtroHasta].filter(Boolean).length}
              </span>
            )}
          </button>
        </div>

        {/* Categorías rápidas */}
        <div className="flex gap-1.5 flex-wrap">
          {(['', ...CATEGORIAS] as const).map((cat) => (
            <button
              key={cat}
              onClick={() => setFiltroCategoria(cat)}
              className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors capitalize ${
                filtroCategoria === cat
                  ? 'bg-red-500 text-white border-red-500'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
              }`}
            >
              {cat || 'Todos'}
            </button>
          ))}
        </div>

        {showFiltros && (
          <div className="bg-white border border-gray-200 rounded-xl p-3 flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-[var(--nm-text-subtle)] mb-1 block">Desde</label>
                <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
              </div>
              <div>
                <label className="text-xs text-[var(--nm-text-subtle)] mb-1 block">Hasta</label>
                <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
              </div>
            </div>
            {hayFiltros && (
              <button onClick={limpiarFiltros} className="self-end text-xs text-red-500 hover:underline">Limpiar filtros</button>
            )}
          </div>
        )}
      </div>

      {/* Resumen del mes */}
      {gastos.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-red-700 font-medium">Total este mes</p>
          <p className="text-base font-bold text-red-700">{formatMxn(totalMes)}</p>
        </div>
      )}

      {gastosFiltrados.length === 0 ? (
        hayFiltros
          ? <p className="text-sm text-[var(--nm-text-subtle)] py-8 text-center">Sin resultados para esta búsqueda</p>
          : <EmptyState message="No hay gastos registrados" action={{ label: 'Registrar primero', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {gastosFiltrados.map((g) => (
            <div key={g.id} className="nm-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[var(--nm-text)]">{g.concepto}</p>
                      {g.categoria && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                          {g.categoria}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--nm-text-muted)]">
                      <span>{formatDate(g.fecha)}</span>
                      {(g.personas as { nombre: string } | null)?.nombre && (
                        <span>{(g.personas as { nombre: string }).nombre}</span>
                      )}
                      {(g as Gasto & { chofer?: string }).chofer && (
                        <span className="flex items-center gap-1">
                          <span>🚗</span>
                          {(g as Gasto & { chofer?: string }).chofer}
                        </span>
                      )}
                    </div>
                    {g.notas && <p className="text-xs text-[var(--nm-text-subtle)] mt-1 line-clamp-1">{g.notas}</p>}
                  </div>
                  <p className="font-semibold text-red-600 whitespace-nowrap">{formatMxn(g.monto)}</p>
                </div>
              </div>
              <div className="flex border-t border-[var(--nm-bg-inset)]">
                <button onClick={() => openEdit(g)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Editar</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => handleDelete(g.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nuevo gasto"
      >
        +
      </button>
    </div>
  )
}
