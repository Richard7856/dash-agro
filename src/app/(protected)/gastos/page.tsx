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
  'mantenimiento', 'servicios', 'consumos internos', 'otro',
]

type Periodo = 'semana' | 'mes' | 'trimestre' | 'año' | 'personalizado'

function toISO(d: Date) {
  return d.toISOString().slice(0, 10)
}

function getRango(periodo: Periodo, customDesde: string, customHasta: string) {
  const hoy = new Date()
  if (periodo === 'semana') {
    const day = hoy.getDay() === 0 ? 7 : hoy.getDay()
    const lun = new Date(hoy); lun.setDate(hoy.getDate() - day + 1)
    const dom = new Date(hoy); dom.setDate(hoy.getDate() - day + 7)
    return { desde: toISO(lun), hasta: toISO(dom) }
  }
  if (periodo === 'mes') {
    const first = new Date(hoy.getFullYear(), hoy.getMonth(), 1)
    const last = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0)
    return { desde: toISO(first), hasta: toISO(last) }
  }
  if (periodo === 'trimestre') {
    const q = Math.floor(hoy.getMonth() / 3)
    const first = new Date(hoy.getFullYear(), q * 3, 1)
    const last = new Date(hoy.getFullYear(), q * 3 + 3, 0)
    return { desde: toISO(first), hasta: toISO(last) }
  }
  if (periodo === 'año') {
    return { desde: `${hoy.getFullYear()}-01-01`, hasta: `${hoy.getFullYear()}-12-31` }
  }
  return { desde: customDesde, hasta: customHasta }
}

function getPeriodoAnterior(desde: string, hasta: string) {
  const d1 = new Date(desde + 'T00:00:00')
  const d2 = new Date(hasta + 'T00:00:00')
  const dur = d2.getTime() - d1.getTime() + 86400000
  const newHasta = new Date(d1.getTime() - 86400000)
  const newDesde = new Date(d1.getTime() - dur)
  return { desde: toISO(newDesde), hasta: toISO(newHasta) }
}

function calcTotalesPorCategoria(gastos: Gasto[], desde: string, hasta: string) {
  const map: Record<string, number> = {}
  gastos.forEach(g => {
    if (g.fecha >= desde && g.fecha <= hasta) {
      const cat = g.categoria ?? 'otro'
      map[cat] = (map[cat] ?? 0) + g.monto
    }
  })
  return map
}

