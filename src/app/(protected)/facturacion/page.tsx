'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO, generateNumeroFactura } from '@/lib/format'
import { FormField, Input, Textarea, Select } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Factura, FacturaPartida, FacturaTipo, FacturaStatus, Cliente, Proveedor } from '@/lib/types/database.types'

interface PartidaForm {
  id?: string
  descripcion: string
  cantidad: string
  precio_unitario: string
}

const emptyPartida = (): PartidaForm => ({ descripcion: '', cantidad: '1', precio_unitario: '0' })

const emptyForm = () => ({
  fecha: todayISO(),
  tipo: 'ingreso' as FacturaTipo,
  cliente_id: '',
  proveedor_id: '',
  iva_pct: '0',
  notas: '',
})

const STATUS_COLORS: Record<FacturaStatus, string> = {
  borrador:  'bg-gray-100 text-gray-600',
  emitida:   'bg-blue-50 text-blue-700',
  pagada:    'bg-green-50 text-green-700',
  cancelada: 'bg-red-50 text-red-600',
}

const STATUS_LABELS: Record<FacturaStatus, string> = {
  borrador:  'Borrador',
  emitida:   'Emitida',
  pagada:    'Pagada',
  cancelada: 'Cancelada',
}

export default function FacturacionPage() {
  const [facturas, setFacturas] = useState<Factura[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [partidas, setPartidas] = useState<PartidaForm[]>([emptyPartida()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<FacturaStatus | ''>('')
  const [detail, setDetail] = useState<(Factura & { facturas_partidas: FacturaPartida[] }) | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = useCallback(async () => {
    const [{ data: fData }, { data: cData }, { data: pData }] = await Promise.all([
      supabase
        .from('facturas')
        .select('*, clientes(nombre), proveedores(nombre)')
        .order('fecha', { ascending: false })
        .limit(500),
      supabase.from('clientes').select('*').eq('activo', true).order('nombre'),
      supabase.from('proveedores').select('*').eq('activo', true).order('nombre'),
    ])
    setFacturas((fData ?? []) as Factura[])
    setClientes(cData ?? [])
    setProveedores(pData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    return facturas.filter((f) => {
      const q = search.toLowerCase()
      const matchSearch = !q
        || (f.numero_factura ?? '').toLowerCase().includes(q)
        || (f.clientes as { nombre: string } | null)?.nombre.toLowerCase().includes(q)
        || (f.proveedores as { nombre: string } | null)?.nombre.toLowerCase().includes(q)
      const matchStatus = !filterStatus || f.status === filterStatus
      return matchSearch && matchStatus
    })
  }, [facturas, search, filterStatus])

  // ─── Calculos ────────────────────────────────────────────────────────────
  const subtotalCalc = useMemo(() => {
    return partidas.reduce((s, p) => {
      const qty = parseFloat(p.cantidad) || 0
      const price = parseFloat(p.precio_unitario) || 0
      return s + qty * price
    }, 0)
  }, [partidas])

  const ivaMonto = useMemo(() => {
    const pct = parseFloat(form.iva_pct) || 0
    return subtotalCalc * (pct / 100)
  }, [subtotalCalc, form.iva_pct])

  const totalCalc = subtotalCalc + ivaMonto

  // ─── Form handlers ───────────────────────────────────────────────────────
  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setPartidas([emptyPartida()])
    setError('')
    setView('form')
  }

  function openEdit(f: Factura) {
    setEditId(f.id)
    setForm({
      fecha: f.fecha,
      tipo: f.tipo,
      cliente_id: f.cliente_id ?? '',
      proveedor_id: f.proveedor_id ?? '',
      iva_pct: f.subtotal > 0 ? String(Math.round((f.iva / f.subtotal) * 100)) : '0',
      notas: f.notas ?? '',
    })
    setPartidas([emptyPartida()])
    setError('')
    setView('form')
  }

  async function openDetail(f: Factura) {
    setSelectedId(f.id)
    setView('detail')
    setLoadingDetail(true)
    const { data } = await supabase
      .from('facturas')
      .select('*, clientes(nombre), proveedores(nombre), facturas_partidas(*)')
      .eq('id', f.id)
      .single()
    setDetail(data as (Factura & { facturas_partidas: FacturaPartida[] }) | null)
    setLoadingDetail(false)
  }

  function addPartida() { setPartidas((ps) => [...ps, emptyPartida()]) }
  function removePartida(i: number) { setPartidas((ps) => ps.filter((_, idx) => idx !== i)) }
  function updatePartida(i: number, field: keyof PartidaForm, val: string) {
    setPartidas((ps) => ps.map((p, idx) => idx === i ? { ...p, [field]: val } : p))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha) { setError('La fecha es requerida'); return }
    if (partidas.some((p) => !p.descripcion.trim())) { setError('Todas las partidas deben tener descripción'); return }

    setSaving(true)
    setError('')

    const payload = {
      fecha: form.fecha,
      tipo: form.tipo,
      cliente_id: form.tipo === 'ingreso' ? (form.cliente_id || null) : null,
      proveedor_id: form.tipo === 'egreso' ? (form.proveedor_id || null) : null,
      subtotal: subtotalCalc,
      iva: ivaMonto,
      total: totalCalc,
      notas: form.notas || null,
    }

    if (editId) {
      const { error: err } = await supabase.from('facturas').update(payload).eq('id', editId)
      if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
      // Replace partidas
      await supabase.from('facturas_partidas').delete().eq('factura_id', editId)
      const rows = partidas
        .filter((p) => p.descripcion.trim())
        .map((p) => ({
          factura_id: editId,
          descripcion: p.descripcion.trim(),
          cantidad: parseFloat(p.cantidad) || 1,
          precio_unitario: parseFloat(p.precio_unitario) || 0,
          total: (parseFloat(p.cantidad) || 1) * (parseFloat(p.precio_unitario) || 0),
        }))
      if (rows.length > 0) await supabase.from('facturas_partidas').insert(rows)
    } else {
      const numero = generateNumeroFactura()
      const { data: newF, error: err } = await supabase
        .from('facturas')
        .insert({ ...payload, numero_factura: numero, status: 'borrador' })
        .select('id')
        .single()
      if (err || !newF) { setError(`Error: ${err?.message}`); setSaving(false); return }
      const rows = partidas
        .filter((p) => p.descripcion.trim())
        .map((p) => ({
          factura_id: newF.id,
          descripcion: p.descripcion.trim(),
          cantidad: parseFloat(p.cantidad) || 1,
          precio_unitario: parseFloat(p.precio_unitario) || 0,
          total: (parseFloat(p.cantidad) || 1) * (parseFloat(p.precio_unitario) || 0),
        }))
      if (rows.length > 0) await supabase.from('facturas_partidas').insert(rows)
    }

    setSaving(false)
    setView('list')
    loadData()
  }

  async function changeStatus(id: string, status: FacturaStatus) {
    const { error: err } = await supabase.from('facturas').update({ status }).eq('id', id)
    if (err) { setError(`Error: ${err.message}`); return }
    setFacturas((fs) => fs.map((f) => f.id === id ? { ...f, status } : f))
    if (detail && detail.id === id) setDetail((d) => d ? { ...d, status } : d)
  }

  const selected = selectedId ? facturas.find((f) => f.id === selectedId) : null

  if (loading) return <Spinner fullPage />

  // ─── Form ────────────────────────────────────────────────────────────────
  if (view === 'form') return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <FormHeader title={editId ? 'Editar factura' : 'Nueva factura'} onBack={() => setView('list')} />
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Fecha" required>
            <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
          </FormField>
          <FormField label="Tipo">
            <Select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as FacturaTipo, cliente_id: '', proveedor_id: '' }))}>
              <option value="ingreso">Ingreso (venta)</option>
              <option value="egreso">Egreso (compra)</option>
            </Select>
          </FormField>
        </div>

        {form.tipo === 'ingreso' ? (
          <FormField label="Cliente">
            <Select value={form.cliente_id} onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}>
              <option value="">— Sin cliente —</option>
              {clientes.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
            </Select>
          </FormField>
        ) : (
          <FormField label="Proveedor">
            <Select value={form.proveedor_id} onChange={(e) => setForm((f) => ({ ...f, proveedor_id: e.target.value }))}>
              <option value="">— Sin proveedor —</option>
              {proveedores.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </FormField>
        )}

        {/* Partidas */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-semibold text-gray-700">Partidas</p>
            <button type="button" onClick={addPartida} className="text-xs text-green-600 hover:underline">+ Agregar línea</button>
          </div>
          <div className="flex flex-col gap-2">
            {partidas.map((p, i) => (
              <div key={i} className="bg-gray-50 rounded-xl p-3 flex flex-col gap-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1">
                    <Input
                      type="text"
                      placeholder="Descripción del producto/servicio"
                      value={p.descripcion}
                      onChange={(e) => updatePartida(i, 'descripcion', e.target.value)}
                    />
                  </div>
                  {partidas.length > 1 && (
                    <button type="button" onClick={() => removePartida(i)} className="mt-2 text-red-400 hover:text-red-600 shrink-0">
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <p className="text-gray-500 mb-1">Cantidad</p>
                    <Input type="number" min="0" step="0.001" placeholder="1" value={p.cantidad}
                      onChange={(e) => updatePartida(i, 'cantidad', e.target.value)} />
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Precio unit.</p>
                    <Input type="number" min="0" step="0.01" placeholder="0.00" value={p.precio_unitario}
                      onChange={(e) => updatePartida(i, 'precio_unitario', e.target.value)} />
                  </div>
                  <div>
                    <p className="text-gray-500 mb-1">Total</p>
                    <p className="mt-2 text-sm font-semibold text-gray-700">
                      {formatMxn((parseFloat(p.cantidad) || 0) * (parseFloat(p.precio_unitario) || 0))}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Totales */}
        <div className="bg-blue-50 rounded-xl p-3 flex flex-col gap-1.5">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Subtotal</span>
            <span className="font-medium">{formatMxn(subtotalCalc)}</span>
          </div>
          <div className="flex items-center justify-between text-sm gap-3">
            <span className="text-gray-600 shrink-0">IVA %</span>
            <div className="flex items-center gap-2">
              <input
                type="number" min="0" max="100" step="1"
                value={form.iva_pct}
                onChange={(e) => setForm((f) => ({ ...f, iva_pct: e.target.value }))}
                className="w-16 text-center px-2 py-1 rounded-lg border border-blue-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-300"
              />
              <span className="font-medium">{formatMxn(ivaMonto)}</span>
            </div>
          </div>
          <div className="flex justify-between text-base font-bold text-blue-800 border-t border-blue-100 pt-1.5">
            <span>Total</span>
            <span>{formatMxn(totalCalc)}</span>
          </div>
        </div>

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

  // ─── Detail ──────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const f = selected
    const partName = (f.clientes as { nombre: string } | null)?.nombre
      ?? (f.proveedores as { nombre: string } | null)?.nombre
      ?? '—'
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => setView('list')} className="p-1 text-[var(--nm-text-muted)] hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-[var(--nm-text)]">{f.numero_factura ?? 'Factura'}</h1>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status]}`}>{STATUS_LABELS[f.status]}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full ${f.tipo === 'ingreso' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                {f.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
              </span>
            </div>
            <p className="text-xs text-[var(--nm-text-subtle)] mt-0.5">{partName} · {formatDate(f.fecha)}</p>
          </div>
          <Btn variant="secondary" size="sm" onClick={() => openEdit(f)}>Editar</Btn>
        </div>

        {/* Status actions */}
        {f.status !== 'cancelada' && f.status !== 'pagada' && (
          <div className="flex gap-2 mb-4 flex-wrap">
            {f.status === 'borrador' && (
              <button onClick={() => changeStatus(f.id, 'emitida')}
                className="px-3 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-lg">
                Emitir factura
              </button>
            )}
            {(f.status === 'borrador' || f.status === 'emitida') && (
              <button onClick={() => changeStatus(f.id, 'pagada')}
                className="px-3 py-1.5 text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 rounded-lg">
                Marcar pagada
              </button>
            )}
            <button onClick={() => changeStatus(f.id, 'cancelada')}
              className="px-3 py-1.5 text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100 rounded-lg">
              Cancelar
            </button>
          </div>
        )}

        {/* Partidas */}
        {loadingDetail ? <Spinner size="sm" /> : (
          <div className="flex flex-col gap-2">
            {(detail?.facturas_partidas ?? []).map((p, i) => (
              <div key={p.id ?? i} className="bg-white border border-gray-200 rounded-xl p-3 flex items-center justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[var(--nm-text)]">{p.descripcion}</p>
                  <p className="text-xs text-[var(--nm-text-subtle)]">{p.cantidad} × {formatMxn(p.precio_unitario)}</p>
                </div>
                <p className="text-sm font-semibold text-[var(--nm-text)] shrink-0">{formatMxn(p.total)}</p>
              </div>
            ))}

            <div className="bg-gray-50 rounded-xl p-3 flex flex-col gap-1 mt-1">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Subtotal</span>
                <span>{formatMxn(f.subtotal)}</span>
              </div>
              {f.iva > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">IVA</span>
                  <span>{formatMxn(f.iva)}</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-gray-200 pt-1 mt-0.5">
                <span>Total</span>
                <span>{formatMxn(f.total)}</span>
              </div>
            </div>

            {f.notas && (
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3">
                <p className="text-xs font-semibold text-amber-700 mb-1">Notas</p>
                <p className="text-sm text-gray-700">{f.notas}</p>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  // ─── List ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Facturación"
        subtitle={`${filtered.length} factura${filtered.length !== 1 ? 's' : ''}`}
        action={{ label: 'Nueva factura', onClick: openNew }}
      />
      {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{error}</p>}

      {/* Filtros */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input type="text" placeholder="Buscar folio, cliente..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent" />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value as FacturaStatus | '')}
          className="px-3 py-2 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-300">
          <option value="">Todos</option>
          <option value="borrador">Borrador</option>
          <option value="emitida">Emitida</option>
          <option value="pagada">Pagada</option>
          <option value="cancelada">Cancelada</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No hay facturas registradas" action={{ label: 'Crear primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((f) => {
            const partName = (f.clientes as { nombre: string } | null)?.nombre
              ?? (f.proveedores as { nombre: string } | null)?.nombre
            return (
              <div key={f.id} className="nm-card overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--nm-text)]">{f.numero_factura ?? 'Sin folio'}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[f.status]}`}>{STATUS_LABELS[f.status]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${f.tipo === 'ingreso' ? 'bg-green-50 text-green-700' : 'bg-orange-50 text-orange-700'}`}>
                          {f.tipo === 'ingreso' ? 'Ingreso' : 'Egreso'}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-[var(--nm-text-subtle)]">
                        {partName && <span>{partName}</span>}
                        <span>{formatDate(f.fecha)}</span>
                      </div>
                    </div>
                    <p className="text-base font-bold text-[var(--nm-text)] shrink-0">{formatMxn(f.total)}</p>
                  </div>
                </div>
                <div className="flex border-t border-[var(--nm-bg-inset)]">
                  <button onClick={() => openDetail(f)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Ver detalle</button>
                  <div className="w-px bg-gray-100" />
                  <button onClick={() => openEdit(f)} className="flex-1 py-2 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors">Editar</button>
                  {f.status === 'borrador' && (
                    <>
                      <div className="w-px bg-gray-100" />
                      <button onClick={() => changeStatus(f.id, 'emitida')} className="flex-1 py-2 text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors">Emitir</button>
                    </>
                  )}
                  {(f.status === 'borrador' || f.status === 'emitida') && (
                    <>
                      <div className="w-px bg-gray-100" />
                      <button onClick={() => changeStatus(f.id, 'pagada')} className="flex-1 py-2 text-xs font-medium text-green-700 hover:bg-green-50 transition-colors">Pagada</button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva factura">+
      </button>
    </div>
  )
}
