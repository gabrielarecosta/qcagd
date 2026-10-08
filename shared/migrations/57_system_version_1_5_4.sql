-- ============================================================================
-- Migración 57: Actualizar versión del sistema a 1.5.4
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================

-- Insertar o actualizar la versión 1.5.4
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.5.4', '2026-10-08', 'Identificación y búsqueda de N° de cliente en pedidos, directorio y perfil; orden alfabético en artículos de pedidos y remito; buscador con lupa en carrito flotante y carrito completo.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
