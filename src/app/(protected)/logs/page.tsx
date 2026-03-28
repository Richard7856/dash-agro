'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate, todayISO, firstOfMonthISO } from '@/lib/format'
import { PageHeader } from '@/components/ui/PageHeader'
import { Spinner } from '@/components/ui/Spinner'
import { useAuth } from '@/lib/auth-context'

interface LogEntry {
  id: string
  user_id: string | null
  user_email: string | null
  user_nombre: string | null
  accion: string
  modulo: string
  detalle: string | null
  registro_id: string | null
  created_at: string
}

const MODULOS = ['', 'inventario', 'ventas', 'compras', 'gastos', 'merma', 'cotizaciones', 'tickets', 'tareas', 'checklist', 'configuracion', 'auth']
const ACCIONES = ['', 'crear', 'editar', 'eliminar', 'login', 'cambiar_status', 'autorizar']

const ACCION_COLORS: Record<string, string> = {
  crear: 'bg-green-100 text-green-700',
  editar: 'bg-blue-100 text-blue-700',
  eliminar: 'bg-red-100 text-red-700',
  login: 'bg-purple-100 text-purple-700',
  cambiar_status: 'bg-amber-100 text-amber-700',
  autorizar: 'bg-cyan-100 text-cyan-700',
}

export default function LogsPage() {
  const { profile } = useAuth()
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)

  // filters
  const [filtroDesde, setFiltroDesde] = useState(firstOfMonthISO())
  const [filtroHasta, setFiltroHasta] = useState(todayISO())
  const [filtroUsuario, setFiltroUsuario] = useState('')
  const [filtroModulo, setFiltroModulo] = useState('')
  const [filtroAccion, setFiltroAccion] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [usuarios, setUsuarios] = useState<{ email: string; nombre: string | null }[]>([])

  const loadData = useCallback(async () => {
    setLoading(true)
    let query = supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(500)

    if (filtroDesde) query = query.gte('created_at', `${filtroDesde}T00:00:00`)
    if (filtroHasta) query = query.lte('created_at', `${filtroHasta}T23:59:59`)
    if (filtroUsuario) query = query.eq('user_email', filtroUsuario)
    if (filtroModulo) query = query.eq('modulo', filtroModulo)
    if (filtroAccion) query = query.eq('accion', filtroAccion)

    const { data } = await query
    setLogs((data ?? []) as LogEntry[])

    // Get unique users for filter
    const { data: usersData } = await supabase
      .from('user_profiles')
      .select('email, nombre')
      .order('nombre')
    setUsuarios((usersData ?? []) as { email: string; nombre: string | null }[])

    setLoading(false)
  }, [filtroDesde, filtroHasta, filtroUsuario, filtroModulo, filtroAccion])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    if (!busqueda.trim()) return logs
    const q = busqueda.toLowerCase()
    return logs.filter(l =>
      l.detalle?.toLowerCase().includes(q) ||
      l.user_nombre?.toLowerCase().includes(q) ||
      l.user_email?.toLowerCase().includes(q) ||
      l.modulo.toLowerCase().includes(q)
    )
  }, [logs, busqueda])

  // Only allow specific admin email
  if (profile?.email !== 'prueba@gmail.com' && profile?.rol !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-gray-400">No tienes acceso a esta sección.</p>
      </div>
    )
  }

  if (loading) return <Spinner fullPage />

  return (
    <div className="max-w-3xl mx-auto px-4 py-5">
      <PageHeader title="Registro de Actividad" subtitle={`${filtered.length} registros`} />

      {/* Filters */}
      <div className="flex flex-col gap-2 mb-4">
        <div className="relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input type="text" placeholder="Buscar en detalle…" value={busqueda} onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Desde</label>
            <input type="date" value={filtroDesde} onChange={(e) => setFiltroDesde(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Hasta</label>
            <input type="date" value={filtroHasta} onChange={(e) => setFiltroHasta(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white" />
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Usuario</label>
            <select value={filtroUsuario} onChange={(e) => setFiltroUsuario(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              <option value="">Todos</option>
              {usuarios.map(u => (
                <option key={u.email} value={u.email}>{u.nombre ?? u.email}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] text-gray-400 block mb-0.5">Módulo</label>
            <select value={filtroModulo} onChange={(e) => setFiltroModulo(e.target.value)}
              className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white">
              {MODULOS.map(m => <option key={m} value={m}>{m || 'Todos'}</option>)}
            </select>
          </div>
        </div>

        <div className="flex gap-1.5 flex-wrap">
          {ACCIONES.map(a => (
            <button key={a} onClick={() => setFiltroAccion(a)}
              className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${filtroAccion === a ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {a || 'Todas'}
            </button>
          ))}
        </div>
      </div>

      {/* Logs list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">No hay registros en este período.</div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {filtered.map((l) => {
            const time = new Date(l.created_at)
            const timeStr = time.toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit', hour12: false })
            const dateStr = formatDate(l.created_at.split('T')[0])
            return (
              <div key={l.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2.5 flex items-start gap-3">
                {/* Time */}
                <div className="shrink-0 text-right w-16">
                  <p className="text-xs font-mono text-gray-500">{timeStr}</p>
                  <p className="text-[10px] text-gray-400">{dateStr}</p>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${ACCION_COLORS[l.accion] ?? 'bg-gray-100 text-gray-600'}`}>
                      {l.accion}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 font-medium">
                      {l.modulo}
                    </span>
                  </div>
                  {l.detalle && <p className="text-sm text-gray-700 mt-0.5 line-clamp-2">{l.detalle}</p>}
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {l.user_nombre ?? l.user_email ?? 'Sistema'}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
