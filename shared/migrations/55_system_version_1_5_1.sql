-- ============================================================================
-- Migración 55: Actualizar versión del sistema a 1.5.1
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================


-- Insertar o actualizar la versión 1.5.1
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.5.1', '2026-10-06', 'Corrección en Catálogo: Precarga de unidades existentes y actualización directa de cantidad en el pedido.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
