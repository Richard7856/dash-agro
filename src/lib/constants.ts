import type { FormaPago } from '@/lib/types/database.types'

export const FORMAS_PAGO: { value: FormaPago; label: string }[] = [
  { value: 'efectivo',        label: 'Efectivo' },
  { value: 'credito',         label: 'Crédito' },
  { value: 'transferencia',   label: 'Transferencia' },
  { value: 'tarjeta_credito', label: 'Tarjeta crédito' },
  { value: 'tarjeta_debito',  label: 'Tarjeta débito' },
  { value: 'bonos_gasolina',  label: 'Bonos gasolina' },
  { value: 'mixto',           label: 'Mixto' },
  { value: 'otro',            label: 'Otro' },
]
