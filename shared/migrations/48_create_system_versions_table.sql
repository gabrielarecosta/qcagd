-- Migración 48: Tabla para control de versiones y auto-actualización del sistema
CREATE TABLE IF NOT EXISTS public.system_versions (
  id BIGSERIAL PRIMARY KEY,
  version TEXT NOT NULL UNIQUE,
  fecha DATE NOT NULL DEFAULT CURRENT_DATE,
  descripcion TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS
ALTER TABLE public.system_versions ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura pública para clientes y administradores
DROP POLICY IF EXISTS "Permitir lectura publica de versiones" ON public.system_versions;
CREATE POLICY "Permitir lectura publica de versiones"
  ON public.system_versions FOR SELECT
  USING (true);

-- Semilla de versiones iniciales si no existen
INSERT INTO public.system_versions (version, fecha, descripcion)
VALUES 
  ('1.3.0', '2026-09-23', 'Sistema de auto-actualización de caché, ingreso numérico de unidades en carrito y corrección de lista 1 de precios.'),
  ('1.2.0', '2026-09-20', 'Gestión multirramal de sucursales, listas de compras de clientes y panel de logística.'),
  ('1.1.0', '2026-09-15', 'Integración con Mercado Pago, trazado de rutas geográficas y perfiles de usuarios.'),
  ('1.0.0', '2026-09-01', 'Lanzamiento inicial de la plataforma web de clientes y administración.')
ON CONFLICT (version) DO NOTHING;
