import type { FormaPago } from '@/lib/types/database.types'

export const FORMAS_PAGO: { value: FormaPago; label: string }[] = [
  { value: 'efectivo',       label: 'Efectivo' },
  { value: 'bonos_gasolina', label: 'Bonos gasolina' },
  { value: 'mixto',          label: 'Mixto' },
  { value: 'otro',           label: 'Otro' },
]
