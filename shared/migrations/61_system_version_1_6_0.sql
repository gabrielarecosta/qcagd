-- ============================================================================
-- Migración 61: Actualizar versión del sistema a 1.6.0
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================

-- Insertar o actualizar la versión 1.6.0
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.6.0', '2026-10-21', 'Soporte completo para 3 listas de precios segmentadas por rol (Lista 1 Minorista, Lista 3 Mayorista, Lista 4 Socios) en importación Excel y catálogo; acciones masivas de actualización de precios por marca, categoría, subcategoría, búsqueda de texto o selección manual; nuevo panel de Solicitudes Mayoristas; corrección de búsqueda con letra ñ y optimización en carrito.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
