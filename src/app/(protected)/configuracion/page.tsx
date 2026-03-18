'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatDate } from '@/lib/format'
import { Btn } from '@/components/ui/Btn'
import { FormField, Input } from '@/components/ui/FormField'

interface ApiKey {
  id: string
  nombre: string
  key_prefix: string
  activo: boolean
  created_at: string
  last_used_at: string | null
}

export default function ConfiguracionPage() {
  const [keys, setKeys] = useState<ApiKey[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [nombre, setNombre] = useState('')
  const [generating, setGenerating] = useState(false)
  const [generatedKey, setGeneratedKey] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)

  const loadKeys = useCallback(async () => {
    const { data } = await supabase
      .from('api_keys')
      .select('id, nombre, key_prefix, activo, created_at, last_used_at')
      .order('created_at', { ascending: false })
    setKeys((data ?? []) as ApiKey[])
    setLoading(false)
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

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

  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-[var(--nm-text)]">Configuración</h1>
          <p className="text-sm text-[var(--nm-text-muted)] mt-0.5">Gestión de claves API</p>
        </div>
        <Btn onClick={() => setShowModal(true)}>+ Nueva clave</Btn>
      </div>

      {/* Info box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-5 text-sm text-blue-800">
        <p className="font-medium mb-1">¿Cómo funciona?</p>
        <p>Genera una clave y úsala en el header <code className="bg-blue-100 px-1 rounded font-mono text-xs">X-API-Key</code> de cada request. La clave completa solo se muestra <strong>una vez</strong> al crearla.</p>
      </div>

      {/* Lista de claves */}
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

      {/* Modal para generar clave */}
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
                  ⚠️ <strong>Guarda esta clave ahora.</strong> No se volverá a mostrar.
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
    </div>
  )
}
