'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { supabase } from '@/lib/supabase/client'
import { formatMxn, formatDate, todayISO, generateNumeroOrdenVenta } from '@/lib/format'
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField'
import { Btn } from '@/components/ui/Btn'
import { PageHeader } from '@/components/ui/PageHeader'
import { EmptyState } from '@/components/ui/EmptyState'
import { Spinner } from '@/components/ui/Spinner'
import { FormHeader } from '@/components/ui/FormHeader'
import { useToast } from '@/components/ui/Toast'
import { SearchSelect } from '@/components/ui/SearchSelect'
import { generateNumeroVenta, generateNumeroFactura } from '@/lib/format'
import type { OrdenVenta, OrdenVentaStatus, UnidadMedida } from '@/lib/types/database.types'

// Partial types for Supabase select queries — avoids assigning partial rows to full Row types
interface ClienteBasic {
  id: string
  nombre: string
  descuento_pct: number | null
  limite_credito: number
  dias_credito: number | null
}

interface ProductoBasic {
  id: string
  nombre_producto: string
  unidad_medida: UnidadMedida
  cantidad: number | null
  precio_venta_publico: number | null
  ean: string | null
  sku: string | null
}

// Item local mientras se construye el formulario
interface ItemLocal {
  inventario_registro_id: string
  descripcion: string
  unidad: UnidadMedida
  disponible: number
  precio_sugerido: number
  cantidad: string
  precio_unitario: string
  descuento_pct: string
  con_iva: boolean
}

const emptyForm = () => ({
  numero: generateNumeroOrdenVenta(),
  cliente_id: '',
  fecha: todayISO(),
  fecha_entrega: '',
  notas: '',
})

const STATUS_COLORS: Record<OrdenVentaStatus, string> = {
  borrador:   'bg-gray-100 text-gray-600',
  confirmado: 'bg-blue-50 text-blue-700',
  surtido:    'bg-green-50 text-green-700',
  cancelado:  'bg-red-50 text-red-700',
}

const STATUS_LABELS: Record<OrdenVentaStatus, string> = {
  borrador:   'Borrador',
  confirmado: 'Confirmado',
  surtido:    'Surtido',
  cancelado:  'Cancelado',
}

