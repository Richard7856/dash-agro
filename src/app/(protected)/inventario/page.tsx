'use client'

import { useEffect, useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, generateSKU, generateLote } from '@/lib/format'
import { FormField, Input, Select } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { InventarioRegistro, Ubicacion, UnidadMedida } from '@/lib/types/database.types'

const EanScanner = dynamic(() => import('@/components/inventario/EanScanner').then((m) => m.EanScanner), { ssr: false })

const UNIDADES: UnidadMedida[] = ['unidad', 'kg', 'lt', 'caja', 'tarima', 'pieza', 'litro', 'gramo']

const emptyForm = () => ({
  ean: '',
  sku: generateSKU(),
  nombre_producto: '',
  cantidad: '',
  precio_compra_unitario: '',
  unidad_medida: 'unidad' as UnidadMedida,
  cantidad_por_caja: '',
  cajas_por_tarima: '',
  numero_lote: generateLote(),
  fecha_caducidad: '',
  ubicacion_id: '',
})

function getExpiryStatus(fecha: string | null): 'expired' | 'soon' | 'ok' | null {
  if (!fecha) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const expiry = new Date(fecha + 'T00:00:00')
  const diffDays = Math.floor((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 0) return 'expired'
  if (diffDays <= 7) return 'soon'
  return 'ok'
}

export default function InventarioPage() {
  const [registros, setRegistros] = useState<InventarioRegistro[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(false)
  const [hasCamera, setHasCamera] = useState(false)

  useEffect(() => {
    setHasCamera(typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia)
  }, [])

  const loadData = useCallback(async () => {
    const [{ data: regs }, { data: ubics }] = await Promise.all([
      supabase
        .from('inventario_registros')
        .select('*, ubicaciones(nombre)')
        .order('created_at', { ascending: false })
        .limit(200),
      supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre'),
    ])
    setRegistros((regs ?? []) as InventarioRegistro[])
    setUbicaciones(ubics ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(r: InventarioRegistro) {
    setEditId(r.id)
    setForm({
      ean: r.ean ?? '',
      sku: r.sku ?? '',
      nombre_producto: r.nombre_producto,
      cantidad: String(r.cantidad),
      precio_compra_unitario: String(r.precio_compra_unitario),
      unidad_medida: r.unidad_medida,
      cantidad_por_caja: r.cantidad_por_caja != null ? String(r.cantidad_por_caja) : '',
      cajas_por_tarima: r.cajas_por_tarima != null ? String(r.cajas_por_tarima) : '',
      numero_lote: r.numero_lote ?? '',
      fecha_caducidad: r.fecha_caducidad ?? '',
      ubicacion_id: r.ubicacion_id ?? '',
    })
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este registro?')) return
    await supabase.from('inventario_registros').delete().eq('id', id)
    setRegistros((rs) => rs.filter((r) => r.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre_producto || !form.cantidad || !form.precio_compra_unitario) {
      setError('Nombre, cantidad y precio son requeridos')
      return
    }
    setSaving(true)
    setError('')

    const cantidad = parseFloat(form.cantidad)
    const precio_compra_unitario = parseFloat(form.precio_compra_unitario)
    const precio_compra_total = parseFloat((cantidad * precio_compra_unitario).toFixed(2))

    const payload = {
      ean: form.ean || null,
      sku: form.sku || generateSKU(),
      nombre_producto: form.nombre_producto,
      cantidad,
      precio_compra_unitario,
      precio_compra_total,
      unidad_medida: form.unidad_medida,
      cantidad_por_caja: form.cantidad_por_caja ? parseFloat(form.cantidad_por_caja) : null,
      cajas_por_tarima: form.cajas_por_tarima ? parseInt(form.cajas_por_tarima) : null,
      numero_lote: form.numero_lote || generateLote(),
      fecha_caducidad: form.fecha_caducidad || null,
      ubicacion_id: form.ubicacion_id || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('inventario_registros').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('inventario_registros').insert(payload))
    }

    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    setSaving(false)
    setView('list')
    setLoading(true)
    loadData()
  }

  const precioTotal = form.cantidad && form.precio_compra_unitario
    ? (parseFloat(form.cantidad) * parseFloat(form.precio_compra_unitario)).toFixed(2)
    : '0.00'

  // Stats calculadas del lado cliente
  const totalValor = registros.reduce((s, r) => s + (r.precio_compra_total ?? 0), 0)
  const vencenProto = registros.filter((r) => {
    const s = getExpiryStatus(r.fecha_caducidad ?? null)
    return s === 'soon' || s === 'expired'
  }).length

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── FORM VIEW ───────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        {scanning && (
          <EanScanner
            onScan={(ean) => { setForm((f) => ({ ...f, ean })); setScanning(false) }}
            onClose={() => setScanning(false)}
          />
        )}

        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView('list')} className="p-1 text-[var(--nm-text-muted)] hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[var(--nm-text)]">
            {editId ? 'Editar registro' : 'Nuevo registro'}
          </h1>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          {/* EAN */}
          <FormField label="Código EAN">
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Escanear o ingresar manual"
                value={form.ean}
                onChange={(e) => setForm((f) => ({ ...f, ean: e.target.value }))}
              />
              {hasCamera && (
                <button
                  type="button"
                  onClick={() => setScanning(true)}
                  className="px-3 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors shrink-0"
                  title="Escanear"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 9V6a2 2 0 012-2h3M3 15v3a2 2 0 002 2h3m9-16h3a2 2 0 012 2v3m0 6v3a2 2 0 01-2 2h-3" />
                    <rect x="7" y="7" width="10" height="10" rx="1" />
                  </svg>
                </button>
              )}
            </div>
          </FormField>

          <FormField label="Nombre del producto" required>
            <Input
              type="text"
              placeholder="Ej. Aguacate Hass"
              value={form.nombre_producto}
              onChange={(e) => setForm((f) => ({ ...f, nombre_producto: e.target.value }))}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cantidad" required>
              <Input
                type="number" min="0" step="0.001" placeholder="0"
                value={form.cantidad}
                onChange={(e) => setForm((f) => ({ ...f, cantidad: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Unidad">
              <Select value={form.unidad_medida} onChange={(e) => setForm((f) => ({ ...f, unidad_medida: e.target.value as UnidadMedida }))}>
                {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
              </Select>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Precio unitario" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.precio_compra_unitario}
                onChange={(e) => setForm((f) => ({ ...f, precio_compra_unitario: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Precio total">
              <div className="flex items-center min-h-[44px] px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">
                {formatMxn(parseFloat(precioTotal))}
              </div>
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Cant. por caja">
              <Input
                type="number" min="0" step="0.001" placeholder="Opcional"
                value={form.cantidad_por_caja}
                onChange={(e) => setForm((f) => ({ ...f, cantidad_por_caja: e.target.value }))}
              />
            </FormField>
            <FormField label="Cajas / tarima">
              <Input
                type="number" min="0" step="1" placeholder="Opcional"
                value={form.cajas_por_tarima}
                onChange={(e) => setForm((f) => ({ ...f, cajas_por_tarima: e.target.value }))}
              />
            </FormField>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="SKU">
              <Input type="text" value={form.sku} onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))} />
            </FormField>
            <FormField label="Lote">
              <Input type="text" value={form.numero_lote} onChange={(e) => setForm((f) => ({ ...f, numero_lote: e.target.value }))} />
            </FormField>
          </div>

          <FormField label="Fecha de caducidad">
            <Input
              type="date"
              value={form.fecha_caducidad}
              onChange={(e) => setForm((f) => ({ ...f, fecha_caducidad: e.target.value }))}
            />
          </FormField>

          <FormField label="Ubicación">
            <Select value={form.ubicacion_id} onChange={(e) => setForm((f) => ({ ...f, ubicacion_id: e.target.value }))}>
              <option value="">— Ninguna —</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </FormField>

          <div className="flex gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">Guardar</Btn>
          </div>
        </form>
      </div>
    )
  }

  // ─── LIST VIEW ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Inventario"
        subtitle={`${registros.length} registros`}
        action={{ label: 'Nuevo registro', onClick: openNew }}
      />

      {/* Stats del inventario */}
      {registros.length > 0 && (
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
            <p className="text-xs text-[var(--nm-text-subtle)]">Registros</p>
            <p className="text-base font-bold text-[var(--nm-text)]">{registros.length}</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-gray-200 text-center">
            <p className="text-xs text-[var(--nm-text-subtle)]">Valor total</p>
            <p className="text-base font-bold text-green-700 truncate">{formatMxn(totalValor)}</p>
          </div>
          <div className={`rounded-xl p-3 border text-center ${vencenProto > 0 ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
            <p className="text-xs text-[var(--nm-text-subtle)]">Vencen pronto</p>
            <p className={`text-base font-bold ${vencenProto > 0 ? 'text-amber-700' : 'text-[var(--nm-text-subtle)]'}`}>{vencenProto}</p>
          </div>
        </div>
      )}

      {registros.length === 0 ? (
        <EmptyState message="No hay registros de inventario" action={{ label: 'Agregar primero', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {registros.map((r) => {
            const expiryStatus = getExpiryStatus(r.fecha_caducidad ?? null)
            return (
              <div
                key={r.id}
                className={`nm-card p-4 ${expiryStatus === 'expired' ? 'border-red-200' : expiryStatus === 'soon' ? 'border-amber-200' : 'border-gray-200'}`}
              >
                <div className="flex justify-between items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-[var(--nm-text)] truncate">{r.nombre_producto}</p>
                      {expiryStatus === 'expired' && (
                        <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium shrink-0">Vencido</span>
                      )}
                      {expiryStatus === 'soon' && (
                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium shrink-0">Vence pronto</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--nm-text-muted)]">
                      {r.sku && <span>SKU: {r.sku}</span>}
                      {r.numero_lote && <span>Lote: {r.numero_lote}</span>}
                      {(r.ubicaciones as { nombre: string } | null)?.nombre && (
                        <span>{(r.ubicaciones as { nombre: string }).nombre}</span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-2 text-sm">
                      <span className="text-gray-600">{r.cantidad} {r.unidad_medida}</span>
                      <span className="text-[var(--nm-text-subtle)]">·</span>
                      <span className="font-medium text-gray-800">{formatMxn(r.precio_compra_total)}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-[var(--nm-text-subtle)]">
                      <span>Alta: {formatDate(r.created_at.split('T')[0])}</span>
                      {r.fecha_caducidad && (
                        <span className={expiryStatus === 'expired' ? 'text-red-600 font-medium' : expiryStatus === 'soon' ? 'text-amber-600 font-medium' : ''}>
                          Cad: {formatDate(r.fecha_caducidad)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <button onClick={() => openEdit(r)} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">
                      Editar
                    </button>
                    <button onClick={() => handleDelete(r.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">
                      Borrar
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* FAB móvil */}
      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nuevo registro"
      >
        +
      </button>
    </div>
  )
}