const PERIODO_LABELS: Record<Periodo, string> = {
  semana: 'Esta semana',
  mes: 'Este mes',
  trimestre: 'Este trimestre',
  año: 'Este año',
  personalizado: 'Personalizado',
}

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
  const [tab, setTab] = useState<'lista' | 'resumen'>('lista')
  // Resumen states
  const [periodo, setPeriodo] = useState<Periodo>('mes')
  const [customDesde, setCustomDesde] = useState('')
  const [customHasta, setCustomHasta] = useState('')
  const [comparar, setComparar] = useState(false)
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
      chofer: g.chofer ?? '',
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
        (g.chofer ?? '').toLowerCase().includes(q) ||
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

  // Resumen calculado
  const rangoActual = getRango(periodo, customDesde, customHasta)
  const totalesActual = useMemo(
    () => calcTotalesPorCategoria(gastos, rangoActual.desde, rangoActual.hasta),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gastos, rangoActual.desde, rangoActual.hasta]
  )
  const rangoAnterior = getPeriodoAnterior(rangoActual.desde, rangoActual.hasta)
  const totalesAnterior = useMemo(
    () => comparar ? calcTotalesPorCategoria(gastos, rangoAnterior.desde, rangoAnterior.hasta) : {},
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [gastos, rangoAnterior.desde, rangoAnterior.hasta, comparar]
  )
  const totalActual = Object.values(totalesActual).reduce((s, v) => s + v, 0)
  const totalAnterior = Object.values(totalesAnterior).reduce((s, v) => s + v, 0)
  const catOrdenadas = CATEGORIAS.filter(c => (totalesActual[c] ?? 0) > 0 || (totalesAnterior[c] ?? 0) > 0)
  const maxVal = Math.max(...catOrdenadas.map(c => Math.max(totalesActual[c] ?? 0, totalesAnterior[c] ?? 0)), 1)

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
        subtitle={tab === 'lista' ? (hayFiltros ? `${gastosFiltrados.length} de ${gastos.length}` : `${gastos.length} registros`) : undefined}
        action={{ label: 'Nuevo gasto', onClick: openNew }}
      />
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {/* Tabs Lista / Resumen */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {(['lista', 'resumen'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'lista' ? 'Lista' : '📊 Resumen'}
          </button>
        ))}
      </div>

      {/* ── VISTA RESUMEN ───────────────────────────────────────── */}
      {tab === 'resumen' && (
        <div>
          {/* Selector de período */}
          <div className="flex gap-1.5 flex-wrap mb-3">
            {(Object.keys(PERIODO_LABELS) as Periodo[]).map(p => (
              <button
                key={p}
                onClick={() => setPeriodo(p)}
                className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                  periodo === p
                    ? 'bg-red-500 text-white border-red-500'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-red-300'
                }`}
              >
                {PERIODO_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Fechas personalizadas */}
          {periodo === 'personalizado' && (
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Desde</label>
                <input type="date" value={customDesde} onChange={e => setCustomDesde(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Hasta</label>
                <input type="date" value={customHasta} onChange={e => setCustomHasta(e.target.value)}
                  className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400 bg-white" />
              </div>
            </div>
          )}

          {/* Rango activo + toggle comparar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-gray-400">
              {rangoActual.desde} → {rangoActual.hasta}
            </p>
            <button
              onClick={() => setComparar(v => !v)}
              className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${
                comparar ? 'bg-blue-500 text-white border-blue-500' : 'bg-white text-gray-500 border-gray-200 hover:border-blue-300'
              }`}
            >
              {comparar ? '✓ Comparando' : 'Comparar período anterior'}
            </button>
          </div>

          {/* Período anterior info */}
          {comparar && (
            <p className="text-xs text-gray-400 mb-3 -mt-2">
              Anterior: {rangoAnterior.desde} → {rangoAnterior.hasta}
            </p>
          )}

          {/* Totales generales */}
          <div className={`grid gap-3 mb-4 ${comparar ? 'grid-cols-2' : 'grid-cols-1'}`}>
            <div className="bg-red-50 border border-red-100 rounded-xl p-3">
              <p className="text-xs text-red-500 font-medium mb-0.5">
                {comparar ? 'Período actual' : 'Total período'}
              </p>
              <p className="text-xl font-bold text-red-700">{formatMxn(totalActual)}</p>
              <p className="text-xs text-red-400 mt-0.5">{catOrdenadas.filter(c => totalesActual[c]).length} categorías</p>
            </div>
            {comparar && (
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3">
                <p className="text-xs text-gray-500 font-medium mb-0.5">Período anterior</p>
                <p className="text-xl font-bold text-gray-700">{formatMxn(totalAnterior)}</p>
                {totalAnterior > 0 && (
                  <p className={`text-xs font-medium mt-0.5 ${totalActual > totalAnterior ? 'text-red-500' : 'text-green-600'}`}>
                    {totalActual > totalAnterior ? '▲' : '▼'}{' '}
                    {Math.abs(((totalActual - totalAnterior) / totalAnterior) * 100).toFixed(1)}% vs anterior
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Barras por categoría */}
          {catOrdenadas.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">Sin gastos en este período</p>
          ) : (
            <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] overflow-hidden">
              {catOrdenadas
                .sort((a, b) => (totalesActual[b] ?? 0) - (totalesActual[a] ?? 0))
                .map((cat, i) => {
                  const va = totalesActual[cat] ?? 0
                  const vb = totalesAnterior[cat] ?? 0
                  const pctA = (va / maxVal) * 100
                  const pctB = (vb / maxVal) * 100
                  const diff = vb > 0 ? ((va - vb) / vb) * 100 : null
                  return (
                    <div key={cat} className={`p-3 ${i < catOrdenadas.length - 1 ? 'border-b border-gray-100' : ''}`}>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-medium text-gray-700 capitalize">{cat}</span>
                        <div className="text-right">
                          <span className="text-sm font-bold text-gray-900">{formatMxn(va)}</span>
                          {comparar && vb > 0 && (
                            <span className={`ml-2 text-xs font-medium ${va > vb ? 'text-red-500' : 'text-green-600'}`}>
                              {va > vb ? '▲' : '▼'}{Math.abs(diff!).toFixed(0)}%
                            </span>
                          )}
                        </div>
                      </div>
                      {/* Barra actual */}
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-1">
                        <div
                          className="h-full bg-red-400 rounded-full transition-all duration-500"
                          style={{ width: `${pctA}%` }}
                        />
                      </div>
                      {/* Barra anterior */}
                      {comparar && (
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-300 rounded-full transition-all duration-500"
                            style={{ width: `${pctB}%` }}
                          />
                        </div>
                      )}
                      {comparar && vb > 0 && (
                        <p className="text-xs text-gray-400 mt-1">Anterior: {formatMxn(vb)}</p>
                      )}
                    </div>
                  )
                })}
            </div>
          )}

          {/* Leyenda */}
          {comparar && catOrdenadas.length > 0 && (
            <div className="flex gap-4 mt-3 text-xs text-gray-400">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-2 bg-red-400 rounded-full inline-block" />
                Período actual
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-1.5 bg-blue-300 rounded-full inline-block" />
                Período anterior
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── VISTA LISTA ─────────────────────────────────────────── */}
      {tab === 'lista' && (<>

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
                      {g.chofer && (
                        <span className="flex items-center gap-1">
                          <span>🚗</span>
                          {g.chofer}
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
      </>)}
    </div>
  )
}