export default function PedidosPage() {
  const [ordenes, setOrdenes] = useState<OrdenVenta[]>([])
  const [clientes, setClientes] = useState<ClienteBasic[]>([])
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'list' | 'form'>('list')
  const [editId, setEditId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm())
  const [items, setItems] = useState<ItemLocal[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Product search
  const [busquedaProducto, setBusquedaProducto] = useState('')
  const [productosResultados, setProductosResultados] = useState<ProductoBasic[]>([])
  const [buscandoProducto, setBuscandoProducto] = useState(false)

  // Filters
  const [busqueda, setBusqueda] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')

  const { toast } = useToast()

  const loadData = useCallback(async () => {
    setLoading(true)
    const [{ data: ordenesData }, { data: clientesData }] = await Promise.all([
      supabase
        .from('ordenes_venta')
        .select('*, clientes(nombre)')
        .order('created_at', { ascending: false })
        .limit(300),
      supabase
        .from('clientes')
        .select('id, nombre, descuento_pct, limite_credito, dias_credito')
        .eq('activo', true)
        .order('nombre'),
    ])
    setOrdenes(ordenesData ?? [])
    setClientes(clientesData ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { loadData() }, [loadData])

  // Debounced product search
  useEffect(() => {
    if (!busquedaProducto.trim()) { setProductosResultados([]); return }
    const t = setTimeout(async () => {
      setBuscandoProducto(true)
      const { data } = await supabase
        .from('inventario_registros')
        .select('id, nombre_producto, unidad_medida, cantidad, precio_venta_publico, ean, sku')
        .or(`nombre_producto.ilike.%${busquedaProducto}%,ean.ilike.%${busquedaProducto}%,sku.ilike.%${busquedaProducto}%`)
        .order('nombre_producto')
        .limit(10)
      setProductosResultados(data ?? [])
      setBuscandoProducto(false)
    }, 400)
    return () => clearTimeout(t)
  }, [busquedaProducto])

  const agregarProducto = (prod: ProductoBasic) => {
    const clienteActual = clientes.find(c => c.id === form.cliente_id)
    const descuento = clienteActual?.descuento_pct ?? 0
    const precioBase = prod.precio_venta_publico ?? 0
    const precioConDesc = descuento > 0 ? precioBase * (1 - descuento / 100) : precioBase
    setItems(prev => [
      ...prev,
      {
        inventario_registro_id: prod.id,
        descripcion: prod.nombre_producto,
        unidad: prod.unidad_medida,
        disponible: prod.cantidad ?? 0,
        precio_sugerido: precioBase,
        cantidad: '1',
        precio_unitario: precioConDesc > 0 ? precioConDesc.toFixed(2) : '0',
        descuento_pct: descuento > 0 ? String(descuento) : '0',
        con_iva: true,
      },
    ])
    setBusquedaProducto('')
    setProductosResultados([])
  }

  const calcTotales = useMemo(() => {
    const subtotal = items.reduce((s, i) => {
      const base = (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0)
      const desc = (parseFloat(i.descuento_pct) || 0) / 100
      return s + base * (1 - desc)
    }, 0)
    const iva = items
      .filter(i => i.con_iva)
      .reduce((s, i) => {
        const base = (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0)
        const desc = (parseFloat(i.descuento_pct) || 0) / 100
        return s + base * (1 - desc) * 0.16
      }, 0)
    return { subtotal, iva, total: subtotal + iva }
  }, [items])

  const resetForm = () => {
    setForm(emptyForm())
    setItems([])
    setError('')
    setEditId(null)
    setBusquedaProducto('')
    setProductosResultados([])
  }

  const openEdit = async (o: OrdenVenta) => {
    const { data: itemsData } = await supabase
      .from('ordenes_venta_items')
      .select('*, inventario_registros(nombre_producto, unidad_medida, cantidad, precio_venta_publico)')
      .eq('orden_venta_id', o.id)
      .order('created_at')
    setEditId(o.id)
    setForm({
      numero: o.numero,
      cliente_id: o.cliente_id ?? '',
      fecha: o.fecha,
      fecha_entrega: o.fecha_entrega ?? '',
      notas: o.notas ?? '',
    })
    setItems((itemsData ?? []).map(i => ({
      inventario_registro_id: i.inventario_registro_id ?? '',
      descripcion: i.descripcion,
      unidad: (i.inventario_registros?.unidad_medida ?? 'unidad') as UnidadMedida,
      disponible: i.inventario_registros?.cantidad ?? 0,
      precio_sugerido: i.inventario_registros?.precio_venta_publico ?? 0,
      cantidad: String(i.cantidad),
      precio_unitario: String(i.precio_unitario),
      descuento_pct: String(i.descuento_pct),
      con_iva: true,
    })))
    setView('form')
  }

  const handleSave = async (status: OrdenVentaStatus = 'borrador') => {
    if (!form.fecha) { setError('La fecha es requerida'); return }
    if (items.length === 0) { setError('Agrega al menos un producto'); return }
    setSaving(true); setError('')
    try {
      const payload = {
        numero: form.numero,
        cliente_id: form.cliente_id || null,
        fecha: form.fecha,
        fecha_entrega: form.fecha_entrega || null,
        status,
        subtotal: calcTotales.subtotal,
        iva: calcTotales.iva,
        total: calcTotales.total,
        notas: form.notas || null,
        updated_at: new Date().toISOString(),
      }

      let ordenId = editId
      if (editId) {
        await supabase.from('ordenes_venta').update(payload).eq('id', editId)
        await supabase.from('ordenes_venta_items').delete().eq('orden_venta_id', editId)
      } else {
        const { data, error: e } = await supabase.from('ordenes_venta').insert(payload).select().single()
        if (e) throw e
        ordenId = data.id
      }

      const itemsPayload = items.map(i => {
        const base = (parseFloat(i.cantidad) || 0) * (parseFloat(i.precio_unitario) || 0)
        const desc = (parseFloat(i.descuento_pct) || 0) / 100
        return {
          orden_venta_id: ordenId!,
          inventario_registro_id: i.inventario_registro_id || null,
          descripcion: i.descripcion,
          cantidad: parseFloat(i.cantidad) || 0,
          precio_unitario: parseFloat(i.precio_unitario) || 0,
          descuento_pct: parseFloat(i.descuento_pct) || 0,
          subtotal: base * (1 - desc),
        }
      })
      await supabase.from('ordenes_venta_items').insert(itemsPayload)

      toast({ message: editId ? 'Pedido actualizado' : 'Pedido guardado' })
      resetForm(); setView('list'); loadData()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  // Convierte un pedido confirmado en una venta + genera remisión
  const convertirAVenta = async (o: OrdenVenta) => {
    if (!confirm(`¿Convertir pedido ${o.numero} a venta? Se creará un registro de venta y el pedido quedará como surtido.`)) return
    try {
      const { data: itemsData } = await supabase
        .from('ordenes_venta_items')
        .select('*')
        .eq('orden_venta_id', o.id)

      const ventaPayload = {
        numero_venta: generateNumeroVenta(),
        fecha: todayISO(),
        cliente_id: o.cliente_id,
        forma_pago: 'efectivo' as const,
        monto_total: o.total,
        monto_pagado: 0,
        monto_efectivo: 0,
        monto_bonos: 0,
        monto_otro: 0,
        status_pago: 'pendiente' as const,
        notas: `Generado desde pedido ${o.numero}`,
        fotos: [],
        updated_at: new Date().toISOString(),
      }
      const { data: venta, error: eVenta } = await supabase.from('ventas').insert(ventaPayload).select().single()
      if (eVenta) throw eVenta

      // Remisión automática para crédito
      const remisionPayload = {
        numero_factura: generateNumeroFactura(),
        fecha: todayISO(),
        tipo: 'ingreso' as const,
        cliente_id: o.cliente_id,
        subtotal: o.subtotal,
        iva: o.iva,
        total: o.total,
        status: 'emitida' as const,
        venta_id: venta.id,
        notas: `Remisión — pedido ${o.numero}`,
        updated_at: new Date().toISOString(),
      }
      await supabase.from('facturas').insert(remisionPayload)

      if (itemsData?.length) {
        await supabase.from('ventas_items').insert(
          itemsData.map(i => ({
            venta_id: venta.id,
            inventario_registro_id: i.inventario_registro_id,
            cantidad: i.cantidad,
            precio_unitario: i.precio_unitario,
            total: i.subtotal,
          }))
        )
      }

      await supabase.from('ordenes_venta').update({ status: 'surtido', updated_at: new Date().toISOString() }).eq('id', o.id)
      toast({ message: `Venta ${venta.numero_venta} creada desde pedido ${o.numero}` })
      loadData()
    } catch (e: unknown) {
      toast({ message: e instanceof Error ? e.message : 'Error al convertir', type: 'error' })
    }
  }

  const cambiarStatus = async (o: OrdenVenta, nuevoStatus: OrdenVentaStatus) => {
    await supabase.from('ordenes_venta').update({ status: nuevoStatus, updated_at: new Date().toISOString() }).eq('id', o.id)
    toast({ message: `Pedido ${STATUS_LABELS[nuevoStatus].toLowerCase()}` })
    loadData()
  }

  const filtered = useMemo(() =>
    ordenes.filter(o => {
      if (filtroStatus && o.status !== filtroStatus) return false
      if (!busqueda) return true
      const q = busqueda.toLowerCase()
      return o.numero.toLowerCase().includes(q) ||
        (o.clientes?.nombre ?? '').toLowerCase().includes(q)
    }), [ordenes, busqueda, filtroStatus])

  // ── FORM VIEW ──────────────────────────────────────────────────────────────
  if (view === 'form') {
    const { subtotal, iva, total } = calcTotales
    return (
      <div className="max-w-2xl mx-auto p-4 pb-28">
        <FormHeader
          title={editId ? 'Editar pedido' : 'Nuevo pedido'}
          onBack={() => { resetForm(); setView('list') }}
        />

        {error && <p className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</p>}

        {/* Encabezado */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <FormField label="No. Pedido">
              <Input value={form.numero} onChange={e => setForm(f => ({ ...f, numero: e.target.value }))} />
            </FormField>
            <FormField label="Fecha" required>
              <Input type="date" value={form.fecha} onChange={e => setForm(f => ({ ...f, fecha: e.target.value }))} />
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="Cliente">
              <SearchSelect
                value={form.cliente_id}
                onChange={v => setForm(f => ({ ...f, cliente_id: v }))}
                options={clientes.map(c => ({ id: c.id, label: c.nombre }))}
                placeholder="Seleccionar cliente..."
              />
            </FormField>
          </div>
          <div className="mt-3">
            <FormField label="Fecha entrega estimada">
              <Input type="date" value={form.fecha_entrega} onChange={e => setForm(f => ({ ...f, fecha_entrega: e.target.value }))} />
            </FormField>
          </div>
        </div>

        {/* Productos */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-4">
          <h3 className="font-semibold text-gray-700 mb-3">Productos</h3>
          <FormField label="Buscar producto">
            <Input
              value={busquedaProducto}
              onChange={e => setBusquedaProducto(e.target.value)}
              placeholder="Nombre, EAN o SKU..."
            />
          </FormField>
          {buscandoProducto && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
          {productosResultados.length > 0 && (
            <div className="mt-2 border border-gray-200 rounded-xl overflow-hidden">
              {productosResultados.map(p => (
                <button
                  key={p.id}
                  onClick={() => agregarProducto(p)}
                  className="w-full text-left px-3 py-2 hover:bg-blue-50 flex items-center justify-between text-sm border-b border-gray-100 last:border-0"
                >
                  <span className="font-medium text-gray-800">{p.nombre_producto}</span>
                  <span className="text-gray-400 text-xs">{p.cantidad} {p.unidad_medida}</span>
                </button>
              ))}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-4 space-y-3">
              {items.map((item, i) => {
                const base = (parseFloat(item.cantidad) || 0) * (parseFloat(item.precio_unitario) || 0)
                const desc = (parseFloat(item.descuento_pct) || 0) / 100
                const subtotalItem = base * (1 - desc)
                return (
                  <div key={i} className="border border-gray-100 rounded-xl p-3 bg-gray-50">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-800 flex-1">{item.descripcion}</p>
                      <button onClick={() => setItems(prev => prev.filter((_, j) => j !== i))} className="text-red-400 hover:text-red-600 text-lg leading-none shrink-0">×</button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <FormField label="Cantidad">
                        <Input type="number" value={item.cantidad} min="0.001" step="any"
                          onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, cantidad: e.target.value } : x))} />
                      </FormField>
                      <FormField label="Precio">
                        <Input type="number" value={item.precio_unitario} min="0" step="0.01"
                          onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, precio_unitario: e.target.value } : x))} />
                      </FormField>
                      <FormField label="Dto %">
                        <Input type="number" value={item.descuento_pct} min="0" max="100" step="0.1"
                          onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, descuento_pct: e.target.value } : x))} />
                      </FormField>
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <label className="flex items-center gap-2 text-xs text-gray-500 cursor-pointer">
                        <input type="checkbox" checked={item.con_iva}
                          onChange={e => setItems(prev => prev.map((x, j) => j === i ? { ...x, con_iva: e.target.checked } : x))}
                          className="rounded" />
                        IVA 16%
                      </label>
                      <p className="text-sm font-semibold text-gray-800">{formatMxn(subtotalItem)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {items.length > 0 && (
            <div className="mt-4 pt-3 border-t border-gray-200 space-y-1 text-sm">
              <div className="flex justify-between text-gray-600"><span>Subtotal</span><span>{formatMxn(subtotal)}</span></div>
              <div className="flex justify-between text-gray-600"><span>IVA 16%</span><span>{formatMxn(iva)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 text-base pt-1 border-t border-gray-200 mt-1">
                <span>Total</span><span>{formatMxn(total)}</span>
              </div>
            </div>
          )}
        </div>

        {/* Notas */}
        <div className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4 mb-6">
          <FormField label="Notas">
            <Textarea value={form.notas} onChange={e => setForm(f => ({ ...f, notas: e.target.value }))} placeholder="Observaciones o instrucciones de entrega" rows={2} />
          </FormField>
        </div>

        <div className="flex gap-3">
          <Btn variant="secondary" onClick={() => handleSave('borrador')} loading={saving} className="flex-1">
            Guardar borrador
          </Btn>
          <Btn onClick={() => handleSave('confirmado')} loading={saving} className="flex-1">
            Confirmar pedido
          </Btn>
        </div>
      </div>
    )
  }

  // ── LIST VIEW ──────────────────────────────────────────────────────────────
  return (
    <div className="p-4 pb-24">
      <PageHeader
        title="Pedidos"
        action={{ label: 'Nuevo pedido', onClick: () => { resetForm(); setView('form') } }}
      />

      {/* Filtros */}
      <div className="flex gap-2 mb-4 flex-wrap">
        <Input
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          placeholder="Buscar por número o cliente..."
          className="flex-1 min-w-48"
        />
        <Select value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} className="w-36">
          <option value="">Todos</option>
          <option value="borrador">Borrador</option>
          <option value="confirmado">Confirmado</option>
          <option value="surtido">Surtido</option>
          <option value="cancelado">Cancelado</option>
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Spinner /></div>
      ) : filtered.length === 0 ? (
        <EmptyState message={busqueda || filtroStatus ? 'Sin resultados' : 'Sin pedidos. Crea uno con el botón de arriba.'} />
      ) : (
        <div className="space-y-3">
          {filtered.map(o => (
            <div key={o.id} className="bg-white rounded-2xl shadow-[0_2px_12px_rgba(0,0,0,0.06)] p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="font-semibold text-gray-900 text-sm">{o.numero}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status]}`}>
                      {STATUS_LABELS[o.status]}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{o.clientes?.nombre ?? 'Sin cliente'}</p>
                  <div className="flex gap-3 mt-0.5 text-xs text-gray-400">
                    <span>{formatDate(o.fecha)}</span>
                    {o.fecha_entrega && <span>Entrega: {formatDate(o.fecha_entrega)}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">{formatMxn(o.total)}</p>
                </div>
              </div>

              <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100 flex-wrap">
                {o.status !== 'surtido' && o.status !== 'cancelado' && (
                  <Btn size="sm" variant="ghost" onClick={() => openEdit(o)}>Editar</Btn>
                )}
                {o.status === 'borrador' && (
                  <Btn size="sm" variant="ghost" onClick={() => cambiarStatus(o, 'confirmado')}
                    className="text-blue-600 hover:bg-blue-50">
                    Confirmar
                  </Btn>
                )}
                {o.status === 'confirmado' && (
                  <Btn size="sm" variant="ghost" onClick={() => convertirAVenta(o)}
                    className="text-green-700 hover:bg-green-50">
                    Convertir a venta
                  </Btn>
                )}
                {(o.status === 'borrador' || o.status === 'confirmado') && (
                  <Btn size="sm" variant="ghost" onClick={() => cambiarStatus(o, 'cancelado')}
                    className="text-red-500 hover:bg-red-50">
                    Cancelar
                  </Btn>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* FAB */}
      <button
        onClick={() => { resetForm(); setView('form') }}
        className="fixed bottom-20 right-4 md:bottom-6 w-14 h-14 bg-blue-600 text-white rounded-full shadow-lg flex items-center justify-center text-2xl hover:bg-blue-700 active:scale-95 transition-all z-40"
      >
        +
      </button>
    </div>
  )
}
