'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, monthRange, generateNumeroCompra, generateNumeroVenta, formatFormaPago } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { FORMAS_PAGO } from '@/lib/constants'
import type { Compra, Venta, Ubicacion, FormaPago } from '@/lib/types/database.types'

// Charts loaded client-only (Recharts doesn't support SSR)
const WeeklyChart = dynamic(() => import('@/components/dashboard/WeeklyChart'), { ssr: false })
const PaymentPieChart = dynamic(() => import('@/components/dashboard/PaymentPieChart'), { ssr: false })

// Local minimal interfaces (dashboard only selects id + nombre for dropdowns)
interface ClienteDropdown { id: string; nombre: string }
interface ProveedorDropdown { id: string; nombre: string }

interface Stats {
  totalCompras: number
  totalVentas: number
  totalGastos: number
  valorInventario: number
}

interface AlertaStock {
  id: string
  nombre_producto: string
  cantidad: number
  stock_minimo: number
  unidad_medida: string
  fecha_caducidad: string | null
}

interface WeeklyEntry {
  semana: string
  ventas: number
  compras: number
}

interface PaymentEntry {
  name: string
  value: number
}

type QuickType = 'compra' | 'venta' | null

interface EditTarget {
  type: 'compra' | 'venta'
  id: string
}

const emptyForm = (type: 'compra' | 'venta' | null = null) => ({
  numero_folio: type === 'compra' ? generateNumeroCompra() : type === 'venta' ? generateNumeroVenta() : '',
  fecha: new Date().toISOString().split('T')[0],
  cliente_id: '',
  proveedor_id: '',
  ubicacion_id: '',
  forma_pago: 'efectivo' as FormaPago,
  monto: '',
  notas: '',
})

/** Return ISO week string "Sem N" for a date */
function isoWeekLabel(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00')
  const thursday = new Date(d)
  thursday.setDate(d.getDate() - ((d.getDay() + 6) % 7) + 3)
  const firstThursday = new Date(thursday.getFullYear(), 0, 4)
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / 604800000)
  return `Sem ${week}`
}

/** Group array of {fecha, monto_total} by ISO week label */
function groupByWeek(rows: { fecha: string; monto_total: number }[]) {
  const map: Record<string, number> = {}
  for (const r of rows) {
    const label = isoWeekLabel(r.fecha)
    map[label] = (map[label] ?? 0) + r.monto_total
  }
  return map
}

