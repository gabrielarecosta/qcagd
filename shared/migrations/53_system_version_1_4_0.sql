-- ============================================================================
-- Migración 53: Actualizar versión del sistema a 1.4.0 y permisos de gestión
-- Centraliza las versiones en la base de datos PostgreSQL (Supabase)
-- ============================================================================

-- Asegurar tabla de versiones
CREATE TABLE IF NOT EXISTS public.system_versions (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

ALTER TABLE public.system_versions ENABLE ROW LEVEL SECURITY;

-- Política de lectura pública
DROP POLICY IF EXISTS "Permitir lectura publica de versiones" ON public.system_versions;
CREATE POLICY "Permitir lectura publica de versiones"
  ON public.system_versions FOR SELECT
  USING (true);

-- Política para que usuarios autenticados (admin / staff) puedan insertar o actualizar
DROP POLICY IF EXISTS "Permitir gestion de versiones a autenticados" ON public.system_versions;
CREATE POLICY "Permitir gestion de versiones a autenticados"
  ON public.system_versions FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insertar o actualizar la versión 1.4.0
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.4.0', '2026-10-05', 'Resolución de errores en stock. Visualización de carrito y fotos mejorada.')
ON CONFLICT (version) DO UPDATE
SET fecha = EXCLUDED.fecha,
    descripcion = EXCLUDED.descripcion;
