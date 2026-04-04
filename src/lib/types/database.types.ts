export type FormaPago = 'efectivo' | 'bonos_gasolina' | 'transferencia' | 'tarjeta_credito' | 'tarjeta_debito' | 'mixto' | 'otro' | 'credito'
export type StatusPago = 'pendiente' | 'parcial' | 'pagado'
export type FacturaStatus = 'borrador' | 'emitida' | 'pagada' | 'cancelada'
export type FacturaTipo = 'ingreso' | 'egreso' | 'nota_credito' | 'devolucion'
export type UnidadMedida = 'unidad' | 'kg' | 'lt' | 'caja' | 'tarima' | 'pieza' | 'litro' | 'gramo'

// ─── Row types (sin joins — para el generic de Supabase) ────────────────────

interface PersonaRow {
  id: string
  nombre: string
  rol: string | null
  email: string | null
  telefono: string | null
  activo: boolean
  created_at: string
  updated_at: string
  descripcion_puesto: string | null
  impacto_operativo: string | null
  estructura: string | null
}

interface UbicacionRow {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  created_at: string
}

interface ClienteRow {
  id: string
  nombre: string
  rfc: string | null
  regimen_fiscal: string | null
  codigo_postal: string | null
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
  dias_credito: number
  limite_credito: number
  descuento_pct: number
  created_at: string
  updated_at: string
}

