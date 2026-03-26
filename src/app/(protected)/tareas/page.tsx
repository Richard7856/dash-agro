'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, todayISO } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth-context'
import type { Tarea, TareaPrioridad, TareaStatus, UserProfile } from '@/lib/types/database.types'

type View = 'list' | 'form'

const PRIORIDADES: { value: TareaPrioridad; label: string; color: string }[] = [
  { value: 'baja', label: 'Baja', color: 'bg-gray-100 text-gray-600' },
  { value: 'normal', label: 'Normal', color: 'bg-blue-100 text-blue-700' },
  { value: 'alta', label: 'Alta', color: 'bg-amber-100 text-amber-700' },
  { value: 'urgente', label: 'Urgente', color: 'bg-red-100 text-red-700' },
]

const STATUS_LABELS: Record<TareaStatus, string> = {
  pendiente: 'Pendiente',
  en_progreso: 'En progreso',
  completada: 'Completada',
  cancelada: 'Cancelada',
}

const STATUS_COLORS: Record<TareaStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  en_progreso: 'bg-blue-100 text-blue-700',
  completada: 'bg-green-100 text-green-700',
  cancelada: 'bg-gray-100 text-gray-500',
}

export default function TareasPage() {
  const { toast } = useToast()
  const { user } = useAuth()

  const [tareas, setTareas] = useState<Tarea[]>([])
  const [usuarios, setUsuarios] = useState<UserProfile[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')
  const [editId, setEditId] = useState<string | null>(null)

  // form
  const [titulo, setTitulo] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [asignadoA, setAsignadoA] = useState('')
  const [prioridad, setPrioridad] = useState<TareaPrioridad>('normal')
  const [fechaLimite, setFechaLimite] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // filters
  const [filtroStatus, setFiltroStatus] = useState<TareaStatus | ''>('')
  const [busqueda, setBusqueda] = useState('')

  const loadData = useCallback(async () => {
    const [{ data: tareasData }, { data: usersData }] = await Promise.all([
      supabase.from('tareas')
        .select('*, asignado:user_profiles!tareas_asignado_a_fkey(nombre, email), creador:user_profiles!tareas_creado_por_fkey(nombre, email)')
        .order('created_at', { ascending: false }).limit(200),
      supabase.from('user_profiles').select('*').eq('activo', true).order('nombre'),
    ])
    setTareas((tareasData ?? []) as Tarea[])
    setUsuarios((usersData ?? []) as UserProfile[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let result = tareas
    if (filtroStatus) result = result.filter(t => t.status === filtroStatus)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter(t => t.titulo.toLowerCase().includes(q) || t.descripcion?.toLowerCase().includes(q))
    }
    return result
  }, [tareas, filtroStatus, busqueda])

  function openNew() {
    setEditId(null)
    setTitulo('')
    setDescripcion('')
    setAsignadoA('')
    setPrioridad('normal')
    setFechaLimite('')
    setNotas('')
    setError('')
    setView('form')
  }

  function openEdit(t: Tarea) {
    setEditId(t.id)
    setTitulo(t.titulo)
    setDescripcion(t.descripcion ?? '')
    setAsignadoA(t.asignado_a ?? '')
    setPrioridad(t.prioridad)
    setFechaLimite(t.fecha_limite ?? '')
    setNotas(t.notas ?? '')
    setError('')
    setView('form')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!titulo.trim()) { setError('Título requerido'); return }
    setSaving(true)
    setError('')

    const payload = {
      titulo: titulo.trim(),
      descripcion: descripcion.trim() || null,
      asignado_a: asignadoA || null,
      prioridad,
      fecha_limite: fechaLimite || null,
      notas: notas.trim() || null,
      updated_at: new Date().toISOString(),
    }

    if (editId) {
      const { error: err } = await supabase.from('tareas').update(payload).eq('id', editId)
      if (err) { setError(err.message); setSaving(false); return }
      toast({ type: 'success', message: 'Tarea actualizada' })
    } else {
      const { error: err } = await supabase.from('tareas').insert({ ...payload, creado_por: user?.id ?? null })
      if (err) { setError(err.message); setSaving(false); return }
      toast({ type: 'success', message: 'Tarea creada' })
    }

    setSaving(false)
    setView('list')
    loadData()
  }

  async function changeStatus(id: string, newStatus: TareaStatus) {
    const update: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'completada') update.completada_at = new Date().toISOString()
    await supabase.from('tareas').update(update).eq('id', id)
    toast({ type: 'success', message: `Tarea marcada como ${STATUS_LABELS[newStatus].toLowerCase()}` })
    loadData()
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta tarea?')) return
    await supabase.from('tareas').delete().eq('id', id)
    loadData()
  }

  // stats
  const pendientes = tareas.filter(t => t.status === 'pendiente').length
  const enProgreso = tareas.filter(t => t.status === 'en_progreso').length
  const completadas = tareas.filter(t => t.status === 'completada').length

  if (loading) return <Spinner fullPage />

  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title={editId ? 'Editar tarea' : 'Nueva tarea'} onBack={() => setView('list')} />
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <FormField label="Título" required>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="¿Qué se debe hacer?" required autoFocus />
          </FormField>

          <FormField label="Descripción">
            <Textarea value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Detalles de la tarea..." />
          </FormField>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Asignar a">
              <SearchSelect
                options={usuarios.map(u => ({ id: u.id, label: u.nombre ?? u.email }))}
                value={asignadoA}
                onChange={setAsignadoA}
                placeholder="Buscar usuario…"
                emptyLabel="— Sin asignar —"
              />
            </FormField>
            <FormField label="Prioridad">
              <Select value={prioridad} onChange={(e) => setPrioridad(e.target.value as TareaPrioridad)}>
                {PRIORIDADES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
              </Select>
            </FormField>
          </div>

          <FormField label="Fecha límite">
            <Input type="date" value={fechaLimite} onChange={(e) => setFechaLimite(e.target.value)} />
          </FormField>

          <FormField label="Notas">
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Notas adicionales..." />
          </FormField>

          <div className="flex gap-2">
            <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">Guardar</Btn>
          </div>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader title="Tareas" subtitle={`${filtered.length} tareas`} action={{ label: '+ Nueva', onClick: openNew }} />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Pendientes</p>
          <p className="text-lg font-bold text-amber-700">{pendientes}</p>
        </div>
        <div className="bg-blue-50 rounded-xl border border-blue-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">En progreso</p>
          <p className="text-lg font-bold text-blue-700">{enProgreso}</p>
        </div>
        <div className="bg-green-50 rounded-xl border border-green-200 p-3 text-center">
          <p className="text-[10px] text-gray-400 uppercase">Completadas</p>
          <p className="text-lg font-bold text-green-700">{completadas}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="text" placeholder="Buscar tarea…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {(['', 'pendiente', 'en_progreso', 'completada', 'cancelada'] as const).map(s => (
            <button key={s} onClick={() => setFiltroStatus(s)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${filtroStatus === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s ? STATUS_LABELS[s] : 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState message="No hay tareas" action={{ label: 'Crear primera', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((t) => {
            const asignado = t.asignado as { nombre: string | null; email: string } | null
            const vencida = t.fecha_limite && t.fecha_limite < todayISO() && t.status !== 'completada' && t.status !== 'cancelada'
            const prioColor = PRIORIDADES.find(p => p.value === t.prioridad)?.color ?? ''
            return (
              <div key={t.id} className={`nm-card overflow-hidden ${vencida ? 'border-l-4 border-l-red-500' : ''}`}>
                <div className="p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`font-semibold text-sm ${t.status === 'completada' ? 'line-through text-gray-400' : ''}`}>{t.titulo}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>{STATUS_LABELS[t.status]}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${prioColor}`}>{t.prioridad}</span>
                      </div>
                      {t.descripcion && <p className="text-xs text-gray-500 mt-1 line-clamp-2">{t.descripcion}</p>}
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                        {asignado && <span>→ {asignado.nombre ?? asignado.email}</span>}
                        {t.fecha_limite && <span className={vencida ? 'text-red-500 font-medium' : ''}>Límite: {formatDate(t.fecha_limite)}</span>}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex border-t border-gray-100 text-xs font-medium">
                  {t.status === 'pendiente' && (
                    <button onClick={() => changeStatus(t.id, 'en_progreso')} className="flex-1 py-2 text-blue-600 hover:bg-blue-50">Iniciar</button>
                  )}
                  {t.status === 'en_progreso' && (
                    <button onClick={() => changeStatus(t.id, 'completada')} className="flex-1 py-2 text-green-600 hover:bg-green-50">Completar</button>
                  )}
                  {(t.status === 'completada' || t.status === 'cancelada') && (
                    <button onClick={() => changeStatus(t.id, 'pendiente')} className="flex-1 py-2 text-amber-600 hover:bg-amber-50">Reabrir</button>
                  )}
                  <div className="w-px bg-gray-100" />
                  <button onClick={() => openEdit(t)} className="flex-1 py-2 text-gray-600 hover:bg-gray-50">Editar</button>
                  <div className="w-px bg-gray-100" />
                  <button onClick={() => handleDelete(t.id)} className="flex-1 py-2 text-red-500 hover:bg-red-50">Eliminar</button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <button onClick={openNew} className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20">+</button>
    </div>
  )
}
