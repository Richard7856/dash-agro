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
import { SearchSelect } from '@/components/ui/SearchSelect'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth-context'
import type { MermaRegistro, MermaMotivo, InventarioRegistro } from '@/lib/types/database.types'

const MOTIVOS: { value: MermaMotivo; label: string }[] = [
  { value: 'caducidad', label: 'Caducidad' },
  { value: 'daño', label: 'Daño' },
  { value: 'robo', label: 'Robo' },
  { value: 'devolucion', label: 'Devolución' },
  { value: 'otro', label: 'Otro' },
]

const MOTIVO_COLORS: Record<MermaMotivo, string> = {
  caducidad: 'bg-amber-100 text-amber-700',
  daño: 'bg-red-100 text-red-700',
  robo: 'bg-purple-100 text-purple-700',
  devolucion: 'bg-blue-100 text-blue-700',
  otro: 'bg-gray-100 text-gray-600',
}

type View = 'list' | 'form'

export default function MermaPage() {
  const { toast } = useToast()
  const { user } = useAuth()

  const [registros, setRegistros] = useState<MermaRegistro[]>([])
  const [inventario, setInventario] = useState<InventarioRegistro[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')

  // form
  const [inventarioId, setInventarioId] = useState('')
  const [nombreProducto, setNombreProducto] = useState('')
  const [cantidad, setCantidad] = useState('')
  const [unidadMedida, setUnidadMedida] = useState('unidad')
  const [motivo, setMotivo] = useState<MermaMotivo>('caducidad')
  const [notas, setNotas] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // filters
  const [busqueda, setBusqueda] = useState('')
  const [filtroMotivo, setFiltroMotivo] = useState('')
  const [filtroDesde, setFiltroDesde] = useState('')
  const [filtroHasta, setFiltroHasta] = useState('')

  const loadData = useCallback(async () => {
    const [{ data: mermaData }, { data: invData }] = await Promise.all([
      supabase
        .from('merma_registros')
        .select('*')
        .order('fecha', { ascending: false })
        .limit(500),
      supabase
        .from('inventario_registros')
        .select('id, nombre_producto, cantidad, unidad_medida, precio_compra_unitario')
        .gt('cantidad', 0)
        .order('nombre_producto'),
    ])
    setRegistros((mermaData ?? []) as MermaRegistro[])
    setInventario((invData ?? []) as InventarioRegistro[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // filtered
  const filtered = useMemo(() => {
    let result = registros
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter(r => r.nombre_producto.toLowerCase().includes(q))
    }
    if (filtroMotivo) result = result.filter(r => r.motivo === filtroMotivo)
    if (filtroDesde) result = result.filter(r => r.fecha >= filtroDesde)
    if (filtroHasta) result = result.filter(r => r.fecha <= filtroHasta)
    return result
  }, [registros, busqueda, filtroMotivo, filtroDesde, filtroHasta])

  // stats
  const totalMerma = filtered.reduce((s, r) => s + r.valor_perdido, 0)
  const totalPiezas = filtered.reduce((s, r) => s + r.cantidad, 0)

  function openNew() {
    setInventarioId('')
    setNombreProducto('')
    setCantidad('')
    setUnidadMedida('unidad')
    setMotivo('caducidad')
    setNotas('')
    setFecha(todayISO())
    setError('')
    setView('form')
  }

  function selectProduct(id: string) {
    setInventarioId(id)
    const prod = inventario.find(i => i.id === id)
    if (prod) {
      setNombreProducto(prod.nombre_producto)
      setUnidadMedida(prod.unidad_medida)
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!nombreProducto.trim()) { setError('Producto requerido'); return }
    if (!cantidad || parseFloat(cantidad) <= 0) { setError('Cantidad requerida'); return }
    setSaving(true)
    setError('')

    const qty = parseFloat(cantidad)
    const prod = inventario.find(i => i.id === inventarioId)
    const valorPerdido = prod ? qty * prod.precio_compra_unitario : 0

    const { error: insErr } = await supabase.from('merma_registros').insert({
      inventario_registro_id: inventarioId || null,
      nombre_producto: nombreProducto.trim(),
      cantidad: qty,
      unidad_medida: unidadMedida,
      motivo,
      valor_perdido: valorPerdido,
      notas: notas.trim() || null,
      fecha,
      created_by: user?.id ?? null,
    })

    if (insErr) { setError(insErr.message); setSaving(false); return }

    // Descontar del inventario si hay match
    if (inventarioId && prod) {
      const newQty = Math.max(0, prod.cantidad - qty)
      await supabase.from('inventario_registros').update({ cantidad: newQty }).eq('id', inventarioId)
    }

    setSaving(false)
    toast({ type: 'success', message: `Merma registrada: ${qty} ${unidadMedida} de ${nombreProducto}` })
    setView('list')
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro de merma?')) return
    await supabase.from('merma_registros').delete().eq('id', id)
    loadData()
  }

  if (loading) return <Spinner fullPage />

  // ── FORM ──────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title="Registrar merma" onBack={() => setView('list')} />
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <FormField label="Producto del inventario">
            <SearchSelect
              options={inventario.map(i => ({ id: i.id, label: `${i.nombre_producto} (${i.cantidad} ${i.unidad_medida})` }))}
              value={inventarioId}
              onChange={selectProduct}
              placeholder="Buscar producto en inventario…"
              emptyLabel="— Producto no en inventario —"
            />
          </FormField>

          {!inventarioId && (
            <FormField label="Nombre del producto" required>
              <Input
                value={nombreProducto}
                onChange={(e) => setNombreProducto(e.target.value)}
                placeholder="Escribir nombre manualmente"
                required
              />
            </FormField>
          )}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cantidad" required>
              <Input
                type="number"
                step="0.01"
                min="0.01"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                placeholder="0"
                required
              />
            </FormField>
            <FormField label="Fecha">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Motivo">
            <Select value={motivo} onChange={(e) => setMotivo(e.target.value as MermaMotivo)}>
              {MOTIVOS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </Select>
          </FormField>

          {inventarioId && cantidad && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm text-red-800">
              Valor perdido estimado: <strong>{formatMxn((inventario.find(i => i.id === inventarioId)?.precio_compra_unitario ?? 0) * parseFloat(cantidad || '0'))}</strong>
              {' '}— Se descontará automáticamente del inventario.
            </div>
          )}

          <FormField label="Notas">
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones…" />
          </FormField>

          <div className="flex gap-2">
            <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">Registrar merma</Btn>
          </div>
        </form>
      </div>
    )
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Merma"
        subtitle={`${filtered.length} registros`}
        action={{ label: '+ Registrar', onClick: openNew }}
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Registros</p>
          <p className="text-lg font-bold text-gray-800">{filtered.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Piezas perdidas</p>
          <p className="text-lg font-bold text-red-600">{totalPiezas.toLocaleString('es-MX', { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="bg-red-50 rounded-xl border border-red-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Valor perdido</p>
          <p className="text-lg font-bold text-red-700">{formatMxn(totalMerma)}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="text" placeholder="Buscar producto…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {['', ...MOTIVOS.map(m => m.value)].map((m) => (
            <button key={m} onClick={() => setFiltroMotivo(m)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroMotivo === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {m ? MOTIVOS.find(x => x.value === m)?.label : 'Todos'}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)} placeholder="Desde"
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
          <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)} placeholder="Hasta"
            className="px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No hay registros de merma" action={{ label: 'Registrar primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((r) => (
            <div key={r.id} className="nm-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{r.nombre_producto}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${MOTIVO_COLORS[r.motivo]}`}>
                        {MOTIVOS.find(m => m.value === r.motivo)?.label}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                      <span>{formatDate(r.fecha)}</span>
                      <span className="font-medium text-red-600">{r.cantidad} {r.unidad_medida}</span>
                      <span className="font-medium text-red-700">{formatMxn(r.valor_perdido)}</span>
                    </div>
                    {r.notas && <p className="text-xs text-gray-400 mt-1 truncate">{r.notas}</p>}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-gray-100">
                <button onClick={() => handleDelete(r.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-red-600 hover:bg-red-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20">
        +
      </button>
    </div>
  )
}
