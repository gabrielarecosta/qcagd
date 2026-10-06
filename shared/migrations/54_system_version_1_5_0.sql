-- ============================================================================
-- Migración 54: Actualizar versión del sistema a 1.5.0
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================


-- Insertar o actualizar la versión 1.5.0
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.5.0', '2026-10-06', 'Optimización en Monitor de Pedidos: Carga bajo demanda de artículos por orden e indicador de conteo en tiempo real.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
