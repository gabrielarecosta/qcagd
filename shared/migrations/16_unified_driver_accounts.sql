-- ============================================================
-- MIGRACIÓN: CUENTAS UNIFICADAS DE REPARTIDORES 1, 2 Y 3
-- Química General Deheza — Ejecutar en Supabase SQL Editor
-- ============================================================
-- Este script crea (o asegura) los perfiles de los 3 repartidores
-- vinculados a sus cuentas de login, con IDs consistentes.
-- Es 100% idempotente: no borra datos existentes.
-- ============================================================

-- 1. Asegurar existencia de la tabla profiles con columna password
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS rol TEXT DEFAULT 'ventas';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS activo BOOLEAN DEFAULT TRUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'branch-gd1';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS patente TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dni TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 2. Crear tabla drivers si no existe
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  vehiculo_info TEXT DEFAULT 'Sin vehículo',
  activo BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. REPARTIDOR 1: Perfil + cuenta de acceso
INSERT INTO profiles (id, nombre, email, rol, activo, telefono, branch_id, password, created_at)
VALUES (
  'rep-001',
  'Repartidor 1',
  'repartidor1@quimicageneraldeheza.com.ar',
  'repartidor',
  true,
  '',
  'branch-gd1',
  '',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  rol = 'repartidor',
  activo = TRUE,
  branch_id = 'branch-gd1';

-- 4. REPARTIDOR 2: Perfil + cuenta de acceso
INSERT INTO profiles (id, nombre, email, rol, activo, telefono, branch_id, password, created_at)
VALUES (
  'rep-002',
  'Repartidor 2',
  'repartidor2@quimicageneraldeheza.com.ar',
  'repartidor',
  true,
  '',
  'branch-gd1',
  '',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  rol = 'repartidor',
  activo = TRUE,
  branch_id = 'branch-gd1';

-- 5. REPARTIDOR 3: Perfil + cuenta de acceso
INSERT INTO profiles (id, nombre, email, rol, activo, telefono, branch_id, password, created_at)
VALUES (
  'rep-003',
  'Repartidor 3',
  'repartidor3@quimicageneraldeheza.com.ar',
  'repartidor',
  true,
  '',
  'branch-gd1',
  '',
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  rol = 'repartidor',
  activo = TRUE,
  branch_id = 'branch-gd1';

-- 6. Vincular repartidores en tabla drivers
INSERT INTO drivers (id, vehiculo_info, activo)
VALUES
  ('rep-001', 'Vehículo 1', true),
  ('rep-002', 'Vehículo 2', true),
  ('rep-003', 'Vehículo 3', true)
ON CONFLICT (id) DO UPDATE SET
  activo = TRUE;


-- 8. Asegurar RLS permisivo en profiles y drivers
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total profiles repartidores" ON profiles;
CREATE POLICY "Acceso total profiles repartidores" ON profiles FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Acceso total drivers" ON drivers;
CREATE POLICY "Acceso total drivers" ON drivers FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 9. Columnas sincronizadas en delivery_routes para el repartidor
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS driver_id TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS repartidor_id TEXT;

-- 10. Vista de verificación: cuáles repartidores están creados
SELECT id, nombre, email, rol, activo FROM profiles WHERE rol = 'repartidor' ORDER BY nombre;
