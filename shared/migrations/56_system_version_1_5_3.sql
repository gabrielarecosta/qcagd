-- ============================================================================
-- Migración 56: Actualizar versión del sistema a 1.5.3
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================


-- Insertar o actualizar la versión 1.5.3
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.5.3', '2026-10-06', 'Nueva pantalla de producto con URL propia (/producto/[id]), layout de 2 columnas, carrusel de fotos, visor con zoom lightbox, previsualización flotante ampliada y menú de navegación integrado.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
