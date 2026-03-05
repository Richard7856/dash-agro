'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO } from '@/lib/format'
import { FormField, Input, Textarea, Select } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { ConversionBonos, Persona } from '@/lib/types/database.types'

const emptyForm = () => ({
  fecha: todayISO(),
  monto_bonos: '',
  monto_efectivo: '',
  persona_id: '',
  notas: '',
})

export default function BonosPage() {
  const [bonos, setBonos] = useState<ConversionBonos[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const [{ data: bonosData }, { data: personasData }] = await Promise.all([
      supabase
        .from('conversiones_bonos')
        .select('*, personas(nombre)')
        .order('fecha', { ascending: false })
        .limit(100),
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
    ])
    setBonos((bonosData ?? []) as ConversionBonos[])
    setPersonas(personasData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(b: ConversionBonos) {
    setEditId(b.id)
    setForm({
      fecha: b.fecha,
      monto_bonos: String(b.monto_bonos),
      monto_efectivo: String(b.monto_efectivo),
      persona_id: b.persona_id ?? '',
      notas: b.notas ?? '',
    })
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta conversión?')) return
    await supabase.from('conversiones_bonos').delete().eq('id', id)
    setBonos((bs) => bs.filter((b) => b.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || !form.monto_bonos || !form.monto_efectivo) {
      setError('Fecha, monto bonos y monto efectivo son requeridos')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      fecha: form.fecha,
      monto_bonos: parseFloat(form.monto_bonos),
      monto_efectivo: parseFloat(form.monto_efectivo),
      persona_id: form.persona_id || null,
      notas: form.notas || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('conversiones_bonos').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('conversiones_bonos').insert(payload))
    }

    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    setSaving(false)
    setView('list')
    setLoading(true)
    loadData()
  }

  const totalBonosMes = bonos
    .filter((b) => b.fecha.startsWith(todayISO().slice(0, 7)))
    .reduce((s, b) => s + b.monto_bonos, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin" />
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
          <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar conversión' : 'Nueva conversión'}</h1>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <FormField label="Fecha" required>
            <Input type="date" value={form.fecha} onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))} required />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Monto bonos" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.monto_bonos}
                onChange={(e) => setForm((f) => ({ ...f, monto_bonos: e.target.value }))}
                required
              />
            </FormField>
            <FormField label="Equivalente efectivo" required>
              <Input
                type="number" min="0" step="0.01" placeholder="0.00"
                value={form.monto_efectivo}
                onChange={(e) => setForm((f) => ({ ...f, monto_efectivo: e.target.value }))}
                required
              />
            </FormField>
          </div>

          <FormField label="Persona">
            <Select value={form.persona_id} onChange={(e) => setForm((f) => ({ ...f, persona_id: e.target.value }))}>
              <option value="">— Ninguna —</option>
              {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
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
        title="Bonos gasolina"
        subtitle={`${bonos.length} conversiones`}
        action={{ label: 'Nueva conversión', onClick: openNew }}
      />

      {bonos.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-yellow-700 font-medium">Bonos convertidos este mes</p>
          <p className="text-base font-bold text-yellow-700">{formatMxn(totalBonosMes)}</p>
        </div>
      )}

      {bonos.length === 0 ? (
        <EmptyState message="No hay conversiones registradas" action={{ label: 'Registrar primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {bonos.map((b) => (
            <div key={b.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-yellow-700">{formatMxn(b.monto_bonos)} bonos</p>
                      <span className="text-xs text-gray-400">→</span>
                      <p className="font-semibold text-green-700">{formatMxn(b.monto_efectivo)} efectivo</p>
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      <span>{formatDate(b.fecha)}</span>
                      {(b.personas as { nombre: string } | null)?.nombre && (
                        <span>{(b.personas as { nombre: string }).nombre}</span>
                      )}
                    </div>
                    {b.notas && <p className="text-xs text-gray-400 mt-1 line-clamp-1">{b.notas}</p>}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-gray-100">
                <button onClick={() => openEdit(b)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Editar</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => handleDelete(b.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-yellow-500 hover:bg-yellow-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva conversión"
      >
        +
      </button>
    </div>
  )
}
