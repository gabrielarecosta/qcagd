-- ============================================================================
-- Migración 63: Actualizar versión del sistema a 1.6.1
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================

-- Insertar o actualizar la versión 1.6.1
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.6.1', '2026-11-03', 'Precios de Súper Ofertas aplicados fielmente en el carrito; segmentación de ofertas por categoría de cliente (minorista, mayorista, socio); visualización precisa del rol del cliente en Pedidos Recientes; sincronización de precios de carritos según categoría; y búsqueda insensible a tildes.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
