-- Agregar columnas de empaque a inventario_registros
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE inventario_registros
  ADD COLUMN IF NOT EXISTS cantidad_por_caja NUMERIC,
  ADD COLUMN IF NOT EXISTS cajas_tarima      INTEGER;
