'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate } from '@/lib/format'
import { Spinner } from '@/components/ui/Spinner'
import type { Venta } from '@/lib/types/database.types'

function diasVencimiento(fechaVencimiento: string | null, fecha: string): number {
  const ref = fechaVencimiento ?? fecha
  const diff = Date.now() - new Date(ref + 'T00:00:00').getTime()
  return Math.floor(diff / (1000 * 60 * 60 * 24))
}

export default function CxcPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [marking, setMarking] = useState<string | null>(null)

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('ventas')
      .select('*, clientes(nombre), personas(nombre)')
      .in('status_pago', ['pendiente', 'parcial'])
      .order('fecha', { ascending: true })
      .limit(500)
    setVentas((data ?? []) as Venta[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  async function marcarPagada(id: string) {
    setMarking(id)
    const { error: err } = await supabase
      .from('ventas')
      .update({ status_pago: 'pagado' })
      .eq('id', id)
    if (err) { setError(`Error: ${err.message}`); setMarking(null); return }
    setVentas((vs) => vs.filter((v) => v.id !== id))
    setMarking(null)
  }

  const resumen = useMemo(() => {
    const total = ventas.reduce((s, v) => s + v.monto_total, 0)
    let hasta30 = 0, hasta60 = 0, mas60 = 0
    ventas.forEach((v) => {
      const dias = diasVencimiento(v.fecha_vencimiento, v.fecha)
      if (dias <= 30) hasta30++
      else if (dias <= 60) hasta60++
      else mas60++
    })
    return { total, hasta30, hasta60, mas60 }
  }, [ventas])

  if (loading) return <Spinner fullPage />

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--nm-text)]">Cuentas por Cobrar</h1>
          <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">{ventas.length} venta{ventas.length !== 1 ? 's' : ''} pendiente{ventas.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {/* Resumen */}
      {ventas.length > 0 && (
        <div className="flex flex-col gap-2 mb-4">
          <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center justify-between">
            <p className="text-sm text-green-700 font-medium">Total por cobrar</p>
            <p className="text-base font-bold text-green-700">{formatMxn(resumen.total)}</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-white border border-gray-200 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-green-600">{resumen.hasta30}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">≤ 30 días</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-amber-500">{resumen.hasta60}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">31–60 días</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-xl p-2.5 text-center">
              <p className="text-lg font-bold text-red-500">{resumen.mas60}</p>
              <p className="text-[11px] text-gray-500 mt-0.5">+60 días</p>
            </div>
          </div>
        </div>
      )}

      {ventas.length === 0 ? (
        <div className="text-center py-10 text-[var(--nm-text-subtle)] text-sm">
          No hay ventas pendientes de cobro.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {ventas.map((v) => {
            const dias = diasVencimiento(v.fecha_vencimiento, v.fecha)
            const vencida = v.fecha_vencimiento ? dias > 0 : false
            const clienteNombre = (v.clientes as { nombre: string } | null)?.nombre
            return (
              <div key={v.id} className="nm-card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-[var(--nm-text)]">
                          {v.numero_venta ?? 'Venta'}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          v.status_pago === 'parcial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'
                        }`}>
                          {v.status_pago === 'parcial' ? 'Parcial' : 'Pendiente'}
                        </span>
                        {vencida && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                            Vencida {dias}d
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-[var(--nm-text-subtle)]">
                        {clienteNombre && <span>{clienteNombre}</span>}
                        <span>Fecha: {formatDate(v.fecha)}</span>
                        {v.fecha_vencimiento && <span>Vence: {formatDate(v.fecha_vencimiento)}</span>}
                      </div>
                    </div>
                    <p className="text-base font-bold text-[var(--nm-text)] shrink-0">{formatMxn(v.monto_total)}</p>
                  </div>
                </div>
                <div className="flex border-t border-[var(--nm-bg-inset)]">
                  <button
                    onClick={() => marcarPagada(v.id)}
                    disabled={marking === v.id}
                    className="flex-1 py-2 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors disabled:opacity-50"
                  >
                    {marking === v.id ? 'Guardando...' : 'Marcar como pagada'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
