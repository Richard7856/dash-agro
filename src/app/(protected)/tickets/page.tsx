'use client'

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate } from '@/lib/format'
import { Btn } from '@/components/ui/Btn'
import { FormField, Input, Textarea } from '@/components/ui/FormField'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { useAuth } from '@/lib/auth-context'
import type { TicketAnalisis, TicketItem, TicketStatus } from '@/lib/types/database.types'

type View = 'list' | 'upload' | 'review' | 'detail'

const STATUS_LABELS: Record<TicketStatus, string> = {
  pendiente: 'Pendiente',
  revisado: 'Revisado',
  autorizado: 'Autorizado',
  guardado: 'Guardado',
}

const STATUS_COLORS: Record<TicketStatus, string> = {
  pendiente: 'bg-amber-100 text-amber-700',
  revisado: 'bg-blue-100 text-blue-700',
  autorizado: 'bg-green-100 text-green-700',
  guardado: 'bg-gray-100 text-gray-600',
}

export default function TicketsPage() {
  const { isAdmin, user } = useAuth()

  /* list */
  const [tickets, setTickets] = useState<TicketAnalisis[]>([])
  const [loading, setLoading] = useState(true)

  /* view */
  const [view, setView] = useState<View>('list')

  /* upload */
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  /* review (after AI analysis, before saving) */
  const [reviewFotoUrl, setReviewFotoUrl] = useState('')
  const [reviewTienda, setReviewTienda] = useState('')
  const [reviewFecha, setReviewFecha] = useState('')
  const [reviewMetodoPago, setReviewMetodoPago] = useState('')
  const [reviewSubtotal, setReviewSubtotal] = useState('')
  const [reviewIva, setReviewIva] = useState('')
  const [reviewTotal, setReviewTotal] = useState('')
  const [reviewItems, setReviewItems] = useState<{ descripcion: string; cantidad: number; precio_unitario: number; total: number }[]>([])
  const [reviewNotas, setReviewNotas] = useState('')
  const [saving, setSaving] = useState(false)

  /* detail */
  const [detailTicket, setDetailTicket] = useState<TicketAnalisis | null>(null)
  const [detailItems, setDetailItems] = useState<TicketItem[]>([])

  // ─── load ─────────────────────────────────────────────────────────────────

  const loadTickets = useCallback(async () => {
    const { data } = await supabase
      .from('ticket_analisis')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200)
    setTickets((data ?? []) as TicketAnalisis[])
    setLoading(false)
  }, [])

  useEffect(() => { loadTickets() }, [loadTickets])

  // ─── upload + analyze ─────────────────────────────────────────────────────

  async function handleUpload(file: File) {
    setUploading(true)
    setError('')

    // 1. Upload to Supabase Storage
    const ext = file.name.split('.').pop() ?? 'jpg'
    const path = `tickets/${Date.now()}.${ext}`

    const { error: upErr } = await supabase.storage
      .from('evidencias')
      .upload(path, file)

    if (upErr) {
      setError(`Error subiendo foto: ${upErr.message}`)
      setUploading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('evidencias').getPublicUrl(path)
    const fotoUrl = urlData.publicUrl

    // 2. Analyze with AI
    const fd = new FormData()
    fd.append('file', file)

    const res = await fetch('/api/v1/tickets/analyze', { method: 'POST', body: fd })
    const json = await res.json()
    setUploading(false)

    if (!res.ok) {
      setError(json.error ?? 'Error analizando ticket')
      return
    }

    const d = json.data

    // 3. Populate review form
    setReviewFotoUrl(fotoUrl)
    setReviewTienda(d.tienda ?? '')
    setReviewFecha(d.fecha ?? '')
    setReviewMetodoPago(d.metodo_pago ?? '')
    setReviewSubtotal(d.subtotal != null ? String(d.subtotal) : '')
    setReviewIva(d.iva != null ? String(d.iva) : '')
    setReviewTotal(d.total != null ? String(d.total) : '')
    setReviewItems(d.items ?? [])
    setReviewNotas('')
    setView('review')
  }

  // ─── save review ──────────────────────────────────────────────────────────

  async function handleSaveReview() {
    setSaving(true)
    setError('')

    const { data: ticket, error: tErr } = await supabase
      .from('ticket_analisis')
      .insert({
        foto_url: reviewFotoUrl,
        tienda_detectada: reviewTienda || null,
        fecha_ticket: reviewFecha || null,
        subtotal: reviewSubtotal ? parseFloat(reviewSubtotal) : null,
        iva: reviewIva ? parseFloat(reviewIva) : null,
        total: reviewTotal ? parseFloat(reviewTotal) : null,
        metodo_pago: reviewMetodoPago || null,
        status: 'pendiente' as TicketStatus,
        notas: reviewNotas || null,
        created_by: user?.id ?? null,
      })
      .select()
      .single()

    if (tErr || !ticket) {
      setError(tErr?.message ?? 'Error guardando')
      setSaving(false)
      return
    }

    // Save items
    if (reviewItems.length > 0) {
      await supabase.from('ticket_items').insert(
        reviewItems.map((i) => ({
          ticket_id: ticket.id,
          descripcion: i.descripcion,
          cantidad: i.cantidad,
          precio_unitario: i.precio_unitario,
          total: i.total,
        }))
      )
    }

    setSaving(false)
    setView('list')
    loadTickets()
  }

  // ─── edit review item ─────────────────────────────────────────────────────

  function updateReviewItem(idx: number, field: string, value: string) {
    setReviewItems((prev) => prev.map((item, i) => {
      if (i !== idx) return item
      const updated = { ...item, [field]: field === 'descripcion' ? value : (parseFloat(value) || 0) }
      if (field === 'cantidad' || field === 'precio_unitario') {
        updated.total = updated.cantidad * updated.precio_unitario
      }
      return updated
    }))
  }

  function removeReviewItem(idx: number) {
    setReviewItems((prev) => prev.filter((_, i) => i !== idx))
  }

  function addReviewItem() {
    setReviewItems((prev) => [...prev, { descripcion: '', cantidad: 1, precio_unitario: 0, total: 0 }])
  }

  // ─── detail ───────────────────────────────────────────────────────────────

  async function openDetail(t: TicketAnalisis) {
    setDetailTicket(t)
    const { data } = await supabase
      .from('ticket_items')
      .select('*')
      .eq('ticket_id', t.id)
      .order('created_at')
    setDetailItems((data ?? []) as TicketItem[])
    setView('detail')
  }

  async function changeStatus(t: TicketAnalisis, newStatus: TicketStatus) {
    const update: Record<string, unknown> = { status: newStatus, updated_at: new Date().toISOString() }
    if (newStatus === 'autorizado') update.authorized_by = user?.id ?? null
    await supabase.from('ticket_analisis').update(update).eq('id', t.id)
    setDetailTicket({ ...t, status: newStatus })
    loadTickets()
  }

  async function handleDeleteTicket(id: string) {
    if (!confirm('¿Eliminar este ticket?')) return
    await supabase.from('ticket_analisis').delete().eq('id', id)
    setView('list')
    loadTickets()
  }

  // ─── render ───────────────────────────────────────────────────────────────

  if (loading) return <Spinner fullPage />

  // ── DETAIL ────────────────────────────────────────────────────────────────
  if (view === 'detail' && detailTicket) {
    const t = detailTicket
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title="Detalle del ticket" onBack={() => { setView('list'); setError('') }} />

        {/* Foto */}
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-200">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={t.foto_url} alt="Ticket" className="w-full max-h-80 object-contain bg-gray-50" />
        </div>

        {/* Info */}
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Tienda</p>
            <p className="text-sm font-medium">{t.tienda_detectada ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Fecha</p>
            <p className="text-sm font-medium">{t.fecha_ticket ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-sm font-bold">{t.total != null ? formatMxn(t.total) : '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <p className="text-xs text-gray-500">Método pago</p>
            <p className="text-sm font-medium">{t.metodo_pago ?? '—'}</p>
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 mb-4">
          <span className={`text-xs px-2 py-1 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
            {STATUS_LABELS[t.status]}
          </span>

          {t.status === 'pendiente' && (
            <button onClick={() => changeStatus(t, 'revisado')}
              className="text-xs px-3 py-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
              Marcar revisado
            </button>
          )}
          {t.status === 'revisado' && isAdmin && (
            <button onClick={() => changeStatus(t, 'autorizado')}
              className="text-xs px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700">
              Autorizar
            </button>
          )}
          {isAdmin && (
            <button onClick={() => handleDeleteTicket(t.id)}
              className="text-xs px-3 py-1 text-red-500 hover:bg-red-50 rounded-lg ml-auto">
              Eliminar
            </button>
          )}
        </div>

        {t.notas && (
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-sm text-amber-800">
            {t.notas}
          </div>
        )}

        {/* Items */}
        <h3 className="font-semibold text-sm mb-2">Productos ({detailItems.length})</h3>
        {detailItems.length === 0 ? (
          <p className="text-sm text-gray-400 italic">Sin productos extraídos</p>
        ) : (
          <div className="nm-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50">
                  <th className="text-left px-3 py-2 font-semibold border-b">Producto</th>
                  <th className="text-right px-3 py-2 font-semibold border-b">Cant</th>
                  <th className="text-right px-3 py-2 font-semibold border-b">P.U.</th>
                  <th className="text-right px-3 py-2 font-semibold border-b">Total</th>
                </tr>
              </thead>
              <tbody>
                {detailItems.map((item) => (
                  <tr key={item.id} className="border-b border-gray-100">
                    <td className="px-3 py-2">{item.descripcion}</td>
                    <td className="px-3 py-2 text-right">{Number(item.cantidad)}</td>
                    <td className="px-3 py-2 text-right">{formatMxn(Number(item.precio_unitario))}</td>
                    <td className="px-3 py-2 text-right font-medium">{formatMxn(Number(item.total))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50">
                  <td colSpan={3} className="px-3 py-2 text-right font-semibold">Total</td>
                  <td className="px-3 py-2 text-right font-bold">{t.total != null ? formatMxn(t.total) : '—'}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    )
  }

  // ── REVIEW (after AI analysis) ────────────────────────────────────────────
  if (view === 'review') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title="Revisar análisis del ticket" onBack={() => { setView('list'); setError('') }} />

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 mb-4 text-sm text-blue-800">
          La IA extrajo esta información del ticket. Revisa y corrige lo que sea necesario antes de guardar.
        </div>

        {/* Foto preview */}
        <div className="mb-4 rounded-xl overflow-hidden border border-gray-200 max-h-48">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={reviewFotoUrl} alt="Ticket" className="w-full max-h-48 object-contain bg-gray-50" />
        </div>

        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="Tienda">
              <Input value={reviewTienda} onChange={(e) => setReviewTienda(e.target.value)} placeholder="Nombre tienda" />
            </FormField>
            <FormField label="Fecha">
              <Input type="date" value={reviewFecha} onChange={(e) => setReviewFecha(e.target.value)} />
            </FormField>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <FormField label="Subtotal">
              <Input type="number" step="0.01" value={reviewSubtotal} onChange={(e) => setReviewSubtotal(e.target.value)} />
            </FormField>
            <FormField label="IVA">
              <Input type="number" step="0.01" value={reviewIva} onChange={(e) => setReviewIva(e.target.value)} />
            </FormField>
            <FormField label="Total">
              <Input type="number" step="0.01" value={reviewTotal} onChange={(e) => setReviewTotal(e.target.value)} />
            </FormField>
          </div>

          <FormField label="Método de pago">
            <Input value={reviewMetodoPago} onChange={(e) => setReviewMetodoPago(e.target.value)} placeholder="Efectivo, tarjeta..." />
          </FormField>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">Productos ({reviewItems.length})</label>
              <button onClick={addReviewItem} className="text-xs text-blue-600 hover:text-blue-700 font-medium">+ Agregar</button>
            </div>

            <div className="flex flex-col gap-2">
              {reviewItems.map((item, idx) => (
                <div key={idx} className="bg-gray-50 rounded-lg p-3">
                  <div className="flex items-start gap-2 mb-2">
                    <input
                      type="text"
                      value={item.descripcion}
                      onChange={(e) => updateReviewItem(idx, 'descripcion', e.target.value)}
                      placeholder="Descripción del producto"
                      className="flex-1 px-2 py-1.5 border border-gray-200 rounded-lg text-sm bg-white"
                    />
                    <button onClick={() => removeReviewItem(idx)} className="text-red-400 hover:text-red-600 text-lg">&times;</button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs text-gray-400">Cant</label>
                      <input type="number" step="0.01" value={item.cantidad}
                        onChange={(e) => updateReviewItem(idx, 'cantidad', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">P. Unit.</label>
                      <input type="number" step="0.01" value={item.precio_unitario}
                        onChange={(e) => updateReviewItem(idx, 'precio_unitario', e.target.value)}
                        className="w-full px-2 py-1 border border-gray-200 rounded-lg text-sm bg-white" />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400">Total</label>
                      <p className="px-2 py-1 text-sm font-medium text-gray-700">{formatMxn(item.total)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <FormField label="Notas">
            <Textarea value={reviewNotas} onChange={(e) => setReviewNotas(e.target.value)} placeholder="Observaciones o correcciones" />
          </FormField>

          <div className="flex gap-2">
            <Btn type="button" variant="secondary" onClick={() => { setView('list'); setError('') }} className="flex-1">Cancelar</Btn>
            <Btn onClick={handleSaveReview} loading={saving} className="flex-1">Guardar ticket</Btn>
          </div>
        </div>
      </div>
    )
  }

  // ── UPLOAD ────────────────────────────────────────────────────────────────
  if (view === 'upload') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5">
        <FormHeader title="Subir ticket" onBack={() => { setView('list'); setError('') }} />

        {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}

        <div className="flex flex-col items-center gap-4 py-10">
          <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center">
            <svg className="w-10 h-10 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5}>
              <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" strokeLinecap="round" strokeLinejoin="round" />
              <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <p className="text-sm text-gray-600 text-center">
            Sube una foto del ticket y la IA extraerá<br/>los productos, precios y totales automáticamente.
          </p>
          <label className="cursor-pointer">
            <div className={`px-6 py-3 rounded-xl text-sm font-medium transition-colors ${
              uploading ? 'bg-blue-100 text-blue-600' : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}>
              {uploading ? 'Analizando ticket...' : 'Seleccionar foto o PDF'}
            </div>
            <input
              type="file"
              accept=".jpg,.jpeg,.png,.webp,.pdf"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleUpload(f)
              }}
            />
          </label>
        </div>
      </div>
    )
  }

  // ── LIST ──────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5">
      <PageHeader
        title="Análisis de Tickets"
        subtitle={`${tickets.length} tickets`}
        action={{ label: 'Subir ticket', onClick: () => { setView('upload'); setError('') } }}
      />

      {tickets.length === 0 ? (
        <EmptyState
          message="No hay tickets analizados"
          action={{ label: 'Subir primer ticket', onClick: () => setView('upload') }}
        />
      ) : (
        <div className="flex flex-col gap-2">
          {tickets.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => openDetail(t)}
              className="nm-card p-4 text-left hover:bg-gray-50/50 transition-colors"
            >
              <div className="flex items-start gap-3">
                {/* Thumbnail */}
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-100 shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.foto_url} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm">{t.tienda_detectada ?? 'Tienda desconocida'}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[t.status]}`}>
                      {STATUS_LABELS[t.status]}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
                    {t.fecha_ticket && <span>{t.fecha_ticket}</span>}
                    {t.total != null && <span className="font-medium text-gray-700">{formatMxn(t.total)}</span>}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDate(t.created_at.split('T')[0])}
                  </p>
                </div>
                <svg className="w-4 h-4 text-gray-400 mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { setView('upload'); setError('') }}
        className="fixed bottom-20 right-4 md:hidden w-14 h-14 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-lg flex items-center justify-center z-20"
      >
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" strokeLinecap="round" strokeLinejoin="round" />
          <rect x="3" y="3" width="18" height="18" rx="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
    </div>
  )
}
