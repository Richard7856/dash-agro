'use client'

import { useEffect, useState, useCallback } from 'react'
import { formatMxn, formatDate } from '@/lib/format'
import { Btn } from '@/components/ui/Btn'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { FormField, Input, Select } from '@/components/ui/FormField'
import {
  USOS_CFDI, FORMAS_PAGO_CFDI, METODOS_PAGO, REGIMENES_FISCALES,
} from '@/lib/facturama'

// Types
interface FacturaCfdi {
  id: string
  facturama_id: string | null
  folio_fiscal: string | null
  serie: string | null
  folio: string | null
  tipo: string
  fecha_emision: string
  receptor_rfc: string
  receptor_nombre: string
  subtotal: number
  iva: number
  total: number
  status: string
  venta_id: string | null
  notas: string | null
  created_at: string
}

interface ConceptoForm {
  descripcion: string
  cantidad: string
  precio_unitario: string
  con_iva: boolean
  codigo_sat: string
}

const emptyConcepto = (): ConceptoForm => ({
  descripcion: '',
  cantidad: '1',
  precio_unitario: '0',
  con_iva: true,
  codigo_sat: '01010101',
})

const STATUS_COLORS: Record<string, string> = {
  emitida: 'bg-green-50 text-green-700',
  cancelada: 'bg-red-50 text-red-700',
  pendiente_cancelacion: 'bg-amber-50 text-amber-700',
}

const TIPO_LABELS: Record<string, string> = {
  I: 'Ingreso',
  E: 'Egreso',
  P: 'Pago',
}

