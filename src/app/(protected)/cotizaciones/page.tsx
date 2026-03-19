'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, todayISO, generateNumeroCotizacion, formatMxn } from '@/lib/format'
import { FormField, Input, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { FotoUploader } from '@/components/ui/FotoUploader'
import type {
  Tienda,
  CotizacionRonda,
  CotizacionProducto,
  CotizacionPrecio,
} from '@/lib/types/database.types'

type View = 'list' | 'form' | 'detail'

interface FormProducto {
  nombre: string
  precio_referencia: string
}

// ─── helpers ────────────────────────────────────────────────────────────────

function statusBadge(status: string) {
  return status === 'abierta'
    ? 'bg-blue-50 text-blue-700'
    : 'bg-gray-100 text-gray-600'
}

function priceClass(precio: number | undefined, referencia: number | null, isBest: boolean): string {
  if (precio === undefined) return 'border-gray-200'
  if (isBest) return 'bg-blue-50 border-blue-300 font-semibold text-blue-700'
  if (referencia !== null && precio > referencia) return 'bg-red-50 border-red-300 text-red-600'
  return 'border-gray-200'
}

// ─── page ───────────────────────────────────────────────────────────────────

export default function CotizacionesPage() {
  /* list state */
  const [rondas, setRondas] = useState<(CotizacionRonda & { _count: number })[]>([])
  const [tiendas, setTiendas] = useState<Tienda[]>([])
  const [loading, setLoading] = useState(true)

  /* view */
  const [view, setView] = useState<View>('list')

  /* form state */
  const [editId, setEditId] = useState<string | null>(null)
  const [formNombre, setFormNombre] = useState('')
  const [formFecha, setFormFecha] = useState(todayISO())
  const [formNotas, setFormNotas] = useState('')
  const [formProductos, setFormProductos] = useState<FormProducto[]>([])
  const [nuevoProducto, setNuevoProducto] = useState('')
  const [formFotos, setFormFotos] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  /* detail state */
  const [detailRonda, setDetailRonda] = useState<CotizacionRonda | null>(null)
  const [detailProductos, setDetailProductos] = useState<CotizacionProducto[]>([])
  const [detailPrecios, setDetailPrecios] = useState<Map<string, number>>(new Map())
  const [detailFotos, setDetailFotos] = useState<string[]>([])
  const [savingPrecios, setSavingPrecios] = useState(false)

  // ─── data loading ─────────────────────────────────────────────────────────

  const loadList = useCallback(async () => {
    const [{ data: rondasData }, { data: tiendasData }] = await Promise.all([
      supabase
        .from('cotizacion_rondas')
        .select('*, cotizacion_productos(id)')
        .order('fecha', { ascending: false })
        .limit(200),
      supabase
        .from('tiendas')
        .select('*')
        .eq('activo', true)
        .order('nombre'),
    ])

    const mapped = (rondasData ?? []).map((r) => ({
      ...r,
      _count: Array.isArray(r.cotizacion_productos) ? r.cotizacion_productos.length : 0,
      cotizacion_productos: undefined,
    })) as (CotizacionRonda & { _count: number })[]

    setRondas(mapped)
    setTiendas((tiendasData ?? []) as Tienda[])
    setLoading(false)
  }, [])

  useEffect(() => { loadList() }, [loadList])

  // ─── form helpers ─────────────────────────────────────────────────────────

  function openNew() {
    setEditId(null)
    setFormNombre(generateNumeroCotizacion())
    setFormFecha(todayISO())
    setFormNotas('')
    setFormProductos([])
    setFormFotos([])
    setNuevoProducto('')
    setError('')
    setView('form')
  }

  function addProducto() {
    const trimmed = nuevoProducto.trim()
    if (!trimmed) return
    setFormProductos((prev) => [...prev, { nombre: trimmed, precio_referencia: '' }])
    setNuevoProducto('')
  }

  function removeProducto(idx: number) {
    setFormProductos((prev) => prev.filter((_, i) => i !== idx))
  }

  function updatePrecioRef(idx: number, val: string) {
    setFormProductos((prev) => prev.map((p, i) => i === idx ? { ...p, precio_referencia: val } : p))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!formFecha) { setError('Fecha requerida'); return }
    if (formProductos.length === 0) { setError('Agrega al menos un producto'); return }
    setSaving(true)
    setError('')

    const rondaPayload = {
      nombre: formNombre || null,
      fecha: formFecha,
      notas: formNotas || null,
      fotos: formFotos,
    }

    if (editId) {
      const { error: updErr } = await supabase
        .from('cotizacion_rondas')
        .update(rondaPayload)
        .eq('id', editId)
      if (updErr) { setError(updErr.message); setSaving(false); return }

      await supabase.from('cotizacion_productos').delete().eq('ronda_id', editId)
      const { error: insErr } = await supabase.from('cotizacion_productos').insert(
        formProductos.map((p, i) => ({
          ronda_id: editId,
          nombre_producto: p.nombre,
          orden: i,
          precio_referencia: p.precio_referencia ? parseFloat(p.precio_referencia) : null,
        }))
      )
      if (insErr) { setError(insErr.message); setSaving(false); return }
    } else {
      const { data: ronda, error: rErr } = await supabase
        .from('cotizacion_rondas')
        .insert(rondaPayload)
        .select()
        .single()
      if (rErr || !ronda) { setError(rErr?.message ?? 'Error'); setSaving(false); return }

      const { error: pErr } = await supabase.from('cotizacion_productos').insert(
        formProductos.map((p, i) => ({
          ronda_id: ronda.id,
          nombre_producto: p.nombre,
          orden: i,
          precio_referencia: p.precio_referencia ? parseFloat(p.precio_referencia) : null,
        }))
      )
      if (pErr) { setError(pErr.message); setSaving(false); return }
    }

    setSaving(false)
    setView('list')
    loadList()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta ronda de cotización?')) return
    await supabase.from('cotizacion_rondas').delete().eq('id', id)
    loadList()
  }

  // ─── detail helpers ───────────────────────────────────────────────────────

  async function openDetail(ronda: CotizacionRonda & { _count: number }) {
    setDetailRonda(ronda)
    setDetailFotos(ronda.fotos ?? [])
    setView('detail')

    const { data: productos } = await supabase
      .from('cotizacion_productos')
      .select('*, cotizacion_precios(*, tiendas(nombre))')
      .eq('ronda_id', ronda.id)
      .order('orden')

    const prods = (productos ?? []) as CotizacionProducto[]
    setDetailProductos(prods)

    const map = new Map<string, number>()
    for (const p of prods) {
      for (const pr of p.cotizacion_precios ?? []) {
        map.set(`${p.id}|${pr.tienda_id}`, pr.precio)
      }
    }
    setDetailPrecios(map)
  }

  async function openEdit(ronda: CotizacionRonda & { _count: number }) {
    setEditId(ronda.id)
    setFormNombre(ronda.nombre ?? '')
    setFormFecha(ronda.fecha)
    setFormNotas(ronda.notas ?? '')
    setFormFotos(ronda.fotos ?? [])
    setNuevoProducto('')
    setError('')

    const { data: prods } = await supabase
      .from('cotizacion_productos')
      .select('nombre_producto, precio_referencia')
      .eq('ronda_id', ronda.id)
      .order('orden')
    setFormProductos((prods ?? []).map((p) => ({
      nombre: p.nombre_producto,
      precio_referencia: p.precio_referencia != null ? String(p.precio_referencia) : '',
    })))
    setView('form')
  }

  function setPrecio(productoId: string, tiendaId: string, val: string) {
    const num = parseFloat(val)
    setDetailPrecios((prev) => {
      const next = new Map(prev)
      if (isNaN(num) || val === '') {
        next.delete(`${productoId}|${tiendaId}`)
      } else {
        next.set(`${productoId}|${tiendaId}`, num)
      }
      return next
    })
  }

  async function guardarPrecios() {
    setSavingPrecios(true)
    const upserts: { producto_id: string; tienda_id: string; precio: number }[] = []

    detailPrecios.forEach((precio, key) => {
      const [producto_id, tienda_id] = key.split('|')
      upserts.push({ producto_id, tienda_id, precio })
    })

    if (upserts.length > 0) {
      const { error: err } = await supabase
        .from('cotizacion_precios')
        .upsert(upserts, { onConflict: 'producto_id,tienda_id' })
      if (err) { setError(err.message); setSavingPrecios(false); return }
    }

    // save fotos if changed
    if (detailRonda) {
      await supabase.from('cotizacion_rondas').update({ fotos: detailFotos }).eq('id', detailRonda.id)
    }

    setSavingPrecios(false)
    setError('')
    if (detailRonda) {
      const match = rondas.find((r) => r.id === detailRonda.id)
      if (match) openDetail({ ...match, fotos: detailFotos } as CotizacionRonda & { _count: number })
    }
  }

  // ─── find best price per product ──────────────────────────────────────────

  function bestPricePerProduct(productoId: string): string | null {
    let min = Infinity
    let bestTienda: string | null = null
    for (const t of tiendas) {
      const p = detailPrecios.get(`${productoId}|${t.id}`)
      if (p !== undefined && p < min) {
        min = p
        bestTienda = t.id
      }
    }
    return bestTienda
  }

  // ─── render ───────────────────────────────────────────────────────────────

  if (loading) return <Spinner fullPage />

  // ── DETAIL VIEW ───────────────────────────────────────────────────────────
  if (view === 'detail' && detailRonda) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-5">
        <FormHeader
          title={detailRonda.nombre ?? 'Cotización'}
          onBack={() => { setView('list'); setError('') }}
        />

        <div className="flex items-center gap-2 mb-4 text-sm text-gray-500">
          <span>{formatDate(detailRonda.fecha)}</span>
          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusBadge(detailRonda.status)}`}>
            {detailRonda.status === 'abierta' ? 'Abierta' : 'Cerrada'}
          </span>
          <span>{detailProductos.length} productos</span>
        </div>

        {/* Fotos de evidencia */}
        <div className="mb-4">
          <label className="text-xs font-medium text-gray-500 mb-1.5 block">Evidencia (tickets)</label>
          <FotoUploader
            fotos={detailFotos}
            onChange={setDetailFotos}
            tabla="cotizaciones"
            maxFotos={10}
            readOnly={detailRonda.status !== 'abierta'}
          />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        {/* Leyenda */}
        <div className="flex flex-wrap gap-3 mb-3 text-[10px] text-gray-500">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-300" /> Mejor precio</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-50 border border-red-300" /> Arriba de referencia</span>
        </div>

        {/* ── Desktop: tabla horizontal ── */}
        <div className="hidden md:block overflow-x-auto mb-4">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-semibold border-b border-gray-200 sticky left-0 bg-gray-50 z-10 min-w-[160px]">
                  Producto
                </th>
                <th className="text-center px-3 py-2 font-semibold border-b border-gray-200 min-w-[90px] text-amber-700 bg-amber-50/50">
                  Ref.
                </th>
                {tiendas.map((t) => (
                  <th key={t.id} className="text-center px-3 py-2 font-semibold border-b border-gray-200 min-w-[120px]">
                    {t.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {detailProductos.map((prod) => {
                const bestTienda = bestPricePerProduct(prod.id)
                const ref = prod.precio_referencia
                return (
                  <tr key={prod.id} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-3 py-2 font-medium sticky left-0 bg-white z-10">
                      {prod.nombre_producto}
                    </td>
                    <td className="px-2 py-1.5 text-center text-xs text-amber-700 font-medium bg-amber-50/30">
                      {ref != null ? formatMxn(ref) : '—'}
                    </td>
                    {tiendas.map((t) => {
                      const val = detailPrecios.get(`${prod.id}|${t.id}`)
                      const isBest = bestTienda === t.id && val !== undefined
                      return (
                        <td key={t.id} className="px-2 py-1.5">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            placeholder="—"
                            value={val ?? ''}
                            onChange={(e) => setPrecio(prod.id, t.id, e.target.value)}
                            className={`w-full text-center px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${priceClass(val, ref, isBest)}`}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* ── Mobile: tarjetas por producto ── */}
        <div className="md:hidden flex flex-col gap-3 mb-4">
          {detailProductos.map((prod) => {
            const bestTienda = bestPricePerProduct(prod.id)
            const ref = prod.precio_referencia
            return (
              <div key={prod.id} className="nm-card p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">{prod.nombre_producto}</h3>
                  {ref != null && (
                    <span className="text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full">
                      Ref: {formatMxn(ref)}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {tiendas.map((t) => {
                    const val = detailPrecios.get(`${prod.id}|${t.id}`)
                    const isBest = bestTienda === t.id && val !== undefined
                    return (
                      <div key={t.id}>
                        <label className="text-xs text-gray-500 mb-1 block">{t.nombre}</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="$"
                          value={val ?? ''}
                          onChange={(e) => setPrecio(prod.id, t.id, e.target.value)}
                          className={`w-full px-2 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 ${priceClass(val, ref, isBest)}`}
                        />
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        <Btn onClick={guardarPrecios} loading={savingPrecios} className="w-full">
          Guardar precios
        </Btn>
      </div>
    )
  }

  // ── FORM VIEW ─────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader
          title={editId ? 'Editar cotización' : 'Nueva cotización'}
          onBack={() => { setView('list'); setError('') }}
        />

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Nombre / Folio">
              <Input
                type="text"
                value={formNombre}
                onChange={(e) => setFormNombre(e.target.value)}
                placeholder="COT-20260317-XXXX"
              />
            </FormField>
            <FormField label="Fecha" required>
              <Input
                type="date"
                value={formFecha}
                onChange={(e) => setFormFecha(e.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField label="Notas">
            <Textarea
              value={formNotas}
              onChange={(e) => setFormNotas(e.target.value)}
              placeholder="Opcional"
            />
          </FormField>

          {/* Productos */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">
              Productos a cotizar ({formProductos.length})
            </label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={nuevoProducto}
                onChange={(e) => setNuevoProducto(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addProducto() } }}
                placeholder="Nombre del producto…"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
              <button
                type="button"
                onClick={addProducto}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700"
              >
                +
              </button>
            </div>
            {formProductos.length === 0 ? (
              <p className="text-xs text-gray-400 italic">Escribe el nombre y presiona + o Enter</p>
            ) : (
              <div className="flex flex-col gap-1.5">
                {formProductos.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-xs text-gray-400 w-5 shrink-0">{i + 1}.</span>
                    <span className="flex-1 text-sm">{p.nombre}</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={p.precio_referencia}
                      onChange={(e) => updatePrecioRef(i, e.target.value)}
                      placeholder="Ref $"
                      className="w-24 px-2 py-1 border border-gray-200 rounded-lg text-xs text-right focus:outline-none focus:ring-2 focus:ring-amber-400 bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => removeProducto(i)}
                      className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0"
                    >
                      &times;
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Fotos de evidencia */}
          <FormField label="Fotos de evidencia (tickets)">
            <FotoUploader
              fotos={formFotos}
              onChange={setFormFotos}
              tabla="cotizaciones"
              maxFotos={10}
            />
          </FormField>

          <div className="flex gap-2">
            <Btn type="button" variant="secondary" onClick={() => { setView('list'); setError('') }} className="flex-1">
              Cancelar
            </Btn>
            <Btn type="submit" loading={saving} className="flex-1">
              Guardar
            </Btn>
          </div>
        </form>
      </div>
    )
  }

  // ── LIST VIEW ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Cotizaciones"
        subtitle={`${rondas.length} rondas`}
        action={{ label: 'Nueva ronda', onClick: openNew }}
      />

      {rondas.length === 0 ? (
        <EmptyState
          message="No hay rondas de cotización"
          action={{ label: 'Crear primera', onClick: openNew }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {rondas.map((r) => (
            <div key={r.id} className="nm-card overflow-hidden">
              <button
                type="button"
                onClick={() => openDetail(r)}
                className="w-full text-left p-4 hover:bg-gray-50/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{r.nombre ?? 'Sin nombre'}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusBadge(r.status)}`}>
                        {r.status === 'abierta' ? 'Abierta' : 'Cerrada'}
                      </span>
                      {(r.fotos?.length ?? 0) > 0 && (
                        <svg className="w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {formatDate(r.fecha)} &middot; {r._count} productos
                    </p>
                  </div>
                  <svg className="w-4 h-4 text-gray-400 mt-1" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </button>
              <div className="flex border-t border-[var(--nm-bg-inset)]">
                <button onClick={() => openEdit(r)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50">
                  Editar
                </button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => handleDelete(r.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50">
                  Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20"
      >
        +
      </button>
    </div>
  )
}
