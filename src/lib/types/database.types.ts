export type FormaPago = 'efectivo' | 'bonos_gasolina' | 'mixto' | 'otro'
export type StatusPago = 'pendiente' | 'parcial' | 'pagado'
export type FacturaStatus = 'borrador' | 'emitida' | 'pagada' | 'cancelada'
export type FacturaTipo = 'ingreso' | 'egreso'
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
  descripcion: string | null
  gastos: number | null
  notas: string | null
  status_pago: StatusPago
  fecha_vencimiento: string | null
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
  compra_origen_id: string | null
  fecha_entrega: string | null
  gastos_extras: number | null
  notas: string | null
  status_pago: StatusPago
  fecha_vencimiento: string | null
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
  precio_compra_unitario: number
  precio_compra_total: number
  numero_lote: string | null
  fecha_caducidad: string | null
  cantidad_por_caja: number | null
  cajas_por_tarima: number | null
  unidad_medida: UnidadMedida
  ubicacion_id: string | null
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
}

export interface Venta extends VentaRow {
  clientes?: { nombre: string } | null
  personas?: { nombre: string } | null
  ubicaciones?: { nombre: string } | null
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
