// src/lib/facturama.ts
export interface FacturamaConfig {
  usuario: string
  password: string
  sandbox: boolean
}

export interface CfdiConcepto {
  ProductCode: string      // código SAT (ej. "01010101")
  UnitCode: string         // clave unidad SAT (ej. "H87" pieza, "KGM" kg)
  Unit: string             // descripción unidad
  Description: string
  UnitPrice: number
  Quantity: number
  TaxObject?: string       // "02" = sí objeto de impuesto
  Taxes?: {
    Type: string           // "IVA"
    Rate: number           // 0.16
    Factor: string         // "Tasa"
  }[]
}

export interface EmitirCfdiPayload {
  CfdiType: string         // "I" ingreso, "E" egreso
  PaymentForm: string      // "01" efectivo, "03" transferencia, "99" por definir
  PaymentMethod: string    // "PUE" = una sola pago, "PPD" = parcialidades
  Currency: string         // "MXN"
  Series?: string
  Folio?: string
  Receiver: {
    Rfc: string
    Name: string
    CfdiUse: string        // "G03" gastos en general, "S01" sin efectos fiscales
    TaxZipCode: string
    FiscalRegime: string
  }
  Items: CfdiConcepto[]
}

export interface CfdiResponse {
  Id: string
  FolioFiscal: string
  Serie: string
  Folio: string
  Date: string
  Total: number
  Status: string
}

function getBaseUrl(sandbox: boolean): string {
  return sandbox
    ? 'https://apisandbox.facturama.mx'
    : 'https://api.facturama.mx'
}

function getAuthHeader(usuario: string, password: string): string {
  const token = Buffer.from(`${usuario}:${password}`).toString('base64')
  return `Basic ${token}`
}

export async function emitirCfdi(
  config: FacturamaConfig,
  payload: EmitirCfdiPayload
): Promise<CfdiResponse> {
  const url = `${getBaseUrl(config.sandbox)}/api/cfdi`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: getAuthHeader(config.usuario, config.password),
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Facturama error ${res.status}: ${err}`)
  }
  return res.json()
}

export async function cancelarCfdi(
  config: FacturamaConfig,
  facturamaId: string,
  motivo: string = '02'
): Promise<void> {
  const url = `${getBaseUrl(config.sandbox)}/api/cfdi/${facturamaId}?motive=${motivo}&type=issuer`
  const res = await fetch(url, {
    method: 'DELETE',
    headers: {
      Authorization: getAuthHeader(config.usuario, config.password),
    },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Facturama cancelación error ${res.status}: ${err}`)
  }
}

export async function descargarPdf(
  config: FacturamaConfig,
  facturamaId: string
): Promise<string> {
  const url = `${getBaseUrl(config.sandbox)}/cfdi/${facturamaId}/pdf/issuer`
  const res = await fetch(url, {
    headers: { Authorization: getAuthHeader(config.usuario, config.password) },
  })
  if (!res.ok) throw new Error(`No se pudo descargar PDF: ${res.status}`)
  const data = await res.json()
  return data.Content as string // base64
}

export async function descargarXml(
  config: FacturamaConfig,
  facturamaId: string
): Promise<string> {
  const url = `${getBaseUrl(config.sandbox)}/cfdi/${facturamaId}/xml/issuer`
  const res = await fetch(url, {
    headers: { Authorization: getAuthHeader(config.usuario, config.password) },
  })
  if (!res.ok) throw new Error(`No se pudo descargar XML: ${res.status}`)
  const data = await res.json()
  return data.Content as string // base64
}

// Envía el CFDI timbrado por email al receptor.
// Facturama endpoint: POST /api/Lite/SendSingleCfdiByMail?cfdiType=issuer&cfdiId={id}&email={email}
// Verificar URL exacta en swagger de Facturama al conectar con credenciales reales.
export async function enviarCfdiEmail(
  config: FacturamaConfig,
  facturamaId: string,
  email: string
): Promise<void> {
  const params = new URLSearchParams({
    cfdiType: 'issuer',
    cfdiId: facturamaId,
    email,
  })
  const url = `${getBaseUrl(config.sandbox)}/api/Lite/SendSingleCfdiByMail?${params}`
  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: getAuthHeader(config.usuario, config.password) },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Facturama email error ${res.status}: ${err}`)
  }
}

export async function testConexion(config: FacturamaConfig): Promise<boolean> {
  const url = `${getBaseUrl(config.sandbox)}/api/profile`
  const res = await fetch(url, {
    headers: { Authorization: getAuthHeader(config.usuario, config.password) },
  })
  return res.ok
}

// Catálogos SAT más comunes para sector agrícola
export const USOS_CFDI = [
  { value: 'G01', label: 'G01 - Adquisición de mercancias' },
  { value: 'G03', label: 'G03 - Gastos en general' },
  { value: 'S01', label: 'S01 - Sin efectos fiscales' },
  { value: 'CP01', label: 'CP01 - Pagos' },
]

export const FORMAS_PAGO_CFDI = [
  { value: '01', label: '01 - Efectivo' },
  { value: '02', label: '02 - Cheque nominativo' },
  { value: '03', label: '03 - Transferencia electrónica' },
  { value: '04', label: '04 - Tarjeta de crédito' },
  { value: '28', label: '28 - Tarjeta de débito' },
  { value: '99', label: '99 - Por definir' },
]

export const METODOS_PAGO = [
  { value: 'PUE', label: 'PUE - Pago en una sola exhibición' },
  { value: 'PPD', label: 'PPD - Pago en parcialidades o diferido' },
]

export const REGIMENES_FISCALES = [
  { value: '612', label: '612 - Personas Físicas con Actividades Empresariales' },
  { value: '616', label: '616 - Sin obligaciones fiscales' },
  { value: '621', label: '621 - Incorporación Fiscal' },
  { value: '626', label: '626 - Simplificado de Confianza' },
  { value: '601', label: '601 - General de Ley Personas Morales' },
  { value: '603', label: '603 - Personas Morales con Fines no Lucrativos' },
  { value: '625', label: '625 - Régimen de las Actividades Empresariales con ingresos a través de Plataformas Tecnológicas' },
]

export const UNIDADES_SAT = [
  { value: 'H87', label: 'H87 - Pieza' },
  { value: 'KGM', label: 'KGM - Kilogramo' },
  { value: 'GRM', label: 'GRM - Gramo' },
  { value: 'LTR', label: 'LTR - Litro' },
  { value: 'XBX', label: 'XBX - Caja' },
  { value: 'XBG', label: 'XBG - Bolsa' },
  { value: 'E48', label: 'E48 - Unidad de servicio' },
]
