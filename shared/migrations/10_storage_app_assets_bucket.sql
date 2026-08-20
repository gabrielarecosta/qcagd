-- ============================================================
-- MIGRACIÓN 10: CREACIÓN DEL BUCKET DE STORAGE 'app-assets'
-- Permite almacenar y servir imágenes de productos, banners y logos.
-- ============================================================

-- 1. Crear el bucket 'app-assets' como público si no existe
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'app-assets',
  'app-assets',
  TRUE,
  10485760, -- 10MB límite por archivo
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = TRUE,
  file_size_limit = 10485760;

-- 2. Habilitar lectura pública para cualquier usuario (App cliente y Admin)
DROP POLICY IF EXISTS "Public Access app-assets" ON storage.objects;
CREATE POLICY "Public Access app-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'app-assets');

-- 3. Habilitar subida de imágenes
DROP POLICY IF EXISTS "Allow uploads to app-assets" ON storage.objects;
CREATE POLICY "Allow uploads to app-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'app-assets');

-- 4. Habilitar actualización de imágenes
DROP POLICY IF EXISTS "Allow update to app-assets" ON storage.objects;
CREATE POLICY "Allow update to app-assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'app-assets')
  WITH CHECK (bucket_id = 'app-assets');

-- 5. Habilitar eliminación de imágenes
DROP POLICY IF EXISTS "Allow delete to app-assets" ON storage.objects;
CREATE POLICY "Allow delete to app-assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'app-assets');