interface ProveedorRow {
  id: string
  nombre: string
  rfc: string | null
  regimen_fiscal: string | null
  codigo_postal: string | null
  email: string | null
  telefono: string | null
  notas: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

interface CompraRow {
  id: string
  numero_compra: string | null
  fecha: string
  ubicacion_id: string | null
  persona_id: string | null
  proveedor_id: string | null
  forma_pago: FormaPago
  monto_total: number
  monto_pagado: number
  descripcion: string | null
  gastos: number | null
  notas: string | null
  status_pago: StatusPago
  fecha_vencimiento: string | null
  monto_efectivo: number
  monto_bonos: number
  monto_otro: number
  fotos: string[]
  costo_flete: number
  costo_otros: number
  created_at: string
  updated_at: string
}

interface VentaRow {
  id: string
  numero_venta: string | null
  fecha: string
  ubicacion_id: string | null
  persona_id: string | null
  cliente_id: string | null
  vendedor_id: string | null
  forma_pago: FormaPago
  monto_total: number
  monto_pagado: number
  compra_origen_id: string | null
  fecha_entrega: string | null
  gastos_extras: number | null
  notas: string | null
  status_pago: StatusPago
  fecha_vencimiento: string | null
  monto_efectivo: number
  monto_bonos: number
  monto_otro: number
  fotos: string[]
  created_at: string
  updated_at: string
}

interface ApiKeyRow {
  id: string
  nombre: string
  key_hash: string
  key_prefix: string
  activo: boolean
  created_at: string
  last_used_at: string | null
}

interface SocioComercialRow {
  id: string
  tipo: 'cliente' | 'proveedor'
  rfc: string | null
  razon_social: string
  regimen_fiscal: string | null
  codigo_postal: string | null
  activo: boolean
  created_at: string
  updated_at: string
}

interface GastoRow {
  id: string
  fecha: string
  concepto: string
  monto: number
  categoria: string | null
  persona_id: string | null
  chofer: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

interface ConversionBonosRow {
  id: string
  fecha: string
  monto_bonos: number
  monto_efectivo: number
  persona_id: string | null
  notas: string | null
  created_at: string
}

interface InventarioRegistroRow {
  id: string
  ean: string | null
  sku: string | null
  nombre_producto: string
  cantidad: number
  stock_minimo: number
  precio_compra_unitario: number
  precio_compra_total: number
  precio_venta_publico: number
  precio_distribuidor: number
  precio_minimo: number
  numero_lote: string | null
  fecha_caducidad: string | null
  cantidad_por_caja: number | null
  cajas_por_tarima: number | null
  unidad_medida: UnidadMedida
  ubicacion_id: string | null
  es_interno: boolean
  fotos: string[]
  created_at: string
  updated_at: string
}

// ─── Tipos de UI (con joins opcionales) ────────────────────────────────────

export type Persona = PersonaRow
export type Ubicacion = UbicacionRow
export type Cliente = ClienteRow
export type Proveedor = ProveedorRow

export interface Compra extends CompraRow {
  proveedores?: { nombre: string } | null
  personas?: { nombre: string } | null
  ubicaciones?: { nombre: string } | null
  compras_items?: CompraItem[]
}

export interface Venta extends VentaRow {
  clientes?: { nombre: string } | null
  personas?: { nombre: string } | null
  ubicaciones?: { nombre: string } | null
  ventas_items?: VentaItem[]
}

export type ApiKey = ApiKeyRow
export type SocioComercial = SocioComercialRow
export type Gasto = GastoRow & { personas?: { nombre: string } | null }
export type ConversionBonos = ConversionBonosRow & { personas?: { nombre: string } | null }

export interface InventarioRegistro extends InventarioRegistroRow {
  ubicaciones?: { nombre: string } | null
}

interface FacturaRow {
  id: string
  numero_factura: string | null
  fecha: string
  tipo: FacturaTipo
  cliente_id: string | null
  proveedor_id: string | null
  subtotal: number
  iva: number
  total: number
  status: FacturaStatus
  venta_id: string | null
  compra_id: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

interface FacturaPartidaRow {
  id: string
  factura_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
  created_at: string
}

export interface Factura extends FacturaRow {
  clientes?: { nombre: string } | null
  proveedores?: { nombre: string } | null
  facturas_partidas?: FacturaPartida[]
}
export type FacturaPartida = FacturaPartidaRow

// ─── Items de venta/compra (enlace con inventario) ──────────────────────────

export interface VentaItemRow {
  id: string
  venta_id: string
  inventario_registro_id: string
  cantidad: number
  precio_unitario: number
  total: number
  created_at: string
}

export interface CompraItemRow {
  id: string
  compra_id: string
  inventario_registro_id: string
  cantidad: number
  precio_unitario: number
  total: number
  created_at: string
}

export interface VentaItem extends VentaItemRow {
  inventario_registros?: Pick<InventarioRegistroRow, 'nombre_producto' | 'unidad_medida' | 'cantidad' | 'ean' | 'sku' | 'numero_lote'> | null
}

export interface CompraItem extends CompraItemRow {
  inventario_registros?: Pick<InventarioRegistroRow, 'nombre_producto' | 'unidad_medida' | 'cantidad' | 'ean' | 'sku' | 'numero_lote'> | null
}

// ─── User Profiles (roles) ───────────────────────────────────────────────────

export type UserRol = 'admin' | 'subgerente' | 'gerente_operativo' | 'auxiliar' | 'contadora' | 'cotizador'

interface UserProfileRow {
  id: string
  email: string
  nombre: string | null
  rol: UserRol
  activo: boolean
  created_at: string
}

export type UserProfile = UserProfileRow

// ─── Cotizaciones ────────────────────────────────────────────────────────────

export type CotizacionRondaStatus = 'abierta' | 'cerrada'

interface TiendaRow {
  id: string
  nombre: string
  activo: boolean
  created_at: string
}

interface CotizacionRondaRow {
  id: string
  nombre: string | null
  fecha: string
  status: CotizacionRondaStatus
  notas: string | null
  fotos: string[]
  created_at: string
}

interface CotizacionProductoRow {
  id: string
  ronda_id: string
  nombre_producto: string
  orden: number
  precio_referencia: number | null
  created_at: string
}

interface CotizacionPrecioRow {
  id: string
  producto_id: string
  tienda_id: string
  precio: number
  created_at: string
  updated_at: string
}

export type Tienda = TiendaRow

export interface CotizacionRonda extends CotizacionRondaRow {
  cotizacion_productos?: CotizacionProducto[]
}

export interface CotizacionProducto extends CotizacionProductoRow {
  cotizacion_precios?: CotizacionPrecio[]
}

export interface CotizacionPrecio extends CotizacionPrecioRow {
  tiendas?: { nombre: string } | null
}

// ─── Procurement (pedidos → consolidado → cotización → compra → separación) ─

export type PedidoRondaStatus = 'pedidos' | 'consolidado' | 'cotizando' | 'asignado' | 'comprando' | 'separando' | 'completado'

interface PedidoRondaRow {
  id: string
  nombre: string | null
  fecha: string
  status: PedidoRondaStatus
  notas: string | null
  fotos: string[]
  created_at: string
}

interface PedidoClienteRow {
  id: string
  ronda_id: string
  cliente_nombre: string
  archivo_nombre: string | null
  created_at: string
}

interface PedidoItemRow {
  id: string
  pedido_cliente_id: string
  ronda_id: string
  nombre_producto: string
  cantidad: number
  precio_min: number | null
  precio_max: number | null
  created_at: string
}

interface ConsolidadoItemRow {
  id: string
  ronda_id: string
  nombre_producto: string
  cantidad_total: number
  cantidad_inventario: number
  cantidad_neta: number
  precio_min: number | null
  precio_max: number | null
  inventario_registro_id: string | null
  created_at: string
}

interface ConsolidadoPrecioRow {
  id: string
  consolidado_item_id: string
  tienda_id: string
  precio: number
  created_at: string
  updated_at: string
}

interface ProcCompraItemRow {
  id: string
  ronda_id: string
  consolidado_item_id: string
  tienda_id: string
  cantidad_comprada: number
  precio_comprado: number
  fotos: string[]
  created_at: string
}

interface SeparacionItemRow {
  id: string
  ronda_id: string
  pedido_cliente_id: string
  consolidado_item_id: string
  cantidad: number
  created_at: string
}

export interface PedidoRonda extends PedidoRondaRow {
  pedido_clientes?: PedidoCliente[]
}

export interface PedidoCliente extends PedidoClienteRow {
  pedido_items?: PedidoItem[]
}

export type PedidoItem = PedidoItemRow

export interface ConsolidadoItem extends ConsolidadoItemRow {
  consolidado_precios?: ConsolidadoPrecio[]
  inventario_registros?: { nombre_producto: string; cantidad: number } | null
}

export interface ConsolidadoPrecio extends ConsolidadoPrecioRow {
  tiendas?: { nombre: string } | null
}

export interface ProcCompraItem extends ProcCompraItemRow {
  tiendas?: { nombre: string } | null
  consolidado_items?: { nombre_producto: string } | null
}

export interface SeparacionItem extends SeparacionItemRow {
  pedido_clientes?: { cliente_nombre: string } | null
  consolidado_items?: { nombre_producto: string } | null
}

// ─── Merma ───────────────────────────────────────────────────────────────────

export type MermaMotivo = 'caducidad' | 'daño' | 'robo' | 'devolucion' | 'otro'

interface MermaRegistroRow {
  id: string
  inventario_registro_id: string | null
  nombre_producto: string
  cantidad: number
  unidad_medida: string
  motivo: MermaMotivo
  valor_perdido: number
  notas: string | null
  fecha: string
  created_by: string | null
  created_at: string
}

export interface MermaRegistro extends MermaRegistroRow {
  inventario_registros?: { nombre_producto: string } | null
}

// ─── Ticket Análisis ─────────────────────────────────────────────────────────

export type TicketStatus = 'pendiente' | 'revisado' | 'autorizado' | 'guardado'

interface TicketAnalisisRow {
  id: string
  foto_url: string
  tienda_detectada: string | null
  fecha_ticket: string | null
  subtotal: number | null
  iva: number | null
  total: number | null
  metodo_pago: string | null
  status: TicketStatus
  notas: string | null
  created_by: string | null
  authorized_by: string | null
  created_at: string
  updated_at: string
}

interface TicketItemRow {
  id: string
  ticket_id: string
  descripcion: string
  cantidad: number
  precio_unitario: number
  total: number
  created_at: string
}

export interface TicketAnalisis extends TicketAnalisisRow {
  ticket_items?: TicketItem[]
  user_profiles?: { nombre: string; email: string } | null
}

export type TicketItem = TicketItemRow

// ─── Unidades y Checklist ─────────────────────────────────────────────────────

interface UnidadRow {
  id: string
  nombre: string
  placa: string | null
  tipo: string
  activo: boolean
  created_at: string
}

export type Unidad = UnidadRow

interface ChecklistRegistroRow {
  id: string
  unidad_id: string
  fecha: string
  llantas: boolean
  aceite: boolean
  luces: boolean
  frenos: boolean
  limpieza: boolean
  documentos: boolean
  combustible_nivel: string
  kilometraje: number | null
  notas: string | null
  created_by: string | null
  created_at: string
}

export interface ChecklistRegistro extends ChecklistRegistroRow {
  unidades?: { nombre: string; placa: string | null } | null
  user_profiles?: { nombre: string | null; email: string } | null
}

// ─── Órdenes de Venta / Pedidos SAE (Fase B) ─────────────────────────────────

export type OrdenVentaStatus = 'borrador' | 'confirmado' | 'surtido' | 'cancelado'

interface OrdenVentaRow {
  id: string
  numero: string
  cliente_id: string | null
  fecha: string
  fecha_entrega: string | null
  status: OrdenVentaStatus
  subtotal: number
  iva: number
  total: number
  notas: string | null
  created_at: string
  updated_at: string
}

interface OrdenVentaItemRow {
  id: string
  orden_venta_id: string
  inventario_registro_id: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
  created_at: string
}

export interface OrdenVentaItem extends OrdenVentaItemRow {
  inventario_registros?: Pick<InventarioRegistroRow, 'nombre_producto' | 'unidad_medida'> | null
}

export interface OrdenVenta extends OrdenVentaRow {
  clientes?: { nombre: string } | null
  ordenes_venta_items?: OrdenVentaItem[]
}

// ─── Órdenes de Compra SAE (Fase C) ──────────────────────────────────────────

export type OrdenCompraStatus = 'borrador' | 'enviada' | 'recibida_parcial' | 'recibida' | 'cancelada'

interface OrdenCompraRow {
  id: string
  numero: string
  proveedor_id: string | null
  fecha: string
  fecha_entrega_esperada: string | null
  status: OrdenCompraStatus
  subtotal: number
  iva: number
  total: number
  notas: string | null
  created_at: string
  updated_at: string
}

interface OrdenCompraItemRow {
  id: string
  orden_compra_id: string
  inventario_registro_id: string | null
  descripcion: string
  cantidad: number
  precio_unitario: number
  descuento_pct: number
  subtotal: number
  created_at: string
}

export interface OrdenCompraItem extends OrdenCompraItemRow {
  inventario_registros?: Pick<InventarioRegistroRow, 'nombre_producto' | 'unidad_medida'> | null
}

export interface OrdenCompra extends OrdenCompraRow {
  proveedores?: { nombre: string } | null
  ordenes_compra_items?: OrdenCompraItem[]
}

// ─── Inventario Lotes (Fase D) ────────────────────────────────────────────────

export type LoteStatus = 'activo' | 'agotado' | 'caducado'

interface InventarioLoteRow {
  id: string
  producto_id: string
  numero_lote: string
  fecha_fabricacion: string | null
  fecha_caducidad: string | null
  cantidad_inicial: number
  cantidad_actual: number
  status: LoteStatus
  notas: string | null
  created_at: string
  updated_at: string
}

export interface InventarioLote extends InventarioLoteRow {
  inventario_registros?: Pick<InventarioRegistroRow, 'nombre_producto' | 'unidad_medida'> | null
}

// ─── Tareas ──────────────────────────────────────────────────────────────────

export type TareaPrioridad = 'baja' | 'normal' | 'alta' | 'urgente'
export type TareaStatus = 'pendiente' | 'en_progreso' | 'completada' | 'cancelada'

interface TareaRow {
  id: string
  titulo: string
  descripcion: string | null
  asignado_a: string | null
  creado_por: string | null
  prioridad: TareaPrioridad
  status: TareaStatus
  fecha_limite: string | null
  completada_at: string | null
  notas: string | null
  created_at: string
  updated_at: string
}

export interface Tarea extends TareaRow {
  asignado?: { nombre: string | null; email: string } | null
  creador?: { nombre: string | null; email: string } | null
}

// ─── Database type para createClient<Database> ──────────────────────────────

export interface Database {
  public: {
    Tables: {
      personas: {
        Row: PersonaRow
        Insert: Omit<PersonaRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<PersonaRow, 'id' | 'created_at' | 'updated_at'>>
      }
      ubicaciones: {
        Row: UbicacionRow
        Insert: Omit<UbicacionRow, 'id' | 'created_at'>
        Update: Partial<Omit<UbicacionRow, 'id' | 'created_at'>>
      }
      clientes: {
        Row: ClienteRow
        Insert: Omit<ClienteRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ClienteRow, 'id' | 'created_at' | 'updated_at'>>
      }
      proveedores: {
        Row: ProveedorRow
        Insert: Omit<ProveedorRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<ProveedorRow, 'id' | 'created_at' | 'updated_at'>>
      }
      compras: {
        Row: CompraRow
        Insert: Omit<CompraRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<CompraRow, 'id' | 'created_at' | 'updated_at'>>
      }
      ventas: {
        Row: VentaRow
        Insert: Omit<VentaRow, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<VentaRow, 'id' | 'created_at' | 'updated_at'>>
      }
      inventario_registros: {
        Row: InventarioRegistroRow
        Insert: Omit<InventarioRegistroRow, 'id' | 'created_at'>
        Update: Partial<Omit<InventarioRegistroRow, 'id' | 'created_at'>>
      }
    }
  }
}
