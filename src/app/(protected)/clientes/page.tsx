'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, formatMxn } from '@/lib/format'
import { FormField, Input } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import type { Cliente } from '@/lib/types/database.types'

const emptyForm = () => ({
  nombre: '', rfc: '', regimen_fiscal: '', codigo_postal: '',
  email: '', telefono: '', notas: '',
  dias_credito: '', limite_credito: '', descuento_pct: '',
})

interface VentaHistorial {
  fecha: string
  numero_venta: string | null
  monto_total: number
  notas: string | null
}

interface InventarioItem {
  id: string
  nombre_producto: string
  cantidad: number
  unidad_medida: string
  precio_compra_unitario: number
}

export default function ClientesPage() {
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [filtroActivo, setFiltroActivo] = useState<'' | 'activo' | 'inactivo'>('')

  const [detailTab, setDetailTab] = useState<'historial' | 'sugerencias'>('historial')
  const [ventas, setVentas] = useState<VentaHistorial[]>([])
  const [inventario, setInventario] = useState<InventarioItem[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('clientes').select('*').order('nombre')
    setClientes(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = clientes.filter((c) => {
    const q = search.toLowerCase()
    const matchSearch = c.nombre.toLowerCase().includes(q) || (c.rfc ?? '').toLowerCase().includes(q)
    const matchActivo = filtroActivo === '' || (filtroActivo === 'activo' ? c.activo : !c.activo)
    return matchSearch && matchActivo
  })

  function openNew() {
    setEditId(null); setForm(emptyForm()); setError(''); setView('form')
  }

  function openEdit(c: Cliente) {
    setEditId(c.id)
    setForm({
      nombre: c.nombre, rfc: c.rfc ?? '', regimen_fiscal: c.regimen_fiscal ?? '',
      codigo_postal: c.codigo_postal ?? '', email: c.email ?? '',
      telefono: c.telefono ?? '', notas: c.notas ?? '',
      dias_credito: c.dias_credito > 0 ? String(c.dias_credito) : '',
      limite_credito: c.limite_credito > 0 ? String(c.limite_credito) : '',
      descuento_pct: c.descuento_pct > 0 ? String(c.descuento_pct) : '',
    })
    setError(''); setView('form')
  }

  async function openDetail(c: Cliente) {
    setSelectedId(c.id); setDetailTab('historial'); setView('detail'); setLoadingDetail(true)
    const [{ data: vs }, { data: inv }] = await Promise.all([
      supabase.from('ventas')
        .select('fecha, numero_venta, monto_total, notas')
        .eq('cliente_id', c.id)
        .order('fecha', { ascending: false }),
      supabase.from('inventario_registros')
        .select('id, nombre_producto, cantidad, unidad_medida, precio_compra_unitario')
        .gt('cantidad', 0)
        .order('cantidad', { ascending: false }),
    ])
    setVentas((vs ?? []) as VentaHistorial[])
    setInventario((inv ?? []) as InventarioItem[])
    setLoadingDetail(false)
  }

  async function toggleActivo(c: Cliente) {
    await supabase.from('clientes').update({ activo: !c.activo }).eq('id', c.id)
    setClientes((cs) => cs.map((x) => x.id === c.id ? { ...x, activo: !x.activo } : x))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    const payload = {
      nombre: form.nombre.trim(),
      rfc: form.rfc || null,
      regimen_fiscal: form.regimen_fiscal || null,
      codigo_postal: form.codigo_postal || null,
      email: form.email || null,
      telefono: form.telefono || null,
      notas: form.notas || null,
      dias_credito: form.dias_credito ? parseInt(form.dias_credito) : 0,
      limite_credito: form.limite_credito ? parseFloat(form.limite_credito) : 0,
      descuento_pct: form.descuento_pct ? parseFloat(form.descuento_pct) : 0,
    }
    let err
    if (editId) {
      ({ error: err } = await supabase.from('clientes').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('clientes').insert({ ...payload, activo: true }))
    }
    if (err) { setError('Error al guardar.'); setSaving(false); return }
    setSaving(false); setView('list'); loadData()
  }

  const selected = selectedId ? clientes.find((c) => c.id === selectedId) : null

  if (loading) return <Spinner fullPage />

  // ─── Form ────────────────────────────────────────────────────────────────
  if (view === 'form') return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <FormHeader title={editId ? 'Editar cliente' : 'Nuevo cliente'} onBack={() => setView('list')} />
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <FormField label="Nombre / Razón Social" required>
          <Input type="text" placeholder="Nombre completo o razón social" value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))} required autoFocus />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="RFC">
            <Input type="text" placeholder="RFC123456XXX" value={form.rfc}
              onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))} />
          </FormField>
          <FormField label="Código Postal">
            <Input type="text" placeholder="09040" value={form.codigo_postal}
              onChange={(e) => setForm((f) => ({ ...f, codigo_postal: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Régimen Fiscal">
          <Input type="text" placeholder="601 - General de Ley Personas Morales" value={form.regimen_fiscal}
            onChange={(e) => setForm((f) => ({ ...f, regimen_fiscal: e.target.value }))} />
        </FormField>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Teléfono">
            <Input type="tel" placeholder="55 1234 5678" value={form.telefono}
              onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))} />
          </FormField>
          <FormField label="Email">
            <Input type="email" placeholder="correo@ejemplo.com" value={form.email}
              onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
          </FormField>
        </div>
        <FormField label="Notas">
          <textarea rows={2} placeholder="Notas adicionales..." value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            className="nm-input w-full px-3.5 py-2.5 text-[15px] text-[var(--nm-text)] placeholder:text-[var(--nm-text-subtle)] resize-none" />
        </FormField>

        {/* Condiciones comerciales — al estilo SAE */}
        <div className="border border-blue-100 rounded-xl p-3 bg-blue-50/40">
          <p className="text-xs font-semibold text-blue-700 mb-2">Condiciones comerciales</p>
          <div className="grid grid-cols-3 gap-2">
            <FormField label="Días crédito">
              <Input type="number" min="0" step="1" placeholder="0"
                value={form.dias_credito}
                onChange={(e) => setForm((f) => ({ ...f, dias_credito: e.target.value }))} />
            </FormField>
            <FormField label="Límite crédito ($)">
              <Input type="number" min="0" step="100" placeholder="0"
                value={form.limite_credito}
                onChange={(e) => setForm((f) => ({ ...f, limite_credito: e.target.value }))} />
            </FormField>
            <FormField label="Descuento auto (%)">
              <Input type="number" min="0" max="100" step="0.5" placeholder="0"
                value={form.descuento_pct}
                onChange={(e) => setForm((f) => ({ ...f, descuento_pct: e.target.value }))} />
            </FormField>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
          <Btn type="submit" loading={saving} className="flex-1">Guardar</Btn>
        </div>
      </form>
    </div>
  )

  // ─── Detail ──────────────────────────────────────────────────────────────
  if (view === 'detail' && selected) {
    const c = selected
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
              <h1 className="text-xl font-bold text-[var(--nm-text)] truncate">{c.nombre}</h1>
              {!c.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactivo</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-[var(--nm-text-subtle)] mt-0.5">
              {c.rfc && <span>RFC: {c.rfc}</span>}
              {c.codigo_postal && <span>CP: {c.codigo_postal}</span>}
              {c.telefono && <span>{c.telefono}</span>}
              {c.email && <span>{c.email}</span>}
            </div>
            {c.regimen_fiscal && <p className="text-xs text-[var(--nm-text-subtle)] mt-0.5">{c.regimen_fiscal}</p>}
          </div>
          <Btn variant="secondary" size="sm" onClick={() => openEdit(c)}>Editar</Btn>
        </div>

        {/* Condiciones comerciales en detail */}
        {(c.descuento_pct > 0 || c.limite_credito > 0 || c.dias_credito > 0) && (
          <div className="grid grid-cols-3 gap-2 mb-4">
            {c.descuento_pct > 0 && (
              <div className="bg-green-50 rounded-xl p-2.5 text-center border border-green-100">
                <p className="text-xs text-green-600 font-medium">Descuento auto</p>
                <p className="text-lg font-bold text-green-700">{c.descuento_pct}%</p>
              </div>
            )}
            {c.limite_credito > 0 && (
              <div className="bg-blue-50 rounded-xl p-2.5 text-center border border-blue-100">
                <p className="text-xs text-blue-600 font-medium">Límite crédito</p>
                <p className="text-sm font-bold text-blue-700">{formatMxn(c.limite_credito)}</p>
              </div>
            )}
            {c.dias_credito > 0 && (
              <div className="bg-gray-50 rounded-xl p-2.5 text-center border border-gray-200">
                <p className="text-xs text-gray-500 font-medium">Días plazo</p>
                <p className="text-lg font-bold text-gray-700">{c.dias_credito}</p>
              </div>
            )}
          </div>
        )}

        {/* Tabs */}
        <div className="flex border-b border-gray-200 mb-4">
          {(['historial', 'sugerencias'] as const).map((tab) => (
            <button key={tab} onClick={() => setDetailTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
                detailTab === tab ? 'border-blue-600 text-blue-700' : 'border-transparent text-[var(--nm-text-muted)] hover:text-gray-700'
              }`}>
              {tab === 'historial' ? 'Historial de ventas' : 'Sugerencias'}
            </button>
          ))}
        </div>

        {loadingDetail ? (
          <Spinner size="sm" />
        ) : detailTab === 'historial' ? (
          ventas.length === 0 ? (
            <div className="text-center py-10 text-[var(--nm-text-subtle)] text-sm">Sin ventas registradas para este cliente.</div>
          ) : (
            <div className="flex flex-col gap-2">
              <p className="text-xs text-[var(--nm-text-subtle)] mb-1">{ventas.length} venta{ventas.length !== 1 ? 's' : ''} registrada{ventas.length !== 1 ? 's' : ''}</p>
              {ventas.map((v, i) => (
                <div key={i} className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-start gap-3">
                  <span className="shrink-0 text-xs font-semibold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full mt-0.5">Venta</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-[var(--nm-text)]">{formatMxn(v.monto_total)}</span>
                      <span className="text-xs text-[var(--nm-text-subtle)]">{formatDate(v.fecha)}</span>
                    </div>
                    {v.numero_venta && <p className="text-xs text-[var(--nm-text-subtle)]">#{v.numero_venta}</p>}
                    {v.notas && <p className="text-xs text-[var(--nm-text-muted)] mt-0.5 truncate">{v.notas}</p>}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div>
            <p className="text-xs text-[var(--nm-text-subtle)] mb-3">Productos con existencia en almacén — ordenados por mayor stock disponible.</p>
            {inventario.length === 0 ? (
              <div className="text-center py-10 text-[var(--nm-text-subtle)] text-sm">Sin productos en existencia actualmente.</div>
            ) : (
              <div className="flex flex-col gap-2">
                {inventario.map((item) => (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--nm-text)] truncate">{item.nombre_producto}</p>
                      <p className="text-xs text-[var(--nm-text-subtle)] mt-0.5">
                        {item.cantidad} {item.unidad_medida} · {formatMxn(item.precio_compra_unitario)}/u
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold bg-blue-50 text-blue-700 px-2 py-1 rounded-lg">
                      {item.cantidad} en stock
                    </span>
                  </div>
                ))}
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
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-[var(--nm-text)]">Clientes</h1>
          <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">{clientes.filter((c) => c.activo).length} activos</p>
        </div>
        <Btn onClick={openNew} className="hidden md:flex">+ Nuevo cliente</Btn>
      </div>

      <div className="flex flex-col gap-2 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input type="text" placeholder="Buscar por nombre o RFC..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="nm-input w-full pl-9 pr-3 py-2.5 text-sm text-[var(--nm-text)] placeholder:text-[var(--nm-text-subtle)]" />
        </div>
        <div className="flex gap-1.5">
          {([['', 'Todos'], ['activo', 'Activos'], ['inactivo', 'Inactivos']] as const).map(([val, label]) => (
            <button key={val} onClick={() => setFiltroActivo(val)}
              className={`px-3 py-1 text-xs rounded-full font-medium border transition-colors ${filtroActivo === val ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
              {label}
            </button>
          ))}
          <span className="ml-auto text-xs text-[var(--nm-text-subtle)] self-center">{filtered.length} cliente{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-[var(--nm-text-subtle)] text-sm">
          {search ? 'Sin resultados.' : 'No hay clientes registrados.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((c) => (
            <div key={c.id} className={`nm-card p-4 ${c.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[var(--nm-text)] truncate">{c.nombre}</p>
                    {!c.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-[var(--nm-text-subtle)]">
                    {c.rfc && <span>{c.rfc}</span>}
                    {c.telefono && <span>{c.telefono}</span>}
                  </div>
                  {(c.descuento_pct > 0 || c.limite_credito > 0 || c.dias_credito > 0) && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {c.descuento_pct > 0 && (
                        <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                          {c.descuento_pct}% dto.
                        </span>
                      )}
                      {c.limite_credito > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          Crédito {formatMxn(c.limite_credito)}
                        </span>
                      )}
                      {c.dias_credito > 0 && (
                        <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                          {c.dias_credito}d plazo
                        </span>
                      )}
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openDetail(c)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">Ver</button>
                  <button onClick={() => openEdit(c)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">Editar</button>
                  <button onClick={() => toggleActivo(c)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${c.activo ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-blue-700 bg-blue-50 hover:bg-blue-100'}`}>
                    {c.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nuevo cliente">+
      </button>
    </div>
  )
}
