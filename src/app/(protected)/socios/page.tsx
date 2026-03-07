'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { supabase } from '@/lib/supabase/client'
import { FormField, Input, Select } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'

interface SocioComercial {
  id: string
  tipo: 'cliente' | 'proveedor'
  rfc: string | null
  razon_social: string
  regimen_fiscal: string | null
  codigo_postal: string | null
  activo: boolean
  created_at: string
}

const emptyForm = (tipo: 'cliente' | 'proveedor' = 'cliente') => ({
  tipo,
  rfc: '',
  razon_social: '',
  regimen_fiscal: '',
  codigo_postal: '',
})

// Normalizes column headers from SAE xlsx (handles accents/case)
function normalizeHeader(h: string): string {
  return h
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

export default function SociosPage() {
  const [socios, setSocios] = useState<SocioComercial[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<'cliente' | 'proveedor'>('cliente')
  const [view, setView] = useState<'list' | 'form' | 'import'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [busqueda, setBusqueda] = useState('')

  // XLSX import state
  const fileRef = useRef<HTMLInputElement>(null)
  const [importTipo, setImportTipo] = useState<'cliente' | 'proveedor'>('cliente')
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [allImportRows, setAllImportRows] = useState<Record<string, string>[]>([])
  const [importing, setImporting] = useState(false)
  const [importResult, setImportResult] = useState<{ insertados: number; actualizados: number } | null>(null)

  const loadData = useCallback(async () => {
    const { data } = await supabase
      .from('socios_comerciales')
      .select('*')
      .order('razon_social')
    setSocios((data ?? []) as SocioComercial[])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const filtered = useMemo(() => {
    let result = socios.filter((s) => s.tipo === tab)
    if (busqueda.trim()) {
      const q = busqueda.toLowerCase()
      result = result.filter((s) =>
        s.razon_social.toLowerCase().includes(q) ||
        s.rfc?.toLowerCase().includes(q)
      )
    }
    return result
  }, [socios, tab, busqueda])

  function openNew() {
    setEditId(null)
    setForm(emptyForm(tab))
    setError('')
    setView('form')
  }

  function openEdit(s: SocioComercial) {
    setEditId(s.id)
    setForm({ tipo: s.tipo, rfc: s.rfc ?? '', razon_social: s.razon_social, regimen_fiscal: s.regimen_fiscal ?? '', codigo_postal: s.codigo_postal ?? '' })
    setError('')
    setView('form')
  }

  async function toggleActivo(s: SocioComercial) {
    await supabase.from('socios_comerciales').update({ activo: !s.activo }).eq('id', s.id)
    setSocios((prev) => prev.map((p) => p.id === s.id ? { ...p, activo: !s.activo } : p))
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!form.razon_social.trim()) { setError('Razón Social es requerida'); return }
    setSaving(true); setError('')
    const payload = {
      tipo: form.tipo,
      rfc: form.rfc || null,
      razon_social: form.razon_social.trim(),
      regimen_fiscal: form.regimen_fiscal || null,
      codigo_postal: form.codigo_postal || null,
    }
    let err
    if (editId) {
      ({ error: err } = await supabase.from('socios_comerciales').update(payload).eq('id', editId))
    } else {
      ({ error: err } = await supabase.from('socios_comerciales').insert(payload))
    }
    if (err) { setError(`Error: ${err.message}`); setSaving(false); return }
    setSaving(false); setView('list'); setLoading(true); loadData()
  }

  // ─── XLSX IMPORT ───────────────────────────────────────────────────────────
  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPreviewRows([]); setAllImportRows([]); setImportResult(null)

    const XLSX = (await import('xlsx')).default
    const buffer = await file.arrayBuffer()
    const wb = XLSX.read(buffer, { type: 'array' })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const raw: Record<string, string>[] = XLSX.utils.sheet_to_json(ws, { defval: '' })

    if (!raw.length) { alert('El archivo está vacío o no tiene filas'); return }

    // Normalize headers
    const normalized = raw.map((row) => {
      const out: Record<string, string> = {}
      for (const [k, v] of Object.entries(row)) {
        out[normalizeHeader(k)] = String(v)
      }
      return out
    })

    setAllImportRows(normalized)
    setPreviewRows(normalized.slice(0, 5))
  }

  async function handleImportConfirm() {
    if (!allImportRows.length) return
    setImporting(true); setImportResult(null)

    const rows = allImportRows.map((r) => ({
      tipo: importTipo,
      rfc: r['RFC'] || null,
      razon_social: r['RAZON SOCIAL'] || r['RAZÓN SOCIAL'] || r['RAZON_SOCIAL'] || '',
      regimen_fiscal: r['REGIMEN FISCAL'] || r['RÉGIMEN FISCAL'] || r['REGIMEN_FISCAL'] || null,
      codigo_postal: r['CODIGO POSTAL'] || r['CÓDIGO POSTAL'] || r['CP'] || null,
      activo: true,
    })).filter((r) => r.razon_social)

    // Upsert: if RFC matches, update; else insert
    // Split into with-RFC and without-RFC
    const conRfc = rows.filter((r) => r.rfc)
    const sinRfc = rows.filter((r) => !r.rfc)

    let insertados = 0; let actualizados = 0

    if (conRfc.length) {
      const { data: existing } = await supabase
        .from('socios_comerciales')
        .select('id, rfc')
        .in('rfc', conRfc.map((r) => r.rfc!))
        .eq('tipo', importTipo)

      const existingRfcs = new Set((existing ?? []).map((e) => e.rfc))
      const toInsert = conRfc.filter((r) => !existingRfcs.has(r.rfc))
      const toUpdate = conRfc.filter((r) => existingRfcs.has(r.rfc))

      if (toInsert.length) {
        await supabase.from('socios_comerciales').insert(toInsert)
        insertados += toInsert.length
      }
      for (const r of toUpdate) {
        await supabase.from('socios_comerciales').update(r).eq('rfc', r.rfc!).eq('tipo', importTipo)
        actualizados++
      }
    }

    if (sinRfc.length) {
      await supabase.from('socios_comerciales').insert(sinRfc)
      insertados += sinRfc.length
    }

    setImporting(false)
    setImportResult({ insertados, actualizados })
    setAllImportRows([]); setPreviewRows([])
    if (fileRef.current) fileRef.current.value = ''
    setLoading(true); loadData()
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-green-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ─── FORM ─────────────────────────────────────────────────────────────────
  if (view === 'form') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <div className="flex items-center gap-3 mb-5">
          <button onClick={() => setView('list')} className="p-1 text-gray-500 hover:text-gray-800">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold text-gray-900">{editId ? 'Editar socio' : 'Nuevo socio'}</h1>
        </div>
        <form onSubmit={handleSave} className="flex flex-col gap-4">
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <FormField label="Tipo">
            <Select value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as 'cliente' | 'proveedor' }))}>
              <option value="cliente">Cliente</option>
              <option value="proveedor">Proveedor</option>
            </Select>
          </FormField>
          <FormField label="Razón Social" required>
            <Input type="text" value={form.razon_social} onChange={(e) => setForm((f) => ({ ...f, razon_social: e.target.value }))} required />
          </FormField>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="RFC">
              <Input type="text" value={form.rfc} onChange={(e) => setForm((f) => ({ ...f, rfc: e.target.value.toUpperCase() }))} placeholder="XAXX010101000" />
            </FormField>
            <FormField label="Código Postal">
              <Input type="text" value={form.codigo_postal} onChange={(e) => setForm((f) => ({ ...f, codigo_postal: e.target.value }))} placeholder="64000" />
            </FormField>
          </div>
          <FormField label="Régimen Fiscal">
            <Input type="text" value={form.regimen_fiscal} onChange={(e) => setForm((f) => ({ ...f, regimen_fiscal: e.target.value }))} placeholder="601 - General de Ley Personas Morales" />
          </FormField>
          <div className="flex gap-2 pt-1">
            <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
            <Btn type="submit" loading={saving} className="flex-1">Guardar</Btn>
          </div>
        </form>
      </div>
    )
  }

  // ─── LIST ─────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Socios SAE"
        subtitle={`${filtered.length} ${tab}s`}
        action={{ label: `Nuevo ${tab}`, onClick: openNew }}
      />

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
        {(['cliente', 'proveedor'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors capitalize ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
          >
            Clientes ({socios.filter((s) => s.tipo === 'cliente').length})
            {t === 'proveedor' ? `\nProveedores (${socios.filter((s) => s.tipo === 'proveedor').length})` : ''}
          </button>
        ))}
      </div>
      {/* Fix tab labels */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4 -mt-4">
        <button onClick={() => setTab('cliente')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'cliente' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Clientes ({socios.filter((s) => s.tipo === 'cliente').length})
        </button>
        <button onClick={() => setTab('proveedor')} className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${tab === 'proveedor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
          Proveedores ({socios.filter((s) => s.tipo === 'proveedor').length})
        </button>
      </div>

      {/* Barra de acciones */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="11" cy="11" r="8" /><path d="M21 21l-4.35-4.35" />
          </svg>
          <input
            type="text"
            placeholder="Buscar por RFC o razón social..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white"
          />
        </div>
        <button
          onClick={() => { setImportTipo(tab); setImportResult(null); setPreviewRows([]); setAllImportRows([]); setView('import') }}
          className="px-3 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors whitespace-nowrap"
        >
          Importar XLSX
        </button>
      </div>

      {/* Import result banner */}
      {importResult && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-3 mb-4 text-sm text-green-800">
          ✓ Importación completada: <strong>{importResult.insertados}</strong> nuevos, <strong>{importResult.actualizados}</strong> actualizados.
        </div>
      )}

      {filtered.length === 0 ? (
        <EmptyState message={`No hay ${tab}s registrados`} action={{ label: `Registrar ${tab}`, onClick: openNew }} />
      ) : (
        <div className="flex flex-col gap-2">
          {filtered.map((s) => (
            <div key={s.id} className={`bg-white rounded-xl border overflow-hidden shadow-sm ${!s.activo ? 'opacity-60' : 'border-gray-200'}`}>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm leading-tight">{s.razon_social}</p>
                    <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-gray-500">
                      {s.rfc && <span className="font-mono">{s.rfc}</span>}
                      {s.regimen_fiscal && <span>{s.regimen_fiscal}</span>}
                      {s.codigo_postal && <span>CP {s.codigo_postal}</span>}
                    </div>
                  </div>
                  {!s.activo && <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">Inactivo</span>}
                </div>
              </div>
              <div className="flex border-t border-gray-100">
                <button onClick={() => openEdit(s)} className="flex-1 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors">Editar</button>
                <div className="w-px bg-gray-100" />
                <button onClick={() => toggleActivo(s)} className="flex-1 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50 transition-colors">
                  {s.activo ? 'Desactivar' : 'Activar'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* XLSX Import view */}
      {view === 'import' && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-4" onClick={() => setView('list')}>
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-gray-900">Importar desde XLSX</h2>
              <button onClick={() => setView('list')} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>

            <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-4">
              <button onClick={() => setImportTipo('cliente')} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${importTipo === 'cliente' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Clientes</button>
              <button onClick={() => setImportTipo('proveedor')} className={`flex-1 py-1.5 text-sm font-medium rounded-lg transition-colors ${importTipo === 'proveedor' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'}`}>Proveedores</button>
            </div>

            <div className="bg-gray-50 border border-dashed border-gray-300 rounded-xl p-4 mb-4 text-sm text-gray-500 text-center">
              <p className="mb-2">Formato esperado (SAE):</p>
              <p className="font-mono text-xs">RFC | RAZON SOCIAL | REGIMEN FISCAL | CODIGO POSTAL</p>
            </div>

            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="w-full text-sm text-gray-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 mb-4"
            />

            {previewRows.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-gray-500 mb-2">Vista previa ({allImportRows.length} filas totales, mostrando primeras 5):</p>
                <div className="overflow-x-auto rounded-xl border border-gray-200">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>{Object.keys(previewRows[0]).map((h) => <th key={h} className="px-2 py-1.5 text-left text-gray-500 font-medium whitespace-nowrap">{h}</th>)}</tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewRows.map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          {Object.values(row).map((v, j) => <td key={j} className="px-2 py-1.5 text-gray-700 max-w-[120px] truncate">{String(v)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <Btn type="button" variant="secondary" onClick={() => setView('list')} className="flex-1">Cancelar</Btn>
              <Btn
                type="button"
                loading={importing}
                disabled={!allImportRows.length}
                onClick={handleImportConfirm}
                className="flex-1"
              >
                Importar {allImportRows.length > 0 ? `(${allImportRows.length})` : ''}
              </Btn>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
