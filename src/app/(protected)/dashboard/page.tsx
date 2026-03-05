'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, monthRange, generateNumeroCompra, generateNumeroVenta } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import type { Compra, Venta, Persona, Ubicacion, FormaPago } from '@/lib/types/database.types'

interface Stats {
  totalCompras: number
  totalVentas: number
  totalGastos: number
}

type QuickType = 'compra' | 'venta' | null

interface EditTarget {
  type: 'compra' | 'venta'
  id: string
}

const FORMAS_PAGO: { value: FormaPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'bonos_gasolina', label: 'Bonos gasolina' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'otro', label: 'Otro' },
]

const emptyForm = (type: 'compra' | 'venta' | null = null) => ({
  numero_folio: type === 'compra' ? generateNumeroCompra() : type === 'venta' ? generateNumeroVenta() : '',
  fecha: new Date().toISOString().split('T')[0],
  persona_id: '',
  ubicacion_id: '',
  forma_pago: 'efectivo' as FormaPago,
  monto: '',
  notas: '',
})

export default function DashboardPage() {
  const [mesOffset, setMesOffset] = useState(0)
  const [stats, setStats] = useState<Stats>({ totalCompras: 0, totalVentas: 0, totalGastos: 0 })
  const [compras, setCompras] = useState<Compra[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)

  const [quickType, setQuickType] = useState<QuickType>(null)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [quickError, setQuickError] = useState('')

  const [form, setForm] = useState(emptyForm())

  const { inicio, fin, label: mesLabel } = monthRange(mesOffset)

  const loadData = useCallback(async (offset: number) => {
    const { inicio: ini, fin: fi } = monthRange(offset)

    const [
      { data: comprasData },
      { data: ventasData },
      { data: gastosData },
      { data: personasData },
      { data: ubicData },
    ] = await Promise.all([
      supabase
        .from('compras')
        .select('*, personas(nombre), ubicaciones(nombre)')
        .gte('fecha', ini)
        .lte('fecha', fi)
        .order('fecha', { ascending: false })
        .limit(10),
      supabase
        .from('ventas')
        .select('*, personas(nombre), ubicaciones(nombre)')
        .gte('fecha', ini)
        .lte('fecha', fi)
        .order('fecha', { ascending: false })
        .limit(10),
      supabase
        .from('gastos')
        .select('monto')
        .gte('fecha', ini)
        .lte('fecha', fi),
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre'),
    ])

    const totalC = (comprasData ?? []).reduce((s, r) => s + (r.monto_total ?? 0), 0)
    const totalV = (ventasData ?? []).reduce((s, r) => s + (r.monto_total ?? 0), 0)
    const totalG = (gastosData ?? []).reduce((s, r) => s + (r.monto ?? 0), 0)

    setStats({ totalCompras: totalC, totalVentas: totalV, totalGastos: totalG })
    setCompras((comprasData ?? []) as Compra[])
    setVentas((ventasData ?? []) as Venta[])
    setPersonas(personasData ?? [])
    setUbicaciones(ubicData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => {
    setLoading(true)
    loadData(mesOffset)
  }, [mesOffset, loadData])

  function openQuick(type: QuickType) {
    setQuickType(type)
    setEditTarget(null)
    setShowFabMenu(false)
    setQuickError('')
    setForm(emptyForm(type))
  }

  function openEdit(type: 'compra' | 'venta', record: Compra | Venta) {
    setQuickType(type)
    setEditTarget({ type, id: record.id })
    setShowFabMenu(false)
    setQuickError('')
    const folio = type === 'compra'
      ? (record as Compra).numero_compra ?? ''
      : (record as Venta).numero_venta ?? ''
    setForm({
      numero_folio: folio,
      fecha: record.fecha,
      persona_id: record.persona_id ?? '',
      ubicacion_id: record.ubicacion_id ?? '',
      forma_pago: record.forma_pago,
      monto: String(record.monto_total),
      notas: record.notas ?? '',
    })
  }

  function closeSheet() {
    setQuickType(null)
    setEditTarget(null)
    setQuickError('')
  }

  async function handleDelete(type: 'compra' | 'venta', id: string) {
    if (!confirm('¿Eliminar este registro? Esta acción no se puede deshacer.')) return
    setDeleting(id)
    const table = type === 'compra' ? 'compras' : 'ventas'
    const { error } = await supabase.from(table).delete().eq('id', id)
    setDeleting(null)
    if (error) { alert('Error al eliminar. Intenta de nuevo.'); return }
    setLoading(true)
    loadData(mesOffset)
  }

  async function handleQuickSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.monto || !form.fecha) { setQuickError('Fecha y monto son requeridos'); return }
    setSaving(true)
    setQuickError('')

    const isCompra = quickType === 'compra'
    const folioKey = isCompra ? 'numero_compra' : 'numero_venta'
    const folioVal = form.numero_folio || (isCompra ? generateNumeroCompra() : generateNumeroVenta())

    const payload = {
      [folioKey]: folioVal,
      fecha: form.fecha,
      persona_id: form.persona_id || null,
      ubicacion_id: form.ubicacion_id || null,
      forma_pago: form.forma_pago,
      monto_total: parseFloat(form.monto),
      notas: form.notas || null,
    }

    const table = isCompra ? 'compras' : 'ventas'
    let error: { message: string } | null = null

    if (editTarget) {
      const res = await supabase.from(table).update(payload).eq('id', editTarget.id)
      error = res.error
    } else {
      const res = await supabase.from(table).insert(payload)
      error = res.error
    }

    if (error) { setQuickError('Error al guardar. Inténtalo de nuevo.'); setSaving(false); return }

    closeSheet()
    setSaving(false)
    setLoading(true)
    loadData(mesOffset)
  }

  const utilidad = stats.totalVentas - stats.totalCompras - stats.totalGastos

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Encabezado con selector de mes */}
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-gray-900 capitalize">{mesLabel}</h1>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMesOffset((o) => o + 1)}
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
            aria-label="Mes anterior"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {mesOffset > 0 && (
            <button
              onClick={() => setMesOffset(0)}
              className="px-2 py-1 text-xs text-green-700 font-medium hover:underline"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => setMesOffset((o) => Math.max(0, o - 1))}
            className={`p-2 rounded-lg transition-colors ${mesOffset === 0 ? 'text-gray-200 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-100'}`}
            disabled={mesOffset === 0}
            aria-label="Mes siguiente"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Compras</p>
          <p className="text-xl font-bold text-gray-900 mt-1">{formatMxn(stats.totalCompras)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Ventas</p>
          <p className="text-xl font-bold text-green-700 mt-1">{formatMxn(stats.totalVentas)}</p>
        </div>
        <div className="bg-white rounded-2xl p-4 border border-gray-200 shadow-sm">
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Gastos</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatMxn(stats.totalGastos)}</p>
        </div>
        <div className={`rounded-2xl p-4 border shadow-sm ${utilidad >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Utilidad</p>
          <p className={`text-xl font-bold mt-1 ${utilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>
            {formatMxn(utilidad)}
          </p>
        </div>
      </div>

      {/* Últimas compras */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Últimas compras</h2>
          <button onClick={() => openQuick('compra')} className="text-xs text-green-700 font-medium hover:underline">+ Agregar</button>
        </div>
        {compras.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin compras en {mesLabel}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {compras.map((c) => (
              <div key={c.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{(c.personas as { nombre: string } | null)?.nombre ?? '—'}</p>
                      {c.numero_compra && <span className="text-xs font-mono text-gray-400">{c.numero_compra}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(c.fecha)} · {c.forma_pago.replace('_', ' ')}</p>
                    {c.descripcion && <p className="text-xs text-gray-500 mt-0.5">{c.descripcion}</p>}
                  </div>
                  <span className="text-sm font-semibold text-gray-700">{formatMxn(c.monto_total)}</span>
                </div>
                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => openEdit('compra', c)}
                    className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Editar
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button
                    onClick={() => handleDelete('compra', c.id)}
                    disabled={deleting === c.id}
                    className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deleting === c.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Últimas ventas */}
      <section className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Últimas ventas</h2>
          <button onClick={() => openQuick('venta')} className="text-xs text-green-700 font-medium hover:underline">+ Agregar</button>
        </div>
        {ventas.length === 0 ? (
          <p className="text-sm text-gray-400 py-4 text-center">Sin ventas en {mesLabel}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {ventas.map((v) => (
              <div key={v.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="p-3 flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium text-gray-900">{(v.personas as { nombre: string } | null)?.nombre ?? '—'}</p>
                      {v.numero_venta && <span className="text-xs font-mono text-gray-400">{v.numero_venta}</span>}
                    </div>
                    <p className="text-xs text-gray-400">{formatDate(v.fecha)} · {v.forma_pago.replace('_', ' ')}</p>
                    {v.notas && <p className="text-xs text-gray-500 mt-0.5 italic">{v.notas}</p>}
                  </div>
                  <span className="text-sm font-semibold text-green-700">{formatMxn(v.monto_total)}</span>
                </div>
                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => openEdit('venta', v)}
                    className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors"
                  >
                    Editar
                  </button>
                  <div className="w-px bg-gray-100" />
                  <button
                    onClick={() => handleDelete('venta', v.id)}
                    disabled={deleting === v.id}
                    className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors disabled:opacity-40"
                  >
                    {deleting === v.id ? '...' : 'Eliminar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-30 md:bottom-6 md:right-6 flex flex-col items-end gap-2">
        {showFabMenu && (
          <>
            <button
              onClick={() => openQuick('venta')}
              className="flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <span className="w-2 h-2 rounded-full bg-green-500" />
              Registrar venta
            </button>
            <button
              onClick={() => openQuick('compra')}
              className="flex items-center gap-2 bg-white border border-gray-200 shadow-lg rounded-full pl-4 pr-5 py-2.5 text-sm font-medium text-gray-800 hover:bg-gray-50"
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Registrar compra
            </button>
          </>
        )}
        <button
          onClick={() => setShowFabMenu((v) => !v)}
          className="w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl transition-all active:scale-95"
          aria-label="Agregar registro"
        >
          {showFabMenu ? '✕' : '+'}
        </button>
      </div>

      {/* Quick add / edit bottom sheet */}
      {quickType && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40" onClick={closeSheet}>
          <div
            className="bg-white rounded-t-2xl w-full max-w-lg p-5 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900 text-base">
                {editTarget
                  ? `Editar ${quickType === 'compra' ? 'compra' : 'venta'}`
                  : quickType === 'compra' ? 'Registrar compra' : 'Registrar venta'}
              </h2>
              <button onClick={closeSheet} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <form onSubmit={handleQuickSave} className="flex flex-col gap-3">
              {quickError && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{quickError}</p>
              )}

              <FormField label="Folio">
                <Input
                  type="text"
                  value={form.numero_folio}
                  onChange={(e) => setForm((f) => ({ ...f, numero_folio: e.target.value }))}
                  placeholder="Auto-generado"
                />
              </FormField>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Fecha" required>
                  <Input
                    type="date"
                    value={form.fecha}
                    onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                    required
                  />
                </FormField>
                <FormField label="Monto (MXN)" required>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="0.00"
                    value={form.monto}
                    onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                    required
                  />
                </FormField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <FormField label="Persona">
                  <Select value={form.persona_id} onChange={(e) => setForm((f) => ({ ...f, persona_id: e.target.value }))}>
                    <option value="">— Ninguna —</option>
                    {personas.map((p) => (
                      <option key={p.id} value={p.id}>{p.nombre}</option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Forma de pago">
                  <Select value={form.forma_pago} onChange={(e) => setForm((f) => ({ ...f, forma_pago: e.target.value as FormaPago }))}>
                    {FORMAS_PAGO.map((fp) => (
                      <option key={fp.value} value={fp.value}>{fp.label}</option>
                    ))}
                  </Select>
                </FormField>
              </div>

              <FormField label="Ubicación">
                <Select value={form.ubicacion_id} onChange={(e) => setForm((f) => ({ ...f, ubicacion_id: e.target.value }))}>
                  <option value="">— Ninguna —</option>
                  {ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>{u.nombre}</option>
                  ))}
                </Select>
              </FormField>

              <FormField label="Notas">
                <Textarea
                  placeholder="Observaciones opcionales..."
                  value={form.notas}
                  onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                />
              </FormField>

              <div className="flex gap-2 pt-1">
                <Btn type="button" variant="secondary" onClick={closeSheet} className="flex-1">
                  Cancelar
                </Btn>
                <Btn type="submit" loading={saving} className="flex-1">
                  {editTarget ? 'Guardar cambios' : 'Guardar'}
                </Btn>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
