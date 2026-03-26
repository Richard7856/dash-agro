'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'

// ─── helpers ────────────────────────────────────────────────────────────────

function mesLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'short' }).replace('.', '')
}

function mesLabelFull(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

function rangoMes(ym: string): { inicio: string; fin: string } {
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return { inicio: `${ym}-01`, fin: `${ym}-${String(lastDay).padStart(2, '0')}` }
}

function last12Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}

function todayStr() { return new Date().toISOString().split('T')[0] }
function curMonth() {
  const n = new Date()
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`
}

// ─── types ──────────────────────────────────────────────────────────────────

interface MesData {
  mes: string
  label: string
  ventas: number
  compras: number
  gastos: number
  utilidad: number
}

interface TopItem { nombre: string; total: number }

type Period = 'hoy' | 'semana' | 'mes' | 'anual'

// ─── component ──────────────────────────────────────────────────────────────

export default function FinanzasPage() {
  const [loading, setLoading] = useState(true)
  const [period, setPeriod] = useState<Period>('mes')

  // Summary numbers for selected period
  const [ventas, setVentas] = useState(0)
  const [compras, setCompras] = useState(0)
  const [gastos, setGastos] = useState(0)
  const [ventasCount, setVentasCount] = useState(0)
  const [comprasCount, setComprasCount] = useState(0)
  const [gastosCount, setGastosCount] = useState(0)

  // Always-loaded totals
  const [valorInventario, setValorInventario] = useState(0)
  const [totalPiezas, setTotalPiezas] = useState(0)
  const [cxc, setCxc] = useState(0)
  const [cxp, setCxp] = useState(0)

  // Trend (12 months)
  const [meses, setMeses] = useState<MesData[]>([])

  // Top lists
  const [topClientes, setTopClientes] = useState<TopItem[]>([])
  const [topProveedores, setTopProveedores] = useState<TopItem[]>([])
  const [topGastos, setTopGastos] = useState<TopItem[]>([])
  const [topProductos, setTopProductos] = useState<TopItem[]>([])

  // ─── load period data ───────────────────────────────────────────────────

  function getPeriodRange(p: Period): { desde: string; hasta: string } {
    const now = new Date()
    const hasta = todayStr()
    switch (p) {
      case 'hoy': return { desde: hasta, hasta }
      case 'semana': {
        const d = new Date(now)
        d.setDate(d.getDate() - 7)
        return { desde: d.toISOString().split('T')[0], hasta }
      }
      case 'mes': {
        const { inicio, fin } = rangoMes(curMonth())
        return { desde: inicio, hasta: fin }
      }
      case 'anual': {
        return { desde: `${now.getFullYear()}-01-01`, hasta }
      }
    }
  }

  const loadPeriod = useCallback(async (p: Period) => {
    const { desde, hasta } = getPeriodRange(p)

    const [
      { data: vData },
      { data: cData },
      { data: gData },
    ] = await Promise.all([
      supabase.from('ventas').select('monto_total').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('compras').select('monto_total').gte('fecha', desde).lte('fecha', hasta),
      supabase.from('gastos').select('monto').gte('fecha', desde).lte('fecha', hasta),
    ])

    const vArr = vData ?? []
    const cArr = cData ?? []
    const gArr = gData ?? []

    setVentas(vArr.reduce((s, r) => s + (r.monto_total as number), 0))
    setCompras(cArr.reduce((s, r) => s + (r.monto_total as number), 0))
    setGastos(gArr.reduce((s, r) => s + (r.monto as number), 0))
    setVentasCount(vArr.length)
    setComprasCount(cArr.length)
    setGastosCount(gArr.length)
  }, [])

  // ─── load always data (inventario, CxC, CxP, trend, top) ───────────────

  const loadGlobal = useCallback(async () => {
    // Inventario
    const { data: inv } = await supabase
      .from('inventario_registros')
      .select('cantidad, precio_compra_unitario')
      .gt('cantidad', 0)
    const invArr = inv ?? []
    setValorInventario(invArr.reduce((s, r) => s + (r.cantidad as number) * (r.precio_compra_unitario as number), 0))
    setTotalPiezas(invArr.reduce((s, r) => s + (r.cantidad as number), 0))

    // CxC (ventas pendientes/parciales)
    const { data: cxcData } = await supabase
      .from('ventas')
      .select('monto_total, monto_pagado')
      .in('status_pago', ['pendiente', 'parcial'])
    setCxc((cxcData ?? []).reduce((s, r) => s + ((r.monto_total as number) - (r.monto_pagado as number)), 0))

    // CxP (compras pendientes/parciales)
    const { data: cxpData } = await supabase
      .from('compras')
      .select('monto_total, monto_pagado')
      .in('status_pago', ['pendiente', 'parcial'])
    setCxp((cxpData ?? []).reduce((s, r) => s + ((r.monto_total as number) - (r.monto_pagado as number)), 0))

    // 12-month trend
    const months = last12Months()
    const trendResults: MesData[] = []
    await Promise.all(months.map(async (ym) => {
      const { inicio, fin } = rangoMes(ym)
      const [{ data: vD }, { data: cD }, { data: gD }] = await Promise.all([
        supabase.from('ventas').select('monto_total').gte('fecha', inicio).lte('fecha', fin),
        supabase.from('compras').select('monto_total').gte('fecha', inicio).lte('fecha', fin),
        supabase.from('gastos').select('monto').gte('fecha', inicio).lte('fecha', fin),
      ])
      const v = (vD ?? []).reduce((s: number, r: { monto_total: number }) => s + r.monto_total, 0)
      const c = (cD ?? []).reduce((s: number, r: { monto_total: number }) => s + r.monto_total, 0)
      const g = (gD ?? []).reduce((s: number, r: { monto: number }) => s + r.monto, 0)
      trendResults.push({ mes: ym, label: mesLabel(ym), ventas: v, compras: c, gastos: g, utilidad: v - c - g })
    }))
    trendResults.sort((a, b) => a.mes.localeCompare(b.mes))
    setMeses(trendResults)

    // Top clientes (current month)
    const { inicio: mInicio, fin: mFin } = rangoMes(curMonth())
    const { data: ventasDetalle } = await supabase
      .from('ventas')
      .select('monto_total, clientes(nombre)')
      .gte('fecha', mInicio).lte('fecha', mFin)
    const cMap = new Map<string, number>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const v of (ventasDetalle ?? []) as any[]) {
      const name = v.clientes?.nombre ?? 'Sin cliente'
      cMap.set(name, (cMap.get(name) ?? 0) + (v.monto_total as number))
    }
    setTopClientes(Array.from(cMap.entries()).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 5))

    // Top proveedores
    const { data: comprasDetalle } = await supabase
      .from('compras')
      .select('monto_total, proveedores(nombre)')
      .gte('fecha', mInicio).lte('fecha', mFin)
    const pMap = new Map<string, number>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const c of (comprasDetalle ?? []) as any[]) {
      const name = c.proveedores?.nombre ?? 'Sin proveedor'
      pMap.set(name, (pMap.get(name) ?? 0) + (c.monto_total as number))
    }
    setTopProveedores(Array.from(pMap.entries()).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 5))

    // Top gastos por categoría
    const { data: gastosDetalle } = await supabase
      .from('gastos')
      .select('monto, categoria')
      .gte('fecha', mInicio).lte('fecha', mFin)
    const gMap = new Map<string, number>()
    for (const g of gastosDetalle ?? []) {
      const cat = (g.categoria as string) ?? 'Sin categoría'
      gMap.set(cat, (gMap.get(cat) ?? 0) + (g.monto as number))
    }
    setTopGastos(Array.from(gMap.entries()).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 5))

    // Top productos vendidos (by inventario nombre)
    const { data: ventasItems } = await supabase
      .from('ventas_items')
      .select('total, inventario_registros(nombre_producto)')
      .gte('created_at', mInicio)
    const prMap = new Map<string, number>()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const vi of (ventasItems ?? []) as any[]) {
      const name = vi.inventario_registros?.nombre_producto ?? 'Producto'
      prMap.set(name, (prMap.get(name) ?? 0) + (vi.total as number))
    }
    setTopProductos(Array.from(prMap.entries()).map(([nombre, total]) => ({ nombre, total })).sort((a, b) => b.total - a.total).slice(0, 5))
  }, [])

  // ─── effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    Promise.all([loadPeriod(period), loadGlobal()]).then(() => setLoading(false))
  }, [loadPeriod, loadGlobal, period])

  useEffect(() => { loadPeriod(period) }, [period, loadPeriod])

  // ─── derived ──────────────────────────────────────────────────────────────

  const utilidad = ventas - compras - gastos
  const margen = ventas > 0 ? ((utilidad / ventas) * 100) : 0
  const maxTrend = Math.max(...meses.map(m => Math.max(m.ventas, m.compras, m.gastos, 1)))

  if (loading) return <Spinner fullPage />

  return (
    <div className="max-w-4xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Panel Financiero</h1>
          <p className="text-sm text-gray-500 mt-0.5">Control general del negocio</p>
        </div>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
        {([['hoy', 'Hoy'], ['semana', '7 días'], ['mes', 'Mes'], ['anual', 'Año']] as [Period, string][]).map(([key, label]) => (
          <button key={key} onClick={() => setPeriod(key)}
            className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${period === key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Main KPIs */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Ventas</p>
          <p className="text-xl font-bold text-blue-700 mt-1">{formatMxn(ventas)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{ventasCount} operaciones</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Compras</p>
          <p className="text-xl font-bold text-gray-700 mt-1">{formatMxn(compras)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{comprasCount} operaciones</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase tracking-wider">Gastos</p>
          <p className="text-xl font-bold text-red-600 mt-1">{formatMxn(gastos)}</p>
          <p className="text-xs text-gray-400 mt-0.5">{gastosCount} operaciones</p>
        </div>
        <div className={`rounded-xl border p-4 ${utilidad >= 0 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-xs text-gray-500 uppercase tracking-wider">Utilidad</p>
          <p className={`text-xl font-bold mt-1 ${utilidad >= 0 ? 'text-green-700' : 'text-red-700'}`}>{formatMxn(utilidad)}</p>
          <p className="text-xs text-gray-400 mt-0.5">Margen: {margen.toFixed(1)}%</p>
        </div>
      </div>

      {/* Balance general */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Inventario</p>
          <p className="text-sm font-bold text-gray-800">{formatMxn(valorInventario)}</p>
          <p className="text-[10px] text-gray-400">{totalPiezas.toLocaleString('es-MX', { maximumFractionDigits: 0 })} piezas</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Por cobrar</p>
          <p className="text-sm font-bold text-amber-700">{formatMxn(cxc)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Por pagar</p>
          <p className="text-sm font-bold text-red-600">{formatMxn(cxp)}</p>
        </div>
        <div className={`rounded-xl border p-3 text-center ${(valorInventario + cxc - cxp) >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-red-50 border-red-200'}`}>
          <p className="text-[10px] text-gray-400 uppercase">Balance neto</p>
          <p className="text-sm font-bold text-blue-700">{formatMxn(valorInventario + cxc - cxp)}</p>
        </div>
      </div>

      {/* Trend chart (simple bar) */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Tendencia 12 meses</h3>
        <div className="flex gap-1 items-end h-36">
          {meses.map((m) => {
            const hV = (m.ventas / maxTrend) * 100
            const hC = (m.compras / maxTrend) * 100
            return (
              <div key={m.mes} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex gap-px items-end" style={{ height: '120px' }}>
                  <div className="flex-1 bg-blue-400 rounded-t transition-all" style={{ height: `${hV}%`, minHeight: m.ventas > 0 ? 2 : 0 }} title={`Ventas: ${formatMxn(m.ventas)}`} />
                  <div className="flex-1 bg-gray-300 rounded-t transition-all" style={{ height: `${hC}%`, minHeight: m.compras > 0 ? 2 : 0 }} title={`Compras: ${formatMxn(m.compras)}`} />
                </div>
                <span className="text-[9px] text-gray-400 capitalize">{m.label}</span>
              </div>
            )
          })}
        </div>
        <div className="flex gap-4 mt-2 justify-center">
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-blue-400 inline-block" /> Ventas</span>
          <span className="flex items-center gap-1 text-[10px] text-gray-500"><span className="w-2 h-2 rounded-sm bg-gray-300 inline-block" /> Compras</span>
        </div>
      </div>

      {/* Utilidad trend */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Utilidad mensual</h3>
        <div className="flex gap-1 items-end h-24">
          {meses.map((m) => {
            const maxU = Math.max(...meses.map(x => Math.abs(x.utilidad)), 1)
            const h = (Math.abs(m.utilidad) / maxU) * 100
            return (
              <div key={m.mes} className="flex-1 flex flex-col items-center gap-0.5">
                <div className="w-full flex items-end justify-center" style={{ height: '80px' }}>
                  <div className={`w-full rounded-t transition-all ${m.utilidad >= 0 ? 'bg-green-400' : 'bg-red-400'}`}
                    style={{ height: `${h}%`, minHeight: Math.abs(m.utilidad) > 0 ? 2 : 0 }}
                    title={`${mesLabelFull(m.mes)}: ${formatMxn(m.utilidad)}`} />
                </div>
                <span className="text-[9px] text-gray-400 capitalize">{m.label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {/* Top lists */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Top clientes */}
        <TopList title="Top clientes (mes)" items={topClientes} color="blue" />
        {/* Top proveedores */}
        <TopList title="Top proveedores (mes)" items={topProveedores} color="gray" />
        {/* Top gastos */}
        <TopList title="Gastos por categoría (mes)" items={topGastos} color="red" />
        {/* Top productos */}
        <TopList title="Productos más vendidos (mes)" items={topProductos} color="green" />
      </div>
    </div>
  )
}

// ─── Top list component ─────────────────────────────────────────────────────

function TopList({ title, items, color }: { title: string; items: TopItem[]; color: 'blue' | 'gray' | 'red' | 'green' }) {
  const maxVal = Math.max(...items.map(i => i.total), 1)
  const barColor = { blue: 'bg-blue-400', gray: 'bg-gray-300', red: 'bg-red-400', green: 'bg-green-400' }[color]

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <h3 className="text-sm font-semibold text-gray-700 mb-3">{title}</h3>
      {items.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Sin datos</p>
      ) : (
        <div className="flex flex-col gap-2">
          {items.map((item, i) => (
            <div key={i}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-gray-700 truncate max-w-[60%]">{item.nombre}</span>
                <span className="text-xs font-medium text-gray-900">{formatMxn(item.total)}</span>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full ${barColor} rounded-full transition-all`} style={{ width: `${(item.total / maxVal) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
