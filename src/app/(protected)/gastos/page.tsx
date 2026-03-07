'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Gasto, Persona } from '@/lib/types/database.types'

const CATEGORIAS = ['flete', 'combustible', 'personal', 'arrendamiento', 'otro']

const emptyForm = () => ({
  fecha: todayISO(),
  concepto: '',
  monto: '',
  categoria: 'otro',
  persona_id: '',
  notas: '',
})

export default function GastosPage() {
  const [gastos, setGastos] = useState<Gasto[]>([])
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const [{ data: gastosData }, { data: personasData }] = await Promise.all([
      supabase
        .from('gastos')
        .select('*, personas(nombre)')
        .order('fecha', { ascending: false })
        .limit(100),
      supabase.from('personas').select('*').eq('activo', true).order('nombre'),
    ])
    setGastos((gastosData ?? []) as Gasto[])
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

  function openEdit(g: Gasto) {
    setEditId(g.id)
    setForm({
      fecha: g.fecha,
      concepto: g.concepto,
      monto: String(g.monto),
      categoria: g.categoria ?? 'otro',
      persona_id: g.persona_id ?? '',
      notas: g.notas ?? '',
    })
    setError('')
    setView('form')
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar este gasto?')) return
    await supabase.from('gastos').delete().eq('id', id)
    setGastos((gs) => gs.filter((g) => g.id !== id))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.fecha || !form.monto || !form.concepto) {
      setError('Fecha, concepto y monto son requeridos')
      return
    }
    setSaving(true)
    setError('')

    const payload = {
      fecha: form.fecha,
      concepto: form.concepto,
      monto: parseFloat(form.monto),
      categoria: form.categoria || null,
      persona_id: form.persona_id || null,
      notas: form.notas || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('gastos').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('gastos').insert(payload))
    }

    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }

    setSaving(false)
    setView('list')
    setLoading(true)
    loadData()
  }

  const totalMes = gastos
    .filter((g) => g.fecha.startsWith(todayISO().slice(0, 7)))
    .reduce((s, g) => s + g.monto, 0)

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView('list')} className="p-1 text-[var(--nm-text-muted)] hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-[var(--nm-text)]">{editId ? 'Editar gasto' : 'Nuevo gasto'}</h1>
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

          <FormField label="Concepto" required>
            <Input
              type="text"
              placeholder="Ej. Flete de aguacate, combustible"
              value={form.concepto}
              onChange={(e) => setForm((f) => ({ ...f, concepto: e.target.value }))}
              required
            />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Categoría">
              <Select value={form.categoria} onChange={(e) => setForm((f) => ({ ...f, categoria: e.target.value }))}>
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c} className="capitalize">{c.charAt(0).toUpperCase() + c.slice(1)}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Persona (pagada a)">
              <Select value={form.persona_id} onChange={(e) => setForm((f) => ({ ...f, persona_id: e.target.value }))}>
                <option value="">— Ninguna —</option>
                {personas.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
              </Select>
            </FormField>
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
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Gastos"
        subtitle={`${gastos.length} registros`}
        action={{ label: 'Nuevo gasto', onClick: openNew }}
      />

      {/* Resumen del mes */}
      {gastos.length > 0 && (
        <div className="bg-red-50 border border-red-100 rounded-xl p-3 mb-4 flex items-center justify-between">
          <p className="text-sm text-red-700 font-medium">Total este mes</p>
          <p className="text-base font-bold text-red-700">{formatMxn(totalMes)}</p>
        </div>
      )}

      {gastos.length === 0 ? (
        <EmptyState message="No hay gastos registrados" action={{ label: 'Registrar primero', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {gastos.map((g) => (
            <div key={g.id} className="nm-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-[var(--nm-text)]">{g.concepto}</p>
                      {g.categoria && (
                        <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full capitalize">
                          {g.categoria}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[var(--nm-text-muted)]">
                      <span>{formatDate(g.fecha)}</span>
                      {(g.personas as { nombre: string } | null)?.nombre && (
                        <span>{(g.personas as { nombre: string }).nombre}</span>
                      )}
                    </div>
                    {g.notas && <p className="text-xs text-[var(--nm-text-subtle)] mt-1 line-clamp-1">{g.notas}</p>}
                  </div>
                  <p className="font-semibold text-red-600 whitespace-nowrap">{formatMxn(g.monto)}</p>
                </div>
              </div>
              <div className="flex border-t border-[var(--nm-bg-inset)]">
                <button onClick={() => openEdit(g)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Editar</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => handleDelete(g.id)} className="flex-1 py-2 text-xs font-medium text-red-500 hover:bg-red-50 transition-colors">Eliminar</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-red-500 hover:bg-red-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nuevo gasto"
      >
        +
      </button>
    </div>
  )
}
