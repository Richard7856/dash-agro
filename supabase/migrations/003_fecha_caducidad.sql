-- Agregar columna fecha_caducidad a inventario_registros
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE inventario_registros
  ADD COLUMN IF NOT EXISTS fecha_caducidad DATE;

-- Índice para consultas de productos próximos a vencer
CREATE INDEX IF NOT EXISTS idx_inventario_fecha_caducidad
  ON inventario_registros (fecha_caducidad)
  WHERE fecha_caducidad IS NOT NULL;