export default function CfdiPage() {
  const [view, setView] = useState<'list' | 'form'>('list')
  const [cfdis, setCfdis] = useState<FacturaCfdi[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [connectionStatus, setConnectionStatus] = useState<{ ok: boolean; ambiente?: string; message?: string } | null>(null)
  const [error, setError] = useState('')

  // Form state
  const [receptorRfc, setReceptorRfc] = useState('')
  const [receptorNombre, setReceptorNombre] = useState('')
  const [receptorUsoCfdi, setReceptorUsoCfdi] = useState('G03')
  const [receptorRegimen, setReceptorRegimen] = useState('616')
  const [receptorCp, setReceptorCp] = useState('')
  const [formaPago, setFormaPago] = useState('01')
  const [metodoPago, setMetodoPago] = useState('PUE')
  const [conceptos, setConceptos] = useState<ConceptoForm[]>([emptyConcepto()])
  const [notas, setNotas] = useState('')

  const loadCfdis = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/facturama/cfdi')
    if (res.ok) {
      const data = await res.json()
      setCfdis(data || [])
    }
    setLoading(false)
  }, [])

  const checkStatus = useCallback(async () => {
    const res = await fetch('/api/facturama/status')
    if (res.ok) setConnectionStatus(await res.json())
  }, [])

  useEffect(() => {
    loadCfdis()
    checkStatus()
  }, [loadCfdis, checkStatus])

  const resetForm = () => {
    setReceptorRfc('')
    setReceptorNombre('')
    setReceptorUsoCfdi('G03')
    setReceptorRegimen('616')
    setReceptorCp('')
    setFormaPago('01')
    setMetodoPago('PUE')
    setConceptos([emptyConcepto()])
    setNotas('')
    setError('')
  }

  const calcSubtotal = () =>
    conceptos.reduce(
      (s, c) => s + (parseFloat(c.precio_unitario) || 0) * (parseFloat(c.cantidad) || 0),
      0
    )

  const calcIva = () =>
    conceptos
      .filter(c => c.con_iva)
      .reduce(
        (s, c) => s + (parseFloat(c.precio_unitario) || 0) * (parseFloat(c.cantidad) || 0) * 0.16,
        0
      )

  const handleEmitir = async () => {
    if (!receptorRfc.trim() || !receptorNombre.trim()) {
      setError('RFC y nombre del receptor son requeridos')
      return
    }
    if (conceptos.some(c => !c.descripcion.trim())) {
      setError('Todos los conceptos deben tener descripción')
      return
    }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/facturama/cfdi', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'I',
          receptor_rfc: receptorRfc.toUpperCase(),
          receptor_nombre: receptorNombre,
          uso_cfdi: receptorUsoCfdi,
          receptor_regimen: receptorRegimen,
          receptor_cp: receptorCp,
          forma_pago: formaPago,
          metodo_pago: metodoPago,
          conceptos: conceptos.map(c => ({
            descripcion: c.descripcion,
            cantidad: parseFloat(c.cantidad) || 1,
            precio_unitario: parseFloat(c.precio_unitario) || 0,
            con_iva: c.con_iva,
            codigo_sat: c.codigo_sat || '01010101',
          })),
          notas,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al emitir')
      resetForm()
      setView('list')
      loadCfdis()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setSaving(false)
    }
  }

  const handleCancelar = async (cfdi: FacturaCfdi) => {
    if (!confirm(`¿Cancelar CFDI ${cfdi.folio_fiscal?.slice(0, 8)}...? Esta acción no se puede deshacer.`)) return
    const res = await fetch(`/api/facturama/cfdi/${cfdi.id}?motivo=02`, { method: 'DELETE' })
    if (res.ok) loadCfdis()
    else {
      const data = await res.json()
      alert(data.error || 'Error al cancelar')
    }
  }

  const handleDescargar = (cfdi: FacturaCfdi, tipo: 'pdf' | 'xml') => {
    window.open(`/api/facturama/cfdi/${cfdi.id}?action=${tipo}`, '_blank')
  }

  const filtered = cfdis.filter(c =>
    !search ||
    c.receptor_rfc.toLowerCase().includes(search.toLowerCase()) ||
    c.receptor_nombre.toLowerCase().includes(search.toLowerCase()) ||
    (c.folio_fiscal || '').toLowerCase().includes(search.toLowerCase())
  )

  if (view === 'form') {
    const subtotal = calcSubtotal()
    const iva = calcIva()
    const total = subtotal + iva

    return (
      <div className="max-w-2xl mx-auto p-4 pb-24">
        <FormHeader title="Emitir CFDI" onBack={() => { resetForm(); setView('list') }} />

        {/* Ambiente badge */}
        {connectionStatus && (
          <div className={`mb-4 px-3 py-2 rounded-lg text-sm font-medium ${
            !connectionStatus.ok
              ? 'bg-red-50 text-red-700'
              : connectionStatus.ambiente === 'sandbox'
              ? 'bg-amber-50 text-amber-700'
              : 'bg-green-50 text-green-700'
          }`}>
            {!connectionStatus.ok
              ? `Sin conexión a Facturama — ${connectionStatus.message || 'verifica la configuración'}`
              : connectionStatus.ambiente === 'sandbox'
              ? 'Modo SANDBOX — las facturas no tienen valor fiscal'
              : 'Conectado a Facturama (Producción)'}
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
            {error.includes('no está configurado')
              ? <>Facturama no está configurado. <a href="/configuracion" className="underline font-medium">Ir a Configuración → CFDI</a></>
              : error}
          </div>
        )}

        {/* Receptor */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-4">
          <h3 className="font-semibold text-gray-700 mb-3">Receptor</h3>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="RFC Receptor" required>
              <Input
                value={receptorRfc}
                onChange={e => setReceptorRfc(e.target.value.toUpperCase())}
                placeholder="RFC del cliente"
                maxLength={13}
              />
            </FormField>
            <FormField label="Uso CFDI" required>
              <Select value={receptorUsoCfdi} onChange={e => setReceptorUsoCfdi(e.target.value)}>
                {USOS_CFDI.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </Select>
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="Nombre / Razón Social" required>
              <Input
                value={receptorNombre}
                onChange={e => setReceptorNombre(e.target.value)}
                placeholder="Nombre fiscal completo"
              />
            </FormField>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3">
            <FormField label="Régimen Fiscal" required>
              <Select value={receptorRegimen} onChange={e => setReceptorRegimen(e.target.value)}>
                {REGIMENES_FISCALES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
              </Select>
            </FormField>
            <FormField label="CP Fiscal" required>
              <Input
                value={receptorCp}
                onChange={e => setReceptorCp(e.target.value)}
                placeholder="Código postal"
                maxLength={5}
              />
            </FormField>
          </div>
        </div>

        {/* Pago */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-4">
          <h3 className="font-semibold text-gray-700 mb-3">Forma de Pago</h3>
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Forma de pago">
              <Select value={formaPago} onChange={e => setFormaPago(e.target.value)}>
                {FORMAS_PAGO_CFDI.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
              </Select>
            </FormField>
            <FormField label="Método de pago">
              <Select value={metodoPago} onChange={e => setMetodoPago(e.target.value)}>
                {METODOS_PAGO.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
              </Select>
            </FormField>
          </div>
        </div>

        {/* Conceptos */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-gray-700">Conceptos</h3>
            <Btn
              size="sm"
              variant="ghost"
              onClick={() => setConceptos(prev => [...prev, emptyConcepto()])}
            >
              + Agregar
            </Btn>
          </div>
          <div className="space-y-4">
            {conceptos.map((c, i) => (
              <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                <div className="flex items-start gap-2 mb-2">
                  <div className="flex-1">
                    <FormField label="Descripción">
                      <Input
                        value={c.descripcion}
                        onChange={e => setConceptos(prev => prev.map((x, j) => j === i ? { ...x, descripcion: e.target.value } : x))}
                        placeholder="Descripción del producto/servicio"
                      />
                    </FormField>
                  </div>
                  {conceptos.length > 1 && (
                    <button
                      onClick={() => setConceptos(prev => prev.filter((_, j) => j !== i))}
                      className="mt-6 text-red-400 hover:text-red-600 text-lg leading-none"
                    >
                      ×
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <FormField label="Cantidad">
                    <Input
                      type="number"
                      value={c.cantidad}
                      onChange={e => setConceptos(prev => prev.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))}
                      min="0.001"
                      step="any"
                    />
                  </FormField>
                  <FormField label="Precio unitario">
                    <Input
                      type="number"
                      value={c.precio_unitario}
                      onChange={e => setConceptos(prev => prev.map((x, j) => j === i ? { ...x, precio_unitario: e.target.value } : x))}
                      min="0"
                      step="0.01"
                    />
                  </FormField>
                  <div className="flex flex-col justify-end pb-1">
                    <span className="text-xs text-gray-500 mb-1">Subtotal</span>
                    <span className="text-sm font-medium text-gray-800">
                      {formatMxn((parseFloat(c.precio_unitario) || 0) * (parseFloat(c.cantidad) || 0))}
                    </span>
                  </div>
                </div>
                <label className="flex items-center gap-2 mt-2 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={c.con_iva}
                    onChange={e => setConceptos(prev => prev.map((x, j) => j === i ? { ...x, con_iva: e.target.checked } : x))}
                    className="rounded"
                  />
                  Incluir IVA 16%
                </label>
              </div>
            ))}
          </div>

          {/* Totales */}
          <div className="mt-4 pt-3 border-t border-gray-200 space-y-1 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal</span><span>{formatMxn(subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600">
              <span>IVA 16%</span><span>{formatMxn(iva)}</span>
            </div>
            <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200 mt-1">
              <span>Total</span><span>{formatMxn(total)}</span>
            </div>
          </div>
        </div>

        {/* Notas */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-6">
          <FormField label="Notas (opcional)">
            <Input
              value={notas}
              onChange={e => setNotas(e.target.value)}
              placeholder="Observaciones internas"
            />
          </FormField>
        </div>

        <Btn onClick={handleEmitir} loading={saving} className="w-full" disabled={saving}>
          Emitir CFDI
        </Btn>
      </div>
    )
  }

  // LIST VIEW
  return (
    <div className="p-4 pb-24">
      <PageHeader
        title="Facturación CFDI"
        action={{ label: 'Emitir CFDI', onClick: () => { resetForm(); setView('form') } }}
      />

      {/* Connection status */}
      {connectionStatus && (
        <div className={`mb-4 px-3 py-2 rounded-lg text-sm font-medium inline-flex items-center gap-2 ${
          !connectionStatus.ok
            ? 'bg-red-50 text-red-700'
            : connectionStatus.ambiente === 'sandbox'
            ? 'bg-amber-50 text-amber-700'
            : 'bg-green-50 text-green-700'
        }`}>
          <span className="w-2 h-2 rounded-full bg-current" />
          {!connectionStatus.ok
            ? 'Sin conexión a Facturama'
            : connectionStatus.ambiente === 'sandbox'
            ? 'Sandbox activo'
            : 'Conectado (Producción)'}
        </div>
      )}

      {/* Search */}
      <div className="mb-4">
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por RFC, nombre o folio fiscal..."
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState
          message={search ? 'No hay CFDIs que coincidan con la búsqueda' : 'Sin CFDIs. Emite tu primer CFDI con el botón de arriba.'}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map(cfdi => (
            <div
              key={cfdi.id}
              className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">
                      {cfdi.serie}{cfdi.folio}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[cfdi.status] || 'bg-gray-100 text-gray-600'}`}>
                      {cfdi.status}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                      {TIPO_LABELS[cfdi.tipo] || cfdi.tipo}
                    </span>
                  </div>
                  <p className="text-sm font-medium text-gray-800 truncate">{cfdi.receptor_nombre}</p>
                  <p className="text-xs text-gray-500">{cfdi.receptor_rfc}</p>
                  {cfdi.folio_fiscal && (
                    <p className="text-xs text-gray-400 mt-0.5 font-mono">
                      {cfdi.folio_fiscal.slice(0, 18)}...
                    </p>
                  )}
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-gray-900">{formatMxn(cfdi.total)}</p>
                  <p className="text-xs text-gray-400">{formatDate(cfdi.fecha_emision.split('T')[0])}</p>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                {cfdi.facturama_id && (
                  <>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDescargar(cfdi, 'pdf')}
                    >
                      PDF
                    </Btn>
                    <Btn
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDescargar(cfdi, 'xml')}
                    >
                      XML
                    </Btn>
                  </>
                )}
                {cfdi.status === 'emitida' && (
                  <Btn
                    size="sm"
                    variant="ghost"
                    onClick={() => handleCancelar(cfdi)}
                    className="text-red-500 hover:bg-red-50"
                  >
                    Cancelar
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
