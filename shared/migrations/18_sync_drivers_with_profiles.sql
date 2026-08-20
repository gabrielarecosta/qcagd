-- ============================================================
-- MIGRACIÓN 18: LIMPIEZA Y SINCRONIZACIÓN DE REPARTIDORES / CHOFERES
-- Química General Deheza — Ejecutar en Supabase SQL Editor
-- ============================================================
-- Elimina de la tabla drivers cualquier registro que no corresponda
-- a un perfil activo con rol 'repartidor' en la tabla profiles.
-- ============================================================

-- 1. Eliminar choferes huérfanos o que no tengan rol 'repartidor' en profiles
DELETE FROM drivers
WHERE id NOT IN (
  SELECT id FROM profiles WHERE rol = 'repartidor'
);

-- 2. Asegurar que los repartidores de profiles existan en la tabla drivers
INSERT INTO drivers (id, vehiculo_info, activo)
SELECT 
  id,
  COALESCE(
    CASE 
      WHEN auto IS NOT NULL AND auto <> '' THEN auto || COALESCE(' (' || patente || ')', '')
      ELSE 'Vehículo sin asignar'
    END,
    'Sin vehículo'
  ),
  COALESCE(activo, true)
FROM profiles
WHERE rol = 'repartidor'
ON CONFLICT (id) DO UPDATE SET
  activo = EXCLUDED.activo;

-- 3. Verificación final de choferes activos
SELECT p.id, p.nombre, p.email, p.rol, d.vehiculo_info, p.activo 
FROM profiles p
LEFT JOIN drivers d ON d.id = p.id
WHERE p.rol = 'repartidor'
ORDER BY p.nombre;
