-- ============================================================================
-- Migración 59: Actualizar versión del sistema a 1.5.5
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================

-- Insertar o actualizar la versión 1.5.5
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.5.5', '2026-10-17', 'Diseño completamente responsive para celulares; inicio y navegación moderna para usuarios invitados; eliminación individual y edición directa de cantidad por teclado en carrito; cierre de menús al tocar fuera; acceso directo a secciones del perfil.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
