'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { FormField, Input } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import type { Persona } from '@/lib/types/database.types'

const ROLES = ['', 'Vendedor', 'Comprador', 'Administrativo', 'Bodeguero', 'Chofer', 'Cliente', 'Proveedor', 'Otro']

const emptyForm = () => ({
  nombre: '',
  rol: '',
  email: '',
  telefono: '',
})

export default function PersonasPage() {
  const [personas, setPersonas] = useState<Persona[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('personas')
      .select('*')
      .order('nombre')
    setPersonas(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setEditId(null)
    setForm(emptyForm())
    setError('')
    setView('form')
  }

  function openEdit(p: Persona) {
    setEditId(p.id)
    setForm({
      nombre: p.nombre,
      rol: p.rol ?? '',
      email: p.email ?? '',
      telefono: p.telefono ?? '',
    })
    setError('')
    setView('form')
  }

  async function toggleActivo(p: Persona) {
    const { error: err } = await supabase
      .from('personas')
      .update({ activo: !p.activo })
      .eq('id', p.id)
    if (!err) {
      setPersonas((ps) => ps.map((x) => x.id === p.id ? { ...x, activo: !x.activo } : x))
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nombre.trim()) { setError('El nombre es requerido'); return }
    setSaving(true)
    setError('')

    const payload = {
      nombre: form.nombre.trim(),
      rol: form.rol || null,
      email: form.email || null,
      telefono: form.telefono || null,
    }

    let err
    if (editId) {
      ({ error: err } = await supabase.from('personas').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('personas').insert({ ...payload, activo: true }))
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
          <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar persona' : 'Nueva persona'}</h1>
        </div>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <FormField label="Nombre" required>
            <Input
              type="text"
              placeholder="Nombre completo"
              value={form.nombre}
              onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
              required
              autoFocus
            />
          </FormField>

          <FormField label="Rol">
            <select
              className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-gray-300 text-base bg-white focus:outline-none focus:ring-2 focus:ring-green-300 focus:border-transparent"
              value={form.rol}
              onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            >
              {ROLES.map((r) => <option key={r} value={r}>{r || '— Sin rol —'}</option>)}
            </select>
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Teléfono">
              <Input
                type="tel"
                placeholder="33 1234 5678"
                value={form.telefono}
                onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
              />
            </FormField>
            <FormField label="Email">
              <Input
                type="email"
                placeholder="correo@ejemplo.com"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
              />
            </FormField>
          </div>

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
        title="Personas"
        subtitle={`${personas.filter((p) => p.activo).length} activas`}
        action={{ label: 'Nueva persona', onClick: openNew }}
      />

      {personas.length === 0 ? (
        <EmptyState message="No hay personas registradas" action={{ label: 'Agregar primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {personas.map((p) => (
            <div key={p.id} className={`bg-white rounded-xl border p-4 shadow-sm ${p.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">{p.nombre}</p>
                    {p.rol && (
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{p.rol}</span>
                    )}
                    {!p.activo && (
                      <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">Inactiva</span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 mt-1 text-xs text-gray-400">
                    {p.telefono && <span>{p.telefono}</span>}
                    {p.email && <span>{p.email}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <button onClick={() => openEdit(p)} className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg">
                    Editar
                  </button>
                  <button
                    onClick={() => toggleActivo(p)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-lg ${p.activo ? 'text-amber-700 bg-amber-50 hover:bg-amber-100' : 'text-green-700 bg-green-50 hover:bg-green-100'}`}
                  >
                    {p.activo ? 'Desactivar' : 'Activar'}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={openNew}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-green-600 hover:bg-green-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20 active:scale-95 transition-transform"
        aria-label="Nueva persona"
      >
        +
      </button>
    </div>
  )
}
