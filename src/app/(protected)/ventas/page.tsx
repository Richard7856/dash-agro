'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Venta, Persona, Ubicacion, FormaPago } from '@/lib/types/database.types'

const FORMAS_PAGO: { value: FormaPago; label: string }[] = [
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'bonos_gasolina', label: 'Bonos gasolina' },
  { value: 'mixto', label: 'Mixto' },
  { value: 'otro', label: 'Otro' },
]

const emptyForm = () => ({
  fecha: todayISO(),
  ubicacion_id: '',
  persona_id: '',
  forma_pago: 'efectivo' as FormaPago,
  monto: '',
  notas: '',
})

export default function VentasPage() {
  const [ventas, setVentas] = useState<Venta[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [ubicaciones, setUbicaciones] = useState<Ubicacion[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const [{ data: ventasData }, { data: personasData }, { data: ubicData }] = await Promise.all([
      supabase
        .from('ventas')
        .select('*, personas(nombre), ubicaciones(nombre)')
        .order('fecha', { ascending: false })
        .limit(100),
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
      supabase.from('ubicaciones').select('*').eq('activo', true).order('nombre'),
    ])
    setVentas((ventasData ?? []) as Venta[])
    setPersonas(personasData ?? [])
    setUbicaciones(ubicData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(v: Venta) {
    setEditId(v.id)
    setForm({
      fecha: v.fecha,
      ubicacion_id: v.ubicacion_id ?? '',
      persona_id: v.persona_id ?? '',
      forma_pago: v.forma_pago,
      monto: String(v.monto),
      notas: v.notas ?? '',
    })
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta venta?')) return
    await supabase.from('ventas').delete().eq('id', id)
    setVentas((vs) => vs.filter((v) => v.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || !form.monto) { setError('Fecha y monto son requeridos'); return }
    setSaving(true)
    setError('')

    const payload = {
      fecha: form.fecha,
      ubicacion_id: form.ubicacion_id || null,
      persona_id: form.persona_id || null,
      forma_pago: form.forma_pago,
      monto: parseFloat(form.monto),
      notas: form.notas || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('ventas').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('ventas').insert(payload))
    }

    if (err) { setError('Error al guardar. Revisa los datos.'); setSaving(false); return }

    setSaving(false)
    setView('list')
    setLoading(true)
    loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView('list')} className="p-1 text-gray-500 hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar venta' : 'Nueva venta'}</h1>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
            </FormField>
            <FormField label="Monto (MXN)" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.monto}
                onChange={(e) => setForm((f) => ({ ...f, monto: e.target.value }))}
                required
              />
            </FormField>
          </div>

          <FormField label="Forma de pago">
            <Select value={form.forma_pago} onChange={(e) => setForm((f) => ({ ...f, forma_pago: e.target.value as FormaPago }))}>
              {FORMAS_PAGO.map((fp) => <option key={fp.value} value={fp.value}>{fp.label}</option>)}
            </Select>
          </FormField>

          <FormField label="Persona">
            <Select value={form.persona_id} onChange={(e) => setForm((f) => ({ ...f, persona_id: e.target.value }))}>
              <option value="">— Ninguna —</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
            </Select>
          </FormField>

          <FormField label="Ubicación">
            <Select value={form.ubicacion_id} onChange={(e) => setForm((f) => ({ ...f, ubicacion_id: e.target.value }))}>
              <option value="">— Ninguna —</option>
              {ubicaciones.map((u) => <option key={u.id} value={u.id}>{u.nombre}</option>)}
            </Select>
          </FormField>

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
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Ventas"
        subtitle={`${ventas.length} registros`}
        action={{ label: 'Nueva venta', onClick: openNew }}
      />

      {ventas.length === 0 ? (
        <EmptyState message="No hay ventas registradas" action={{ label: 'Registrar primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {ventas.map((v) => (
            <div key={v.id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-green-700">{formatMxn(v.monto)}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                    <span>{formatDate(v.fecha)}</span>
                    {(v.personas as { nombre: string } | null)?.nombre && (
                      <span>{(v.personas as { nombre: string }).nombre}</span>
                    )}
                    <span className="capitalize">{v.forma_pago.replace('_', ' ')}</span>
                    {(v.ubicaciones as { nombre: string } | null)?.nombre && (
                      <span>{(v.ubicaciones as { nombre: string }).nombre}</span>
                    )}
                  </div>
                  {v.notas && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{v.notas}</p>}
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(v)} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">Editar</button>
                  <button onClick={() => handleDelete(v.id)} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg">Borrar</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva venta"
      >
        +
      </button>
    </div>
  )
}
