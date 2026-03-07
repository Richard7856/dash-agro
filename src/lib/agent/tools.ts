import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

// ─── Tool definitions (para Claude) ─────────────────────────────────────────

export const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'get_resumen_hoy',
    description: 'Obtiene el resumen de ventas, compras y gastos del día de hoy.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_ventas',
    description: 'Consulta el historial de ventas.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_compras',
    description: 'Consulta el historial de compras.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_gastos',
    description: 'Consulta el historial de gastos.',
    input_schema: {
      type: 'object',
      properties: {
        desde: { type: 'string', description: 'Fecha inicio YYYY-MM-DD' },
        hasta: { type: 'string', description: 'Fecha fin YYYY-MM-DD' },
        limit: { type: 'number', description: 'Máximo de resultados (default 10)' },
      },
      required: [],
    },
  },
  {
    name: 'get_inventario',
    description: 'Consulta el inventario actual con productos en existencia.',
    input_schema: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Término de búsqueda por nombre o EAN' },
      },
      required: [],
    },
  },
  {
    name: 'get_clientes',
    description: 'Lista los clientes activos. Usar antes de registrar una venta para obtener el cliente_id.',
    input_schema: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Filtrar por nombre o RFC' },
      },
      required: [],
    },
  },
  {
    name: 'get_proveedores',
    description: 'Lista los proveedores activos. Usar antes de registrar una compra para obtener el proveedor_id.',
    input_schema: {
      type: 'object',
      properties: {
        buscar: { type: 'string', description: 'Filtrar por nombre o RFC' },
      },
      required: [],
    },
  },
  {
    name: 'get_ubicaciones',
    description: 'Lista las ubicaciones/bodegas disponibles para asignar a un registro.',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'registrar_venta',
    description: 'Registra una nueva venta. SOLO llamar después de confirmar todos los datos con el usuario.',
    input_schema: {
      type: 'object',
      properties: {
        monto_total: { type: 'number', description: 'Monto total de la venta en MXN' },
        descripcion_productos: { type: 'string', description: 'Descripción de qué se vendió, cantidades y precios unitarios' },
        cliente_id: { type: 'string', description: 'UUID del cliente (de get_clientes)' },
        forma_pago: { type: 'string', enum: ['efectivo', 'bonos_gasolina', 'mixto', 'otro'], description: 'Forma de pago' },
        fecha: { type: 'string', description: 'Fecha de venta YYYY-MM-DD (default hoy)' },
        fecha_entrega: { type: 'string', description: 'Fecha de entrega acordada YYYY-MM-DD' },
        gastos_extras: { type: 'number', description: 'Gastos extra (flete, maniobras, etc.) en MXN' },
        notas: { type: 'string', description: 'Observaciones adicionales' },
      },
      required: ['monto_total', 'descripcion_productos', 'forma_pago'],
    },
  },
  {
    name: 'registrar_compra',
    description: 'Registra una nueva compra. SOLO llamar después de confirmar todos los datos con el usuario.',
    input_schema: {
      type: 'object',
      properties: {
        monto_total: { type: 'number', description: 'Monto total de la compra en MXN' },
        descripcion: { type: 'string', description: 'Qué se compró, cantidades y especificaciones' },
        proveedor_id: { type: 'string', description: 'UUID del proveedor (de get_proveedores)' },
        forma_pago: { type: 'string', enum: ['efectivo', 'bonos_gasolina', 'mixto', 'otro'], description: 'Forma de pago' },
        fecha: { type: 'string', description: 'Fecha de compra YYYY-MM-DD (default hoy)' },
        gastos: { type: 'number', description: 'Gastos adicionales (flete, etc.) en MXN' },
        notas: { type: 'string', description: 'Observaciones adicionales' },
      },
      required: ['monto_total', 'descripcion', 'forma_pago'],
    },
  },
  {
    name: 'registrar_inventario',
    description: 'Agrega un producto al inventario. SOLO llamar después de confirmar todos los datos con el usuario.',
    input_schema: {
      type: 'object',
      properties: {
        nombre_producto: { type: 'string', description: 'Nombre del producto' },
        cantidad: { type: 'number', description: 'Cantidad' },
        precio_compra_unitario: { type: 'number', description: 'Precio de compra por unidad en MXN' },
        unidad_medida: { type: 'string', enum: ['unidad', 'kg', 'lt', 'caja', 'tarima', 'pieza', 'litro', 'gramo'], description: 'Unidad de medida' },
        ean: { type: 'string', description: 'Código de barras EAN' },
        numero_lote: { type: 'string', description: 'Número de lote del proveedor' },
        fecha_caducidad: { type: 'string', description: 'Fecha de caducidad YYYY-MM-DD' },
        cantidad_por_caja: { type: 'number', description: 'Unidades por caja' },
        ubicacion_id: { type: 'string', description: 'UUID de la ubicación/bodega (de get_ubicaciones)' },
      },
      required: ['nombre_producto', 'cantidad', 'precio_compra_unitario', 'unidad_medida'],
    },
  },
  {
    name: 'registrar_gasto',
    description: 'Registra un gasto operativo. SOLO llamar después de confirmar todos los datos con el usuario.',
    input_schema: {
      type: 'object',
      properties: {
        monto: { type: 'number', description: 'Monto del gasto en MXN' },
        concepto: { type: 'string', description: 'Descripción del gasto' },
        categoria: { type: 'string', description: 'Categoría (combustible, mantenimiento, salarios, etc.)' },
        fecha: { type: 'string', description: 'Fecha YYYY-MM-DD (default hoy)' },
      },
      required: ['monto', 'concepto'],
    },
  },
]

