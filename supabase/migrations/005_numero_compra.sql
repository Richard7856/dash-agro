-- Agregar número de folio/lote a compras y ventas para trazabilidad
-- Ejecutar en el SQL Editor de Supabase

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS numero_compra TEXT;

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS numero_venta TEXT;

-- Índices para búsqueda por folio
CREATE INDEX IF NOT EXISTS idx_compras_numero_compra ON compras (numero_compra) WHERE numero_compra IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ventas_numero_venta   ON ventas  (numero_venta)  WHERE numero_venta  IS NOT NULL;
