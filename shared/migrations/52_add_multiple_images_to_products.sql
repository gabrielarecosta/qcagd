-- Migración 52: Soporte para múltiples fotos/imágenes en productos
-- Permite almacenar más de una foto por producto (Foto Principal, Foto Secundaria y array completo de imágenes).

ALTER TABLE products 
ADD COLUMN IF NOT EXISTS imagen_secundaria TEXT,
ADD COLUMN IF NOT EXISTS imagenes TEXT[] DEFAULT '{}';

-- Sincronizar registros existentes:
-- 1. Si existe 'imagen' y 'imagenes' está vacío, inicializar el array con la foto principal
UPDATE products 
SET imagenes = ARRAY[imagen] 
WHERE imagen IS NOT NULL 
  AND imagen <> '' 
  AND (imagenes IS NULL OR imagenes = '{}');

-- 2. Si ya existen 2 o más fotos en el array pero 'imagen_secundaria' está vacía, sincronizarla
UPDATE products
SET imagen_secundaria = imagenes[2]
WHERE (imagen_secundaria IS NULL OR imagen_secundaria = '') 
  AND imagenes IS NOT NULL 
  AND array_length(imagenes, 1) >= 2;

-- Documentación de columnas en el catálogo de PostgreSQL
COMMENT ON COLUMN products.imagen IS 'URL de la imagen principal del producto (compatibilidad estándar).';
COMMENT ON COLUMN products.imagen_secundaria IS 'URL de la segunda imagen del producto (foto secundaria para galería o vista dual).';
COMMENT ON COLUMN products.imagenes IS 'Array con todas las URLs de imágenes del producto (soporta múltiples fotos ilimitadas).';