export default function DashboardPage() {
  const [mesOffset, setMesOffset] = useState(0)
  const [stats, setStats] = useState<Stats>({ totalCompras: 0, totalVentas: 0, totalGastos: 0, valorInventario: 0 })
  const [weeklyData, setWeeklyData] = useState<WeeklyEntry[]>([])
  const [paymentData, setPaymentData] = useState<PaymentEntry[]>([])
  const [compras, setCompras] = useState<Compra[]>([])
  const [ventas, setVentas] = useState<Venta[]>([])
  const [clientes, setClientes] = useState<ClienteDropdown[]>([])
  const [proveedores, setProveedores] = useState<ProveedorDropdown[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [alertasStock, setAlertasStock] = useState<AlertaStock[]>([])
  const [alertasCaducidad, setAlertasCaducidad] = useState<AlertaStock[]>([])
  const [alertasLotes, setAlertasLotes] = useState<{ id: string; numero_lote: string; fecha_caducidad: string; cantidad_actual: number; producto: string; unidad: string }[]>([])
  const [loading, setLoading] = useState(true)

  const [quickType, setQuickType] = useState<QuickType>(null)
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [showFabMenu, setShowFabMenu] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [quickError, setQuickError] = useState('')
  const [form, setForm] = useState(emptyForm())

  const { label: mesLabel } = monthRange(mesOffset)

  const loadData = useCallback(async (offset: number) => {
    const { inicio: ini, fin: fi } = monthRange(offset)

    // Date 42 days ago for weekly chart
    const hace42 = new Date()
    hace42.setDate(hace42.getDate() - 42)
    const hace42str = hace42.toISOString().split('T')[0]

    const today = new Date().toISOString().split('T')[0]
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]

    const [
      { data: comprasData },
      { data: ventasData },
      { data: gastosData },
      { data: clientesData },
      { data: proveedoresData },
      { data: ubicData },
      { data: inventarioData },
      { data: ventasSemana },
      { data: comprasSemana },
      { data: stockBajoData },
      { data: caducidadData },
      { data: lotesData },
    ] = await Promise.all([
      supabase
        .from('compras')
        .select('*, proveedores(nombre), personas(nombre), ubicaciones(nombre)')
        .gte('fecha', ini)
        .lte('fecha', fi)
        .order('fecha', { ascending: false })
        .limit(10),
      supabase
        .from('ventas')
        .select('*, clientes(nombre), personas(nombre), ubicaciones(nombre)')
        .gte('fecha', ini)
        .lte('fecha', fi)
        .order('fecha', { ascending: false })
        .limit(10),
      supabase
        .from('gastos')
        .select('monto')
        .gte('fecha', ini)
        .lte('fecha', fi),
      supabase.from('clientes').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('id, nombre').eq('activo', true).order('nombre'),
      supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre'),
      supabase.from('inventario_registros').select('precio_compra_total'),
      supabase
        .from('ventas')
        .select('fecha, monto_total')
        .gte('fecha', hace42str)
        .order('fecha', { ascending: true }),
      supabase
        .from('compras')
        .select('fecha, monto_total')
        .gte('fecha', hace42str)
        .order('fecha', { ascending: true }),
      supabase
        .from('inventario_registros')
        .select('id, nombre_producto, cantidad, stock_minimo, unidad_medida, fecha_caducidad')
        .gt('stock_minimo', 0)
        .order('nombre_producto')
        .limit(100),
      supabase
        .from('inventario_registros')
        .select('id, nombre_producto, cantidad, stock_minimo, unidad_medida, fecha_caducidad')
        .lte('fecha_caducidad', soon)
        .gte('fecha_caducidad', today)
        .order('fecha_caducidad', { ascending: true })
        .limit(5),
      supabase
        .from('inventario_lotes')
        .select('id, numero_lote, fecha_caducidad, cantidad_actual, inventario_registros(nombre_producto, unidad_medida)')
        .eq('status', 'activo')
        .not('fecha_caducidad', 'is', null)
        .lte('fecha_caducidad', soon)
        .gte('fecha_caducidad', today)
        .order('fecha_caducidad', { ascending: true })
        .limit(10),
    ])

    const totalC = (comprasData ?? []).reduce((s, r) => s + (r.monto_total ?? 0), 0)
    const totalV = (ventasData ?? []).reduce((s, r) => s + (r.monto_total ?? 0), 0)
    const totalG = (gastosData ?? []).reduce((s, r) => s + (r.monto ?? 0), 0)
    const valorInv = (inventarioData ?? []).reduce((s, r) => s + (r.precio_compra_total ?? 0), 0)

    setStats({ totalCompras: totalC, totalVentas: totalV, totalGastos: totalG, valorInventario: valorInv })
    setCompras((comprasData ?? []) as Compra[])
    setVentas((ventasData ?? []) as Venta[])
    setClientes(clientesData ?? [])
    setProveedores(proveedoresData ?? [])
    setUbicaciones(ubicData ?? [])
    // Alertas: filtrar client-side para columna vs columna
    setAlertasStock(((stockBajoData ?? []) as AlertaStock[]).filter((r) => r.cantidad <= r.stock_minimo).slice(0, 5))
    setAlertasCaducidad((caducidadData ?? []) as AlertaStock[])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setAlertasLotes((lotesData ?? []).map((l: any) => ({
      id: l.id,
      numero_lote: l.numero_lote,
      fecha_caducidad: l.fecha_caducidad,
      cantidad_actual: l.cantidad_actual,
      producto: l.inventario_registros?.nombre_producto ?? 'Producto',
      unidad: l.inventario_registros?.unidad_medida ?? '',
    })))

    // Build weekly chart data (last 6 unique weeks)
    const ventasMap = groupByWeek((ventasSemana ?? []) as { fecha: string; monto_total: number }[])
    const comprasMap = groupByWeek((comprasSemana ?? []) as { fecha: string; monto_total: number }[])
    const allWeeks = Array.from(new Set([...Object.keys(ventasMap), ...Object.keys(comprasMap)]))
      .sort((a, b) => {
        const na = parseInt(a.replace('Sem ', ''))
        const nb = parseInt(b.replace('Sem ', ''))
        return na - nb
      })
      .slice(-6)
    setWeeklyData(allWeeks.map((w) => ({ semana: w, ventas: ventasMap[w] ?? 0, compras: comprasMap[w] ?? 0 })))

    // Build payment pie data from monthly ventas
    const payMap: Record<string, number> = {}
    for (const v of (ventasData ?? [])) {
      const fp = v.forma_pago ? formatFormaPago(v.forma_pago) : 'Otro'
      payMap[fp] = (payMap[fp] ?? 0) + (v.monto_total ?? 0)
    }
    setPaymentData(Object.entries(payMap).map(([name, value]) => ({ name, value })))

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
      cliente_id: (record as Venta).cliente_id ?? '',
      proveedor_id: (record as Compra).proveedor_id ?? '',
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
    const { error } = await supabase.from(type === 'compra' ? 'compras' : 'ventas').delete().eq('id', id)
    setDeleting(null)
    if (error) { alert('Error al eliminar.'); return }
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
      ...(isCompra
        ? { proveedor_id: form.proveedor_id || null }
        : { cliente_id: form.cliente_id || null }
      ),
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

    if (error) { setQuickError('Error al guardar.'); setSaving(false); return }
    closeSheet()
    setSaving(false)
    setLoading(true)
    loadData(mesOffset)
  }

  const utilidad = stats.totalVentas - stats.totalCompras - stats.totalGastos

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen nm-page">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const kpis = [
    { label: 'Ventas', value: formatMxn(stats.totalVentas), variant: 'nm-card-sm', textColor: 'text-[var(--nm-accent)]' },
    { label: 'Compras', value: formatMxn(stats.totalCompras), variant: 'nm-card-sm', textColor: 'text-[var(--nm-text)]' },
    { label: 'Gastos', value: formatMxn(stats.totalGastos), variant: 'nm-card-sm', textColor: 'text-red-600' },
    { label: 'Utilidad', value: formatMxn(utilidad), variant: utilidad >= 0 ? 'nm-card-green' : 'nm-card-red', textColor: utilidad >= 0 ? 'text-blue-800' : 'text-red-700' },
    { label: 'Inventario', value: formatMxn(stats.valorInventario), variant: 'nm-card-sm', textColor: 'text-[var(--nm-text-muted)]' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-[var(--nm-text)] capitalize">{mesLabel}</h1>
          <p className="text-xs text-[var(--nm-text-subtle)] mt-0.5">Resumen operativo</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setMesOffset((o) => o + 1)}
            className="nm-btn w-9 h-9 flex items-center justify-center text-[var(--nm-text-muted)]"
            aria-label="Mes anterior"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          {mesOffset > 0 && (
            <button
              onClick={() => setMesOffset(0)}
              className="px-2 py-1 text-xs text-[var(--nm-accent)] font-medium hover:underline"
            >
              Hoy
            </button>
          )}
          <button
            onClick={() => setMesOffset((o) => Math.max(0, o - 1))}
            className={`nm-btn w-9 h-9 flex items-center justify-center transition-opacity ${mesOffset === 0 ? 'opacity-30 cursor-not-allowed' : 'text-[var(--nm-text-muted)]'}`}
            disabled={mesOffset === 0}
            aria-label="Mes siguiente"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* KPI strip — horizontal scroll mobile */}
      <div className="overflow-x-auto -mx-4 px-4 pb-3 mb-5">
        <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
          {kpis.map((kpi) => (
            <div key={kpi.label} className={`${kpi.variant} shrink-0 w-36 md:w-auto md:flex-1 p-4`}>
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[var(--nm-text-subtle)] mb-1">
                {kpi.label}
              </p>
              <p className={`text-base font-bold leading-tight ${kpi.textColor}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Alertas */}
      {(alertasStock.length > 0 || alertasCaducidad.length > 0 || alertasLotes.length > 0) && (
        <div className="flex flex-col gap-2 mb-4">
          {alertasStock.length > 0 && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-orange-700 uppercase tracking-wider mb-2">
                ⚠ Stock bajo ({alertasStock.length})
              </p>
              <div className="flex flex-col gap-1">
                {alertasStock.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-orange-800 truncate mr-2">{r.nombre_producto}</span>
                    <span className="text-orange-600 font-medium shrink-0">{r.cantidad} / {r.stock_minimo} {r.unidad_medida}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alertasCaducidad.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wider mb-2">
                📅 Por caducar ({alertasCaducidad.length})
              </p>
              <div className="flex flex-col gap-1">
                {alertasCaducidad.map((r) => (
                  <div key={r.id} className="flex items-center justify-between text-sm">
                    <span className="text-amber-800 truncate mr-2">{r.nombre_producto}</span>
                    <span className="text-amber-600 font-medium shrink-0">{formatDate(r.fecha_caducidad!)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {alertasLotes.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <p className="text-xs font-semibold text-red-700 uppercase tracking-wider mb-2">
                🏷 Lotes por caducar ({alertasLotes.length})
              </p>
              <div className="flex flex-col gap-1">
                {alertasLotes.map((l) => (
                  <div key={l.id} className="flex items-center justify-between text-sm">
                    <div className="min-w-0">
                      <span className="text-red-800 truncate block">{l.producto}</span>
                      <span className="text-xs text-red-500">Lote: {l.numero_lote} · {l.cantidad_actual} {l.unidad}</span>
                    </div>
                    <span className="text-red-600 font-medium shrink-0 ml-2">{formatDate(l.fecha_caducidad)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Weekly chart */}
      {weeklyData.length > 0 && (
        <div className="nm-card p-4 mb-4">
          <p className="text-xs font-semibold text-[var(--nm-text-muted)] uppercase tracking-wider mb-3">
            Ventas vs Compras — últimas semanas
          </p>
          <WeeklyChart data={weeklyData} />
        </div>
      )}

      {/* Payment pie */}
      {paymentData.length >= 2 && (
        <div className="nm-card p-4 mb-5">
          <p className="text-xs font-semibold text-[var(--nm-text-muted)] uppercase tracking-wider mb-2">
            Ventas por forma de pago
          </p>
          <PaymentPieChart data={paymentData} />
        </div>
      )}

      {/* Últimas compras & ventas — 2 columns on desktop */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        {/* Compras */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide">Últimas compras</h2>
            <button onClick={() => openQuick('compra')} className="text-xs text-[var(--nm-accent)] font-medium hover:underline">+ Agregar</button>
          </div>
          {compras.length === 0 ? (
            <p className="text-sm text-[var(--nm-text-subtle)] py-4 text-center">Sin compras en {mesLabel}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {compras.map((c) => {
                const nombre = (c.proveedores as { nombre: string } | null)?.nombre
                  ?? (c.personas as { nombre: string } | null)?.nombre
                  ?? '—'
                return (
                  <div key={c.id} className="nm-card-sm overflow-hidden">
                    <div className="p-3 flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[var(--nm-text)]">{nombre}</p>
                          {c.numero_compra && <span className="text-xs font-mono text-[var(--nm-text-subtle)]">{c.numero_compra}</span>}
                        </div>
                        <p className="text-xs text-[var(--nm-text-subtle)]">{formatDate(c.fecha)} · {formatFormaPago(c.forma_pago)}</p>
                        {c.descripcion && <p className="text-xs text-[var(--nm-text-muted)] mt-0.5 truncate">{c.descripcion}</p>}
                      </div>
                      <span className="text-sm font-semibold text-[var(--nm-text)] shrink-0">{formatMxn(c.monto_total)}</span>
                    </div>
                    <div className="flex border-t border-[var(--nm-bg-inset)]">
                      <button onClick={() => openEdit('compra', c)} className="flex-1 py-2 text-xs font-medium text-[var(--nm-accent)] hover:bg-[var(--nm-bg-inset)]/40 transition-colors">
                        Editar
                      </button>
                      <div className="w-px bg-[var(--nm-bg-inset)]" />
                      <button onClick={() => handleDelete('compra', c.id)} disabled={deleting === c.id} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50/30 transition-colors disabled:opacity-40">
                        {deleting === c.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Ventas */}
        <section>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide">Últimas ventas</h2>
            <button onClick={() => openQuick('venta')} className="text-xs text-[var(--nm-accent)] font-medium hover:underline">+ Agregar</button>
          </div>
          {ventas.length === 0 ? (
            <p className="text-sm text-[var(--nm-text-subtle)] py-4 text-center">Sin ventas en {mesLabel}</p>
          ) : (
            <div className="flex flex-col gap-2">
              {ventas.map((v) => {
                const nombre = (v.clientes as { nombre: string } | null)?.nombre
                  ?? (v.personas as { nombre: string } | null)?.nombre
                  ?? '—'
                return (
                  <div key={v.id} className="nm-card-sm overflow-hidden">
                    <div className="p-3 flex justify-between items-start">
                      <div className="flex-1 min-w-0 mr-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium text-[var(--nm-text)]">{nombre}</p>
                          {v.numero_venta && <span className="text-xs font-mono text-[var(--nm-text-subtle)]">{v.numero_venta}</span>}
                        </div>
                        <p className="text-xs text-[var(--nm-text-subtle)]">{formatDate(v.fecha)} · {formatFormaPago(v.forma_pago)}</p>
                        {v.notas && <p className="text-xs text-[var(--nm-text-muted)] mt-0.5 truncate italic">{v.notas}</p>}
                      </div>
                      <span className="text-sm font-semibold text-[var(--nm-accent)] shrink-0">{formatMxn(v.monto_total)}</span>
                    </div>
                    <div className="flex border-t border-[var(--nm-bg-inset)]">
                      <button onClick={() => openEdit('venta', v)} className="flex-1 py-2 text-xs font-medium text-[var(--nm-accent)] hover:bg-[var(--nm-bg-inset)]/40 transition-colors">
                        Editar
                      </button>
                      <div className="w-px bg-[var(--nm-bg-inset)]" />
                      <button onClick={() => handleDelete('venta', v.id)} disabled={deleting === v.id} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50/30 transition-colors disabled:opacity-40">
                        {deleting === v.id ? '...' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>
      </div>

      {/* FAB */}
      <div className="fixed bottom-20 right-4 z-30 md:bottom-6 md:right-6 flex flex-col items-end gap-2">
        {showFabMenu && (
          <>
            <button
              onClick={() => openQuick('venta')}
              className="nm-card-sm flex items-center gap-2 pl-4 pr-5 py-2.5 text-sm font-medium text-[var(--nm-text)]"
            >
              <span className="w-2 h-2 rounded-full bg-[var(--nm-accent)]" />
              Registrar venta
            </button>
            <button
              onClick={() => openQuick('compra')}
              className="nm-card-sm flex items-center gap-2 pl-4 pr-5 py-2.5 text-sm font-medium text-[var(--nm-text)]"
            >
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Registrar compra
            </button>
          </>
        )}
        <button
          onClick={() => setShowFabMenu((v) => !v)}
          className="nm-btn-primary w-14 h-14 text-white rounded-full flex items-center justify-center text-2xl font-light shadow-lg active:scale-95"
          aria-label="Agregar registro"
        >
          {showFabMenu ? '✕' : '+'}
        </button>
      </div>

      {/* Quick add / edit bottom sheet */}
      {quickType && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm" onClick={closeSheet}>
          <div
            className="nm-card rounded-b-none w-full max-w-lg p-5 pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-[var(--nm-text)] text-base">
                {editTarget
                  ? `Editar ${quickType === 'compra' ? 'compra' : 'venta'}`
                  : quickType === 'compra' ? 'Registrar compra' : 'Registrar venta'}
              </h2>
              <button onClick={closeSheet} className="text-[var(--nm-text-subtle)] hover:text-[var(--nm-text)] text-xl">✕</button>
            </div>

            <form onSubmit={handleQuickSave} className="flex flex-col gap-3">
              {quickError && (
                <p className="text-sm text-red-600 bg-red-50/50 rounded-[var(--nm-radius-sm)] px-3 py-2">{quickError}</p>
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
                {quickType === 'venta' ? (
                  <FormField label="Cliente">
                    <Select value={form.cliente_id} onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}>
                      <option value="">— Ninguno —</option>
                      {clientes.map((c) => (
                        <option key={c.id} value={c.id}>{c.nombre}</option>
                      ))}
                    </Select>
                  </FormField>
                ) : (
                  <FormField label="Proveedor">
                    <Select value={form.proveedor_id} onChange={(e) => setForm((f) => ({ ...f, proveedor_id: e.target.value }))}>
                      <option value="">— Ninguno —</option>
                      {proveedores.map((p) => (
                        <option key={p.id} value={p.id}>{p.nombre}</option>
                      ))}
                    </Select>
                  </FormField>
                )}
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
