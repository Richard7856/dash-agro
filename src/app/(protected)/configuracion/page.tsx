'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format'
import { Btn } from '@/components/ui/Btn'
import { FormField, Input, Select } from '@/components/ui/FormField'
import type { UserProfile } from '@/lib/types/database.types'

interface ApiKey {
  id: string
  nombre: string
  key_prefix: string
  activo: boolean
  created_at: string
  last_used_at: string | null
}

export default function ConfiguracionPage() {
  /* API Keys state */
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  /* Users state */
  const [users, setUsers] = useState<UserProfile[]>([])
  const [loadingUsers, setLoadingUsers] = useState(true)
  const [showUserModal, setShowUserModal] = useState(false)
  const [userForm, setUserForm] = useState({ email: '', password: '', nombre: '', rol: 'cotizador' })
  const [creatingUser, setCreatingUser] = useState(false)
  const [userError, setUserError] = useState('')

  /* Active tab */
  const [tab, setTab] = useState<'usuarios' | 'api'>('usuarios')

  const loadKeys = useCallback(async () => {
    const { data } = await supabase
      .from('api_keys')
      .select('id, nombre, key_prefix, activo, created_at, last_used_at')
      .order('created_at', { ascending: false })
    setKeys((data ?? []) as ApiKey[])
    setLoading(false)
  }, [])

  const loadUsers = useCallback(async () => {
    const { data } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false })
    setUsers((data ?? []) as UserProfile[])
    setLoadingUsers(false)
  }, [])

  useEffect(() => { loadKeys(); loadUsers() }, [loadKeys, loadUsers])

  /* ─── API Key handlers ─── */

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setGenerating(true)

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setGenerating(false); return }

    const res = await fetch('/api/admin/generate-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ nombre: nombre.trim() }),
    })

    const json = await res.json()
    setGenerating(false)

    if (!res.ok) { alert(json.error); return }

    setGeneratedKey(json.full_key)
    setKeys((prev) => [json, ...prev])
    setNombre('')
  }

  async function handleRevoke(id: string) {
    if (!confirm('¿Revocar esta clave? Los sistemas que la usen dejarán de funcionar.')) return
    setRevoking(id)
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setRevoking(null); return }

    await fetch(`/api/admin/generate-key?id=${id}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${session.access_token}` },
    })

    setKeys((prev) => prev.map((k) => k.id === id ? { ...k, activo: false } : k))
    setRevoking(null)
  }

  function copyKey() {
    if (!generatedKey) return
    navigator.clipboard.writeText(generatedKey)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function closeModal() {
    setShowModal(false)
    setGeneratedKey(null)
    setNombre('')
    setCopied(false)
  }

  /* ─── User handlers ─── */

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault()
    if (!userForm.email || !userForm.password) { setUserError('Email y contraseña requeridos'); return }
    if (userForm.password.length < 6) { setUserError('Contraseña mínimo 6 caracteres'); return }
    setCreatingUser(true)
    setUserError('')

    const { data: { session } } = await supabase.auth.getSession()
    if (!session) { setCreatingUser(false); return }

    const res = await fetch('/api/auth/create-user', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(userForm),
    })

    const json = await res.json()
    setCreatingUser(false)

    if (!res.ok) { setUserError(json.error); return }

    setShowUserModal(false)
    setUserForm({ email: '', password: '', nombre: '', rol: 'cotizador' })
    loadUsers()
  }

  async function toggleUserActivo(u: UserProfile) {
    const newActivo = !u.activo
    await supabase.from('user_profiles').update({ activo: newActivo }).eq('id', u.id)
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, activo: newActivo } : x))
  }

  async function changeUserRol(u: UserProfile, newRol: string) {
    await supabase.from('user_profiles').update({ rol: newRol }).eq('id', u.id)
    setUsers((prev) => prev.map((x) => x.id === u.id ? { ...x, rol: newRol as UserProfile['rol'] } : x))
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <div className="mb-5">
        <h1 className="text-xl font-bold text-[var(--nm-text)]">Configuración</h1>
        <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">Usuarios del sistema y claves API</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-gray-100 rounded-xl p-1">
        <button
          onClick={() => setTab('usuarios')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'usuarios' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Usuarios
        </button>
        <button
          onClick={() => setTab('api')}
          className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === 'api' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
        >
          Claves API
        </button>
      </div>

      {/* ═══ USUARIOS TAB ═══ */}
      {tab === 'usuarios' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-700">{users.length} usuarios</p>
            <Btn onClick={() => { setShowUserModal(true); setUserError('') }}>+ Nuevo usuario</Btn>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
            <p className="font-medium mb-1">Roles</p>
            <p><strong>Admin</strong> — acceso completo a todos los módulos.</p>
            <p><strong>Cotizador</strong> — solo puede ver cotizaciones y llenar precios/fotos en rondas abiertas.</p>
          </div>

          {loadingUsers ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {users.map((u) => (
                <div key={u.id} className={`bg-white rounded-xl border overflow-hidden ${u.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 text-sm">{u.nombre ?? u.email}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          u.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-cyan-100 text-cyan-700'
                        }`}>
                          {u.rol === 'admin' ? 'Admin' : 'Cotizador'}
                        </span>
                        {!u.activo && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">Inactivo</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{u.email}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <select
                        value={u.rol}
                        onChange={(e) => changeUserRol(u, e.target.value)}
                        className="text-xs border border-gray-200 rounded-lg px-2 py-1 bg-white"
                      >
                        <option value="admin">Admin</option>
                        <option value="cotizador">Cotizador</option>
                      </select>
                      <button
                        onClick={() => toggleUserActivo(u)}
                        className={`text-xs font-medium ${u.activo ? 'text-red-500 hover:text-red-700' : 'text-blue-600 hover:text-blue-700'}`}
                      >
                        {u.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal crear usuario */}
          {showUserModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => setShowUserModal(false)}>
              <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-gray-900">Nuevo usuario</h2>
                  <button onClick={() => setShowUserModal(false)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
                </div>
                <form onSubmit={handleCreateUser} className="flex flex-col gap-3">
                  {userError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{userError}</p>}
                  <FormField label="Email" required>
                    <Input
                      type="email"
                      value={userForm.email}
                      onChange={(e) => setUserForm((f) => ({ ...f, email: e.target.value }))}
                      placeholder="correo@ejemplo.com"
                      required
                      autoFocus
                    />
                  </FormField>
                  <FormField label="Contraseña" required>
                    <Input
                      type="password"
                      value={userForm.password}
                      onChange={(e) => setUserForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder="Mínimo 6 caracteres"
                      required
                    />
                  </FormField>
                  <FormField label="Nombre">
                    <Input
                      type="text"
                      value={userForm.nombre}
                      onChange={(e) => setUserForm((f) => ({ ...f, nombre: e.target.value }))}
                      placeholder="Nombre del usuario"
                    />
                  </FormField>
                  <FormField label="Rol">
                    <Select
                      value={userForm.rol}
                      onChange={(e) => setUserForm((f) => ({ ...f, rol: e.target.value }))}
                    >
                      <option value="cotizador">Cotizador</option>
                      <option value="admin">Administrador</option>
                    </Select>
                  </FormField>
                  <div className="flex gap-2 pt-1">
                    <Btn type="button" variant="secondary" onClick={() => setShowUserModal(false)} className="flex-1">Cancelar</Btn>
                    <Btn type="submit" loading={creatingUser} className="flex-1">Crear usuario</Btn>
                  </div>
                </form>
              </div>
            </div>
          )}
        </>
      )}

      {/* ═══ API KEYS TAB ═══ */}
      {tab === 'api' && (
        <>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-700">Claves API</p>
            <Btn onClick={() => setShowModal(true)}>+ Nueva clave</Btn>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
            <p className="font-medium mb-1">¿Cómo funciona?</p>
            <p>Genera una clave y úsala en el header <code className="bg-blue-100 px-1 rounded font-mono text-xs">X-API-Key</code> de cada request. La clave completa solo se muestra <strong>una vez</strong> al crearla.</p>
          </div>

          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-7 h-7 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : keys.length === 0 ? (
            <div className="text-center py-10 text-[var(--nm-text-subtle)] text-sm">Sin claves generadas. Crea una para empezar.</div>
          ) : (
            <div className="flex flex-col gap-3">
              {keys.map((k) => (
                <div key={k.id} className={`bg-white rounded-xl border overflow-hidden ${k.activo ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
                  <div className="p-4 flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-[var(--nm-text)]">{k.nombre}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${k.activo ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-[var(--nm-text-muted)]'}`}>
                          {k.activo ? 'Activa' : 'Revocada'}
                        </span>
                      </div>
                      <p className="text-sm font-mono text-[var(--nm-text-muted)] mt-1">
                        {k.key_prefix}<span className="tracking-widest">••••••••••••••••••••••••••••</span>
                      </p>
                      <div className="flex gap-4 mt-1 text-xs text-[var(--nm-text-subtle)]">
                        <span>Creada {formatDate(k.created_at.split('T')[0])}</span>
                        {k.last_used_at && <span>Último uso {formatDate(k.last_used_at.split('T')[0])}</span>}
                        {!k.last_used_at && <span>Nunca usada</span>}
                      </div>
                    </div>
                    {k.activo && (
                      <button
                        onClick={() => handleRevoke(k.id)}
                        disabled={revoking === k.id}
                        className="text-xs text-red-500 hover:text-red-700 font-medium shrink-0 disabled:opacity-40"
                      >
                        {revoking === k.id ? 'Revocando...' : 'Revocar'}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Modal generar clave */}
          {showModal && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={closeModal}>
              <div className="bg-white rounded-2xl w-full max-w-md p-5" onClick={(e) => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-semibold text-[var(--nm-text)]">
                    {generatedKey ? '¡Clave generada!' : 'Nueva clave API'}
                  </h2>
                  <button onClick={closeModal} className="text-[var(--nm-text-subtle)] hover:text-gray-600 text-xl">✕</button>
                </div>

                {generatedKey ? (
                  <div className="flex flex-col gap-3">
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm text-amber-800">
                      <strong>Guarda esta clave ahora.</strong> No se volverá a mostrar.
                    </div>
                    <div className="flex gap-2">
                      <code className="flex-1 nm-inset px-3 py-2.5 text-sm font-mono text-gray-800 break-all">
                        {generatedKey}
                      </code>
                      <button
                        onClick={copyKey}
                        className={`shrink-0 px-3 py-2 rounded-xl text-sm font-medium transition-colors ${copied ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
                      >
                        {copied ? '✓' : 'Copiar'}
                      </button>
                    </div>
                    <Btn onClick={closeModal} className="w-full mt-1">Listo, la guardé</Btn>
                  </div>
                ) : (
                  <form onSubmit={handleGenerate} className="flex flex-col gap-3">
                    <FormField label="Nombre descriptivo" required>
                      <Input
                        type="text"
                        placeholder="Ej. SAE integración, Script noturno"
                        value={nombre}
                        onChange={(e) => setNombre(e.target.value)}
                        required
                        autoFocus
                      />
                    </FormField>
                    <div className="flex gap-2 pt-1">
                      <Btn type="button" variant="secondary" onClick={closeModal} className="flex-1">Cancelar</Btn>
                      <Btn type="submit" loading={generating} className="flex-1">Generar</Btn>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
