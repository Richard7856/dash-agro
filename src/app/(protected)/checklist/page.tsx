'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, todayISO } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { useToast } from '@/components/ui/Toast'
import { useAuth } from '@/lib/auth-context'
import type { Unidad, ChecklistRegistro } from '@/lib/types/database.types'

type View = 'list' | 'form'

const CHECKS = [
  { key: 'llantas', label: 'Llantas en buen estado' },
  { key: 'aceite', label: 'Nivel de aceite OK' },
  { key: 'luces', label: 'Luces funcionando' },
  { key: 'frenos', label: 'Frenos OK' },
  { key: 'limpieza', label: 'Limpieza general' },
  { key: 'documentos', label: 'Documentos en orden' },
] as const

export default function ChecklistPage() {
  const { toast } = useToast()
  const { user } = useAuth()

  const [registros, setRegistros] = useState<ChecklistRegistro[]>([])
  const [unidades, setUnidades] = useState<Unidad[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<View>('list')

  // form
  const [unidadId, setUnidadId] = useState('')
  const [fecha, setFecha] = useState(todayISO())
  const [checks, setChecks] = useState<Record<string, boolean>>({
    llantas: false, aceite: false, luces: false, frenos: false, limpieza: false, documentos: false,
  })
  const [combustible, setCombustible] = useState('medio')
  const [kilometraje, setKilometraje] = useState('')
  const [notas, setNotas] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const loadData = useCallback(async () => {
    const [{ data: regData }, { data: uniData }] = await Promise.all([
      supabase.from('checklist_registros').select('*, unidades(nombre, placa), user_profiles(nombre, email)')
        .order('fecha', { ascending: false }).limit(200),
      supabase.from('unidades').select('*').eq('activo', true).order('nombre'),
    ])
    setRegistros((regData ?? []) as ChecklistRegistro[])
    setUnidades((uniData ?? []) as Unidad[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  function openNew() {
    setUnidadId(unidades[0]?.id ?? '')
    setFecha(todayISO())
    setChecks({ llantas: false, aceite: false, luces: false, frenos: false, limpieza: false, documentos: false })
    setCombustible('medio')
    setKilometraje('')
    setNotas('')
    setError('')
    setView('form')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!unidadId) { setError('Selecciona una unidad'); return }
    setSaving(true)
    setError('')

    const { error: insErr } = await supabase.from('checklist_registros').insert({
      unidad_id: unidadId,
      fecha,
      ...checks,
      combustible_nivel: combustible,
      kilometraje: kilometraje ? parseFloat(kilometraje) : null,
      notas: notas.trim() || null,
      created_by: user?.id ?? null,
    })

    if (insErr) { setError(insErr.message); setSaving(false); return }
    setSaving(false)
    toast({ type: 'success', message: 'Checklist registrado' })
    setView('list')
    loadData()
  }

  const passedCount = (r: ChecklistRegistro) =>
    [r.llantas, r.aceite, r.luces, r.frenos, r.limpieza, r.documentos].filter(Boolean).length

  if (loading) return <Spinner fullPage />

  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title="Nuevo checklist" onBack={() => setView('list')} />
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Unidad" required>
              <Select value={unidadId} onChange={(e) => setUnidadId(e.target.value)}>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nombre} {u.placa ? `(${u.placa})` : ''}</option>
                ))}
              </Select>
            </FormField>
            <FormField label="Fecha">
              <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} />
            </FormField>
          </div>

          <div>
            <label className="text-sm font-medium text-gray-700 mb-2 block">Revisión</label>
            <div className="flex flex-col gap-2">
              {CHECKS.map(({ key, label }) => (
                <label key={key} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checks[key] ?? false}
                    onChange={(e) => setChecks(prev => ({ ...prev, [key]: e.target.checked }))}
                    className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm">{label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <FormField label="Combustible">
              <Select value={combustible} onChange={(e) => setCombustible(e.target.value)}>
                <option value="vacío">Vacío</option>
                <option value="bajo">Bajo (1/4)</option>
                <option value="medio">Medio (1/2)</option>
                <option value="tres_cuartos">3/4</option>
                <option value="lleno">Lleno</option>
              </Select>
            </FormField>
            <FormField label="Kilometraje">
              <Input type="number" step="0.1" value={kilometraje} onChange={(e) => setKilometraje(e.target.value)} placeholder="km" />
            </FormField>
          </div>

          <FormField label="Notas">
            <Textarea value={notas} onChange={(e) => setNotas(e.target.value)} placeholder="Observaciones..." />
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
      <PageHeader title="Checklist Unidades" subtitle={`${registros.length} registros`} action={{ label: '+ Nuevo', onClick: openNew }} />

      {registros.length === 0 ? (
        <EmptyState message="No hay checklists registrados" action={{ label: 'Crear primero', onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {registros.map((r) => {
            const passed = passedCount(r)
            const uName = (r.unidades as { nombre: string; placa: string | null } | null)
            const userName = (r.user_profiles as { nombre: string | null; email: string } | null)
            return (
              <div key={r.id} className="nm-card p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{uName?.nombre ?? '—'}</p>
                      {uName?.placa && <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{uName.placa}</span>}
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        passed === 6 ? 'bg-green-100 text-green-700' : passed >= 4 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {passed}/6
                      </span>
                    </div>
                    <div className="flex gap-3 mt-1 text-xs text-gray-500">
                      <span>{formatDate(r.fecha)}</span>
                      <span>Comb: {r.combustible_nivel}</span>
                      {r.kilometraje && <span>{r.kilometraje} km</span>}
                    </div>
                    {userName && <p className="text-xs text-gray-400 mt-0.5">Por: {userName.nombre ?? userName.email}</p>}
                  </div>
                </div>
                {r.notas && <p className="text-xs text-gray-400 mt-2 border-t pt-2">{r.notas}</p>}
              </div>
            )
          })}
        </div>
      )}

      <button onClick={openNew} className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center text-2xl z-20">+</button>
    </div>
  )
}
