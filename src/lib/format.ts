import type { FormaPago } from '@/lib/types/database.types'

export function formatMxn(amount: number): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount)
}

export function formatDate(dateStr: string): string {
  const [year, month, day] = dateStr.split('-')
  return `${day}/${month}/${year}`
}

export function formatFormaPago(fp: FormaPago): string {
  const labels: Record<FormaPago, string> = {
    efectivo:       'Efectivo',
    bonos_gasolina: 'Bonos gasolina',
    mixto:          'Mixto',
    otro:           'Otro',
  }
  return labels[fp] ?? fp
}

export function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function firstOfMonthISO(): string {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
}

export function generateSKU(): string {
  const rand = Math.random().toString(36).substring(2, 8).toUpperCase()
  return `SKU-${rand}`
}

export function generateLote(): string {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `LOTE-${date}-${rand}`
}

export function generateFolio(prefix: string): string {
  const now = new Date()
  const date = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`
  const rand = Math.random().toString(36).substring(2, 6).toUpperCase()
  return `${prefix}-${date}-${rand}`
}

export function generateNumeroCompra(): string {
  return generateFolio('COMP')
}

/** Returns { inicio, fin, label } for the month at `offset` months before today (0 = current month) */
export function monthRange(offset: number): { inicio: string; fin: string; label: string } {
  const now = new Date()
  const d = new Date(now.getFullYear(), now.getMonth() - offset, 1)
  const year = d.getFullYear()
  const month = d.getMonth()
  const inicio = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const fin = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  const label = d.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })
  return { inicio, fin, label }
}

export function generateNumeroVenta(): string {
  return generateFolio('VENTA')
}
