-- Fotos de evidencia opcionales en inventario, ventas y compras
-- Array de URLs públicas de Supabase Storage (bucket: evidencias)

ALTER TABLE inventario_registros
  ADD COLUMN IF NOT EXISTS fotos text[] NOT NULL DEFAULT '{}';

ALTER TABLE ventas
  ADD COLUMN IF NOT EXISTS fotos text[] NOT NULL DEFAULT '{}';

ALTER TABLE compras
  ADD COLUMN IF NOT EXISTS fotos text[] NOT NULL DEFAULT '{}';

-- Crear el bucket de storage (ejecutar solo una vez en el dashboard o con service role)
-- INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
-- VALUES ('evidencias', 'evidencias', true, 10485760, ARRAY['image/jpeg','image/png','image/webp','image/heic'])
-- ON CONFLICT (id) DO NOTHING;
