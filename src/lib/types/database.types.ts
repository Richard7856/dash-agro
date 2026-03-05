export type FormaPago = 'efectivo' | 'bonos_gasolina' | 'mixto' | 'otro'
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
}

interface UbicacionRow {
  id: string
  nombre: string
  descripcion: string | null
  activo: boolean
  created_at: string
}

interface CompraRow {
  id: string
  fecha: string
  ubicacion_id: string | null
  persona_id: string | null
  forma_pago: FormaPago
  monto: number
  notas: string | null
  created_at: string
  updated_at: string
}

interface VentaRow {
  id: string
  fecha: string
  ubicacion_id: string | null
  persona_id: string | null
  forma_pago: FormaPago
  monto: number
  notas: string | null
  created_at: string
  updated_at: string
}

interface InventarioRegistroRow {
  id: string
  ean: string | null
  sku: string | null
  nombre_producto: string
  cantidad: number
  precio_unitario: number
  precio_total: number
  lote: string | null
  fecha_caducidad: string | null
  cantidad_por_caja: number | null
  cajas_tarima: number | null
  unidad_medida: UnidadMedida
  ubicacion_id: string | null
  created_at: string
}

// ─── Tipos de UI (con joins opcionales) ────────────────────────────────────

export type Persona = PersonaRow
export type Ubicacion = UbicacionRow

export interface Compra extends CompraRow {
  personas?: { nombre: string } | null
  ubicaciones?: { nombre: string } | null
}

export interface Venta extends VentaRow {
  personas?: { nombre: string } | null
  ubicaciones?: { nombre: string } | null
}

export interface InventarioRegistro extends InventarioRegistroRow {
  ubicaciones?: { nombre: string } | null
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