// ─── Tool handlers ───────────────────────────────────────────────────────────

function todayStr() {
  return new Date().toISOString().split('T')[0]
}

function fmt(n: number) {
  return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(n)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function executeTool(name: string, input: Record<string, any>): Promise<string> {
  try {
    switch (name) {
      case 'get_resumen_hoy': {
        const hoy = todayStr()
        const [{ data: ventas }, { data: compras }, { data: gastos }] = await Promise.all([
          supabaseAdmin.from('ventas').select('monto_total').eq('fecha', hoy),
          supabaseAdmin.from('compras').select('monto_total').eq('fecha', hoy),
          supabaseAdmin.from('gastos').select('monto').eq('fecha', hoy),
        ])
        const totalVentas = (ventas ?? []).reduce((s, v) => s + v.monto_total, 0)
        const totalCompras = (compras ?? []).reduce((s, c) => s + c.monto_total, 0)
        const totalGastos = (gastos ?? []).reduce((s, g) => s + g.monto, 0)
        return `Resumen de hoy (${hoy}):\n- Ventas: ${(ventas ?? []).length} registros, total ${fmt(totalVentas)}\n- Compras: ${(compras ?? []).length} registros, total ${fmt(totalCompras)}\n- Gastos: ${(gastos ?? []).length} registros, total ${fmt(totalGastos)}\n- Balance del día: ${fmt(totalVentas - totalCompras - totalGastos)}`
      }

      case 'get_ventas': {
        let q = supabaseAdmin.from('ventas').select('fecha, numero_venta, monto_total, forma_pago, notas, clientes(nombre)').order('fecha', { ascending: false })
        if (input.desde) q = q.gte('fecha', input.desde)
        if (input.hasta) q = q.lte('fecha', input.hasta)
        q = q.limit(input.limit ?? 10)
        const { data } = await q
        if (!data?.length) return 'No hay ventas en ese período.'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((v: any) => `• ${v.fecha} | ${fmt(v.monto_total)} | ${v.forma_pago}${v.clientes?.nombre ? ` | ${v.clientes.nombre}` : ''}${v.notas ? ` | ${v.notas}` : ''}`).join('\n')
      }

      case 'get_compras': {
        let q = supabaseAdmin.from('compras').select('fecha, numero_compra, monto_total, forma_pago, descripcion, proveedores(nombre)').order('fecha', { ascending: false })
        if (input.desde) q = q.gte('fecha', input.desde)
        if (input.hasta) q = q.lte('fecha', input.hasta)
        q = q.limit(input.limit ?? 10)
        const { data } = await q
        if (!data?.length) return 'No hay compras en ese período.'
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return data.map((c: any) => `• ${c.fecha} | ${fmt(c.monto_total)} | ${c.forma_pago}${c.proveedores?.nombre ? ` | ${c.proveedores.nombre}` : ''}${c.descripcion ? ` | ${c.descripcion}` : ''}`).join('\n')
      }

      case 'get_gastos': {
        let q = supabaseAdmin.from('gastos').select('fecha, concepto, monto, categoria').order('fecha', { ascending: false })
        if (input.desde) q = q.gte('fecha', input.desde)
        if (input.hasta) q = q.lte('fecha', input.hasta)
        q = q.limit(input.limit ?? 10)
        const { data } = await q
        if (!data?.length) return 'No hay gastos en ese período.'
        return data.map((g) => `• ${g.fecha} | ${fmt(g.monto)} | ${g.concepto}${g.categoria ? ` (${g.categoria})` : ''}`).join('\n')
      }

      case 'get_inventario': {
        let q = supabaseAdmin.from('inventario_registros').select('nombre_producto, cantidad, unidad_medida, precio_compra_unitario, ean, fecha_caducidad').gt('cantidad', 0).order('cantidad', { ascending: false })
        if (input.buscar) q = q.ilike('nombre_producto', `%${input.buscar}%`)
        const { data } = await q
        if (!data?.length) return 'No hay productos en inventario con existencia.'
        return data.map((i) => `• ${i.nombre_producto} — ${i.cantidad} ${i.unidad_medida} a ${fmt(i.precio_compra_unitario)}/u${i.fecha_caducidad ? ` (cad: ${i.fecha_caducidad})` : ''}`).join('\n')
      }

      case 'get_clientes': {
        let q = supabaseAdmin.from('clientes').select('id, nombre, rfc').eq('activo', true).order('nombre')
        if (input.buscar) q = q.ilike('nombre', `%${input.buscar}%`)
        const { data } = await q
        if (!data?.length) return 'No hay clientes activos.'
        return data.map((c) => `• ${c.nombre}${c.rfc ? ` (RFC: ${c.rfc})` : ''} — ID: ${c.id}`).join('\n')
      }

      case 'get_proveedores': {
        let q = supabaseAdmin.from('proveedores').select('id, nombre, rfc').eq('activo', true).order('nombre')
        if (input.buscar) q = q.ilike('nombre', `%${input.buscar}%`)
        const { data } = await q
        if (!data?.length) return 'No hay proveedores activos.'
        return data.map((p) => `• ${p.nombre}${p.rfc ? ` (RFC: ${p.rfc})` : ''} — ID: ${p.id}`).join('\n')
      }

      case 'get_ubicaciones': {
        const { data } = await supabaseAdmin.from('ubicaciones').select('id, nombre').eq('activo', true).order('nombre')
        if (!data?.length) return 'No hay ubicaciones registradas.'
        return data.map((u) => `• ${u.nombre} — ID: ${u.id}`).join('\n')
      }

      case 'registrar_venta': {
        const payload = {
          monto_total: input.monto_total,
          forma_pago: input.forma_pago ?? 'efectivo',
          fecha: input.fecha ?? todayStr(),
          fecha_entrega: input.fecha_entrega ?? null,
          cliente_id: input.cliente_id ?? null,
          gastos_extras: input.gastos_extras ?? 0,
          notas: [input.descripcion_productos, input.notas].filter(Boolean).join(' | ') || null,
        }
        const { data, error } = await supabaseAdmin.from('ventas').insert(payload).select('id, numero_venta').single()
        if (error) return `Error al registrar venta: ${error.message}`
        return `✅ Venta registrada correctamente. Folio: ${data.numero_venta ?? data.id}. Monto: ${fmt(input.monto_total)}.`
      }

      case 'registrar_compra': {
        const payload = {
          monto_total: input.monto_total,
          descripcion: input.descripcion,
          forma_pago: input.forma_pago ?? 'efectivo',
          fecha: input.fecha ?? todayStr(),
          proveedor_id: input.proveedor_id ?? null,
          gastos: input.gastos ?? 0,
          notas: input.notas ?? null,
        }
        const { data, error } = await supabaseAdmin.from('compras').insert(payload).select('id, numero_compra').single()
        if (error) return `Error al registrar compra: ${error.message}`
        return `✅ Compra registrada correctamente. Folio: ${data.numero_compra ?? data.id}. Monto: ${fmt(input.monto_total)}.`
      }

      case 'registrar_inventario': {
        const payload = {
          nombre_producto: input.nombre_producto,
          cantidad: input.cantidad,
          precio_compra_unitario: input.precio_compra_unitario,
          precio_compra_total: input.cantidad * input.precio_compra_unitario,
          unidad_medida: input.unidad_medida,
          ean: input.ean ?? null,
          numero_lote: input.numero_lote ?? null,
          fecha_caducidad: input.fecha_caducidad ?? null,
          cantidad_por_caja: input.cantidad_por_caja ?? null,
          ubicacion_id: input.ubicacion_id ?? null,
        }
        const { error } = await supabaseAdmin.from('inventario_registros').insert(payload)
        if (error) return `Error al registrar inventario: ${error.message}`
        return `✅ Inventario registrado: ${input.cantidad} ${input.unidad_medida} de "${input.nombre_producto}" a ${fmt(input.precio_compra_unitario)} c/u. Total: ${fmt(payload.precio_compra_total)}.`
      }

      case 'registrar_gasto': {
        const payload = {
          monto: input.monto,
          concepto: input.concepto,
          categoria: input.categoria ?? null,
          fecha: input.fecha ?? todayStr(),
        }
        const { error } = await supabaseAdmin.from('gastos').insert(payload)
        if (error) return `Error al registrar gasto: ${error.message}`
        return `✅ Gasto registrado: ${fmt(input.monto)} por "${input.concepto}"${input.categoria ? ` (${input.categoria})` : ''}.`
      }

      default:
        return `Tool desconocida: ${name}`
    }
  } catch (e) {
    return `Error ejecutando ${name}: ${e instanceof Error ? e.message : String(e)}`
  }
}
