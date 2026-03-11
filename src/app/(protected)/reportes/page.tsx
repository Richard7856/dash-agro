'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'

interface MesData {
  mes: string        // YYYY-MM
  label: string
  ventas: number
  compras: number
  gastos: number
  utilidad: number
}

interface TopItem {
  nombre: string
  total: number
}

function mesLabel(ym: string): string {
  const [y, m] = ym.split('-')
  const d = new Date(parseInt(y), parseInt(m) - 1, 1)
  return d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
}

function rangoMes(ym: string): { inicio: string; fin: string } {
  const [y, m] = ym.split('-').map(Number)
  const lastDay = new Date(y, m, 0).getDate()
  return {
    inicio: `${ym}-01`,
    fin: `${ym}-${String(lastDay).padStart(2, '0')}`,
  }
}

function last6Months(): string[] {
  const months: string[] = []
  const now = new Date()
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push(ym)
  }
  return months
}

type Tab = 'resumen' | 'ingresos' | 'egresos'

export default function ReportesPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [meses, setMeses] = useState<MesData[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMes, setSelectedMes] = useState(() => {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  })
  const [topClientes, setTopClientes] = useState<TopItem[]>([])
  const [topProveedores, setTopProveedores] = useState<TopItem[]>([])
  const [gastosCat, setGastosCat] = useState<TopItem[]>([])
  const [ventasPendientes, setVentasPendientes] = useState(0)
  const [loadingDetail, setLoadingDetail] = useState(false)

  // Load 6-month summary
  const loadResumen = useCallback(async () => {
    const months = last6Months()
    const results: MesData[] = []

    await Promise.all(months.map(async (ym) => {
      const { inicio, fin } = rangoMes(ym)
      const [{ data: vData }, { data: cData }, { data: gData }] = await Promise.all([
        supabase.from('ventas').select('monto_total').gte('fecha', inicio).lte('fecha', fin),
        supabase.from('compras').select('monto_total').gte('fecha', inicio).lte('fecha', fin),
        supabase.from('gastos').select('monto').gte('fecha', inicio).lte('fecha', fin),
      ])
      const ventas = (vData ?? []).reduce((s: number, r: { monto_total: number }) => s + r.monto_total, 0)
      const compras = (cData ?? []).reduce((s: number, r: { monto_total: number }) => s + r.monto_total, 0)
      const gastos = (gData ?? []).reduce((s: number, r: { monto: number }) => s + r.monto, 0)
      results.push({ mes: ym, label: mesLabel(ym), ventas, compras, gastos, utilidad: ventas - compras - gastos })
    }))

    results.sort((a, b) => a.mes.localeCompare(b.mes))
    setMeses(results)
    setLoading(false)
  }, [])

  useEffect(() => { loadResumen() }, [loadResumen])

  // Load detail for selected month
  const loadDetail = useCallback(async (ym: string) => {
    setLoadingDetail(true)
    const { inicio, fin } = rangoMes(ym)

    const [{ data: vData }, { data: cData }, { data: gData }, { data: vpData }] = await Promise.all([
      supabase.from('ventas').select('monto_total, clientes(nombre)').gte('fecha', inicio).lte('fecha', fin).limit(500),
      supabase.from('compras').select('monto_total, proveedores(nombre)').gte('fecha', inicio).lte('fecha', fin).limit(500),
      supabase.from('gastos').select('monto, categoria').gte('fecha', inicio).lte('fecha', fin).limit(500),
      supabase.from('ventas').select('monto_total').in('status_pago', ['pendiente', 'parcial']).gte('fecha', inicio).lte('fecha', fin),
    ])

    // Top clientes
    const clienteMap: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(vData ?? []).forEach((v: any) => {
      const n = (Array.isArray(v.clientes) ? v.clientes[0]?.nombre : v.clientes?.nombre) ?? '(Sin cliente)'
      clienteMap[n] = (clienteMap[n] ?? 0) + (v.monto_total as number)
    })
    setTopClientes(
      Object.entries(clienteMap)
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
    )

    // Top proveedores
    const provMap: Record<string, number> = {}
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(cData ?? []).forEach((c: any) => {
      const n = (Array.isArray(c.proveedores) ? c.proveedores[0]?.nombre : c.proveedores?.nombre) ?? '(Sin proveedor)'
      provMap[n] = (provMap[n] ?? 0) + (c.monto_total as number)
    })
    setTopProveedores(
      Object.entries(provMap)
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5)
    )

    // Gastos por categoría
    const catMap: Record<string, number> = {}
    ;(gData ?? []).forEach((g: { monto: number; categoria: string | null }) => {
      const n = g.categoria ?? 'Sin categoría'
      catMap[n] = (catMap[n] ?? 0) + g.monto
    })
    setGastosCat(
      Object.entries(catMap)
        .map(([nombre, total]) => ({ nombre, total }))
        .sort((a, b) => b.total - a.total)
    )

    // Ventas pendientes
    setVentasPendientes(
      (vpData ?? []).reduce((s: number, v: { monto_total: number }) => s + v.monto_total, 0)
    )

    setLoadingDetail(false)
  }, [])

  useEffect(() => { loadDetail(selectedMes) }, [loadDetail, selectedMes])

  const currentMes = meses.find((m) => m.mes === selectedMes)

  if (loading) return <Spinner fullPage />

  const TABS: { id: Tab; label: string }[] = [
    { id: 'resumen', label: 'Resumen' },
    { id: 'ingresos', label: 'Ingresos' },
    { id: 'egresos', label: 'Egresos' },
  ]

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--nm-text)]">Reportes</h1>
          <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">Análisis financiero</p>
        </div>
        {/* Month selector */}
        <select
          value={selectedMes}
          onChange={(e) => setSelectedMes(e.target.value)}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-300"
        >
          {last6Months().map((ym) => (
            <option key={ym} value={ym}>{mesLabel(ym)}</option>
          ))}
        </select>
      </div>

      {/* KPIs del mes seleccionado */}
      {currentMes && (
        <div className="grid grid-cols-2 gap-2 mb-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3">
            <p className="text-xs text-green-600 font-medium">Ventas</p>
            <p className="text-lg font-bold text-green-700">{formatMxn(currentMes.ventas)}</p>
          </div>
          <div className="bg-orange-50 border border-orange-100 rounded-xl p-3">
            <p className="text-xs text-orange-600 font-medium">Compras + Gastos</p>
            <p className="text-lg font-bold text-orange-700">{formatMxn(currentMes.compras + currentMes.gastos)}</p>
          </div>
          <div className={`col-span-2 border rounded-xl p-3 ${currentMes.utilidad >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
            <p className={`text-xs font-medium ${currentMes.utilidad >= 0 ? 'text-blue-600' : 'text-red-600'}`}>Utilidad bruta</p>
            <p className={`text-xl font-bold ${currentMes.utilidad >= 0 ? 'text-blue-700' : 'text-red-700'}`}>{formatMxn(currentMes.utilidad)}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 mb-4">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all ${
              tab === t.id ? 'bg-white shadow-sm text-[var(--nm-text)]' : 'text-[var(--nm-text-subtle)]'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {loadingDetail ? <Spinner size="sm" /> : (
        <>
          {/* Resumen: tabla mensual */}
          {tab === 'resumen' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[var(--nm-text-subtle)] border-b border-gray-200">
                    <th className="text-left py-2 pr-3">Mes</th>
                    <th className="text-right py-2 px-2">Ventas</th>
                    <th className="text-right py-2 px-2">Compras</th>
                    <th className="text-right py-2 px-2">Gastos</th>
                    <th className="text-right py-2 pl-2">Utilidad</th>
                  </tr>
                </thead>
                <tbody>
                  {meses.map((m) => (
                    <tr key={m.mes} className={`border-b border-gray-100 ${m.mes === selectedMes ? 'bg-blue-50/50' : ''}`}>
                      <td className="py-2 pr-3 font-medium text-[var(--nm-text)] capitalize">{m.label}</td>
                      <td className="text-right py-2 px-2 text-green-700">{formatMxn(m.ventas)}</td>
                      <td className="text-right py-2 px-2 text-orange-700">{formatMxn(m.compras)}</td>
                      <td className="text-right py-2 px-2 text-red-600">{formatMxn(m.gastos)}</td>
                      <td className={`text-right py-2 pl-2 font-semibold ${m.utilidad >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                        {formatMxn(m.utilidad)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Ingresos */}
          {tab === 'ingresos' && (
            <div className="flex flex-col gap-4">
              {ventasPendientes > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 flex items-center justify-between">
                  <p className="text-sm text-amber-700">Ventas pendientes de cobro</p>
                  <p className="text-sm font-bold text-amber-700">{formatMxn(ventasPendientes)}</p>
                </div>
              )}
              <div>
                <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide mb-2">Top clientes</p>
                {topClientes.length === 0 ? (
                  <p className="text-sm text-[var(--nm-text-subtle)] text-center py-4">Sin ventas en este período</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {topClientes.map((c, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                        <span className="text-sm text-[var(--nm-text)]">{c.nombre}</span>
                        <span className="text-sm font-semibold text-green-700">{formatMxn(c.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Egresos */}
          {tab === 'egresos' && (
            <div className="flex flex-col gap-4">
              <div>
                <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide mb-2">Top proveedores</p>
                {topProveedores.length === 0 ? (
                  <p className="text-sm text-[var(--nm-text-subtle)] text-center py-4">Sin compras en este período</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {topProveedores.map((p, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                        <span className="text-sm text-[var(--nm-text)]">{p.nombre}</span>
                        <span className="text-sm font-semibold text-orange-700">{formatMxn(p.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs font-semibold text-[var(--nm-text-subtle)] uppercase tracking-wide mb-2">Gastos por categoría</p>
                {gastosCat.length === 0 ? (
                  <p className="text-sm text-[var(--nm-text-subtle)] text-center py-4">Sin gastos en este período</p>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    {gastosCat.map((g, i) => (
                      <div key={i} className="flex items-center justify-between bg-white border border-gray-200 rounded-xl px-3 py-2.5">
                        <span className="text-sm text-[var(--nm-text)]">{g.nombre}</span>
                        <span className="text-sm font-semibold text-red-600">{formatMxn(g.total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
