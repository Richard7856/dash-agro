'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, formatMxn } from '@/lib/format'
import { FormField, Input } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import type { Proveedor } from '@/lib/types/database.types'

const emptyForm = () => ({
  nombre: '', rfc: '', regimen_fiscal: '', codigo_postal: '',
  email: '', telefono: '', notas: '',
})

interface CompraHistorial {
  fecha: string
  numero_compra: string | null
  monto_total: number
  descripcion: string | null
}

export default function ProveedoresPage() {
  const [proveedores, setProveedores] = useState<Proveedor[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form' | 'detail'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')

  const [compras, setCompras] = useState<CompraHistorial[]>([])
  const [loadingDetail, setLoadingDetail] = useState(false)

  const loadData = useCallback(async () => {
    const { data } = await supabase.from('proveedores').select('*').order('nombre')
    setProveedores(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = proveedores.filter((p) => {
    const q = search.toLowerCase()
    return p.nombre.toLowerCase().includes(q) || (p.rfc ?? '').toLowerCase().includes(q)
  })

  function openNew() {
    setEditId(null); setForm(emptyForm()); setError(''); setView('form')
  }

  function openEdit(p: Proveedor) {
    setEditId(p.id)
    setForm({
      nombre: p.nombre, rfc: p.rfc ?? '', regimen_fiscal: p.regimen_fiscal ?? '',
      codigo_postal: p.codigo_postal ?? '', email: p.email ?? '',
      telefono: p.telefono ?? '', notas: p.notas ?? '',
    })
    setError(''); setView('form')
  }

  async function openDetail(p: Proveedor) {
    setSelectedId(p.id); setView('detail'); setLoadingDetail(true)
    const { data } = await supabase
      .from('compras')
      .select('fecha, numero_compra, monto_total, descripcion')
      .eq('proveedor_id', p.id)
      .order('fecha', { ascending: false })
    setCompras((data ?? []) as CompraHistorial[])
    setLoadingDetail(false)
  }

  async function toggleActivo(p: Proveedor) {
    await supabase.from('proveedores').update({ activo: !p.activo }).eq('id', p.id)
    setProveedores((ps) => ps.map((x) => x.id === p.id ? { ...x, activo: !x.activo } : x))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true); setError('')
    const payload = {
      nombre: form.nombre.trim(),
      rfc: form.rfc || null, regimen_fiscal: form.regimen_fiscal || null,
      codigo_postal: form.codigo_postal || null, email: form.email || null,
      telefono: form.telefono || null, notas: form.notas || null,
    }
    let err
    if (editId) {
      ({ error: err } = await supabase.from('proveedores').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('proveedores').insert({ ...payload, activo: true }))
    }
    if (err) { setError('Error al guardar.'); setSaving(false); return }
    setSaving(false); setView('list'); loadData()
  }

  const selected = selectedId ? proveedores.find((p) => p.id === selectedId) : null

  if (loading) return <Spinner fullPage />

  // ─── Form ────────────────────────────────────────────────────────────────
  if (view === 'form') return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <FormHeader title={editId ? 'Editar proveedor' : 'Nuevo proveedor'} onBack={() => setView('list')} />
      <form onSubmit={handleSave} className="flex flex-col gap-4">
        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
        <FormField label="Nombre / Razón Social" required>
          <Input type="text" placeholder="Nombre o razón social" value={form.nombre}
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
            className="w-full px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent resize-none" />
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
    const p = selected
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
              <h1 className="text-xl font-bold text-[var(--nm-text)] truncate">{p.nombre}</h1>
              {!p.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactivo</span>}
            </div>
            <div className="flex flex-wrap gap-x-3 text-xs text-[var(--nm-text-subtle)] mt-0.5">
              {p.rfc && <span>RFC: {p.rfc}</span>}
              {p.codigo_postal && <span>CP: {p.codigo_postal}</span>}
              {p.telefono && <span>{p.telefono}</span>}
              {p.email && <span>{p.email}</span>}
            </div>
            {p.regimen_fiscal && <p className="text-xs text-[var(--nm-text-subtle)] mt-0.5">{p.regimen_fiscal}</p>}
          </div>
          <Btn variant="secondary" size="sm" onClick={() => openEdit(p)}>Editar</Btn>
        </div>

        <h2 className="text-sm font-semibold text-gray-700 mb-3 border-b border-gray-100 pb-2">Historial de compras</h2>

        {loadingDetail ? (
          <Spinner size="sm" />
        ) : compras.length === 0 ? (
          <div className="text-center py-10 text-[var(--nm-text-subtle)] text-sm">Sin compras registradas para este proveedor.</div>
        ) : (
          <div className="flex flex-col gap-2">
            <p className="text-xs text-[var(--nm-text-subtle)] mb-1">{compras.length} compra{compras.length !== 1 ? 's' : ''} registrada{compras.length !== 1 ? 's' : ''}</p>
            {compras.map((c, i) => (
              <div key={i} className="bg-white border border-gray-200 rounded-xl p-3.5 flex items-start gap-3">
                <span className="shrink-0 text-xs font-semibold bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full mt-0.5">Compra</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-[var(--nm-text)]">{formatMxn(c.monto_total)}</span>
                    <span className="text-xs text-[var(--nm-text-subtle)]">{formatDate(c.fecha)}</span>
                  </div>
                  {c.numero_compra && <p className="text-xs text-[var(--nm-text-subtle)]">#{c.numero_compra}</p>}
                  {c.descripcion && <p className="text-xs text-[var(--nm-text-muted)] mt-0.5 truncate">{c.descripcion}</p>}
                </div>
              </div>
            ))}
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
          <h1 className="text-xl font-bold text-[var(--nm-text)]">Proveedores</h1>
          <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">{proveedores.filter((p) => p.activo).length} activos</p>
        </div>
        <Btn onClick={openNew} className="hidden md:flex">+ Nuevo proveedor</Btn>
      </div>

      <div className="relative mb-4">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--nm-text-subtle)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input type="text" placeholder="Buscar por nombre o RFC..." value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent" />
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-10 text-[var(--nm-text-subtle)] text-sm">
          {search ? 'Sin resultados.' : 'No hay proveedores registrados.'}
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((p) => (
            <div key={p.id} className={`nm-card p-4 ${p.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-[var(--nm-text)] truncate">{p.nombre}</p>
                    {!p.activo && <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-[var(--nm-text-subtle)]">
                    {p.rfc && <span>{p.rfc}</span>}
                    {p.telefono && <span>{p.telefono}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openDetail(p)} className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg">Ver</button>
                  <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">Editar</button>
                  <button onClick={() => toggleActivo(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${p.activo ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}>
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nuevo proveedor">+
      </button>
    </div>
  )
}
