-- ============================================================
-- MIGRACIÓN 19: ASIGNACIÓN Y VINCULACIÓN DE RUTAS PARA IVÁN
-- Química General Deheza — Ejecutar en Supabase SQL Editor
-- ============================================================
-- Ajusta el perfil existente de ivan@quimicageneraldeheza.com.ar
-- y le vincula las rutas y paradas activas.
-- ============================================================

-- 1. Asegurar que el perfil de Iván tenga rol 'repartidor' y activo = true
UPDATE profiles
SET 
  rol = 'repartidor',
  activo = TRUE,
  branch_id = COALESCE(branch_id, 'branch-gd1')
WHERE email ILIKE '%ivan%' OR nombre ILIKE '%ivan%';

-- 2. Asegurar que exista su registro en la tabla drivers
INSERT INTO drivers (id, vehiculo_info, activo)
SELECT id, 'Camioneta Reparto', true
FROM profiles
WHERE email ILIKE '%ivan%' OR nombre ILIKE '%ivan%'
ON CONFLICT (id) DO UPDATE SET activo = TRUE;

-- 3. Asignar las rutas activas al ID del perfil de Iván
UPDATE delivery_routes
SET 
  driver_id = (SELECT id FROM profiles WHERE email ILIKE '%ivan%' OR nombre ILIKE '%ivan%' LIMIT 1),
  repartidor_id = (SELECT id FROM profiles WHERE email ILIKE '%ivan%' OR nombre ILIKE '%ivan%' LIMIT 1),
  status = 'active',
  estado = 'en_camino'
WHERE status IN ('pendiente', 'optimized', 'confirmed', 'active', 'armado', 'en_curso')
   OR estado IN ('armado', 'en_camino', 'pendiente');

-- 4. Asignar los pedidos pendientes/en reparto al ID del perfil de Iván
UPDATE orders
SET 
  repartidor_id = (SELECT id FROM profiles WHERE email ILIKE '%ivan%' OR nombre ILIKE '%ivan%' LIMIT 1),
  estado = 'en_reparto'
WHERE estado IN ('listo_para_reparto', 'en_reparto', 'en_camino', 'armado', 'pendiente')
  AND delivery_method = 'reparto';

-- 5. Crear las paradas en delivery_route_stops para las órdenes de la ruta activa
INSERT INTO delivery_route_stops (route_id, order_id, stop_order, status, created_at)
SELECT 
  r.id AS route_id,
  o.id AS order_id,
  ROW_NUMBER() OVER (PARTITION BY r.id ORDER BY o.created_at) AS stop_order,
  'pendiente' AS status,
  NOW() AS created_at
FROM delivery_routes r
CROSS JOIN orders o
WHERE r.status IN ('active', 'optimized', 'confirmed', 'armado', 'en_camino')
  AND o.estado IN ('en_reparto', 'listo_para_reparto', 'en_camino', 'armado', 'pendiente')
  AND NOT EXISTS (
    SELECT 1 FROM delivery_route_stops s WHERE s.route_id = r.id AND s.order_id = o.id
  );

-- 6. CONSULTA DE VERIFICACIÓN: Ver la ruta y paradas asignadas a Iván
SELECT 
  p.id AS perfil_id,
  p.nombre AS chofer_nombre,
  p.email AS chofer_email,
  r.id AS ruta_id,
  r.status AS estado_ruta,
  s.stop_order AS parada_num,
  o.numero AS numero_pedido,
  o.total,
  c.nombre AS cliente_nombre,
  c.direccion
FROM profiles p
JOIN delivery_routes r ON (r.driver_id = p.id OR r.repartidor_id = p.id)
JOIN delivery_route_stops s ON s.route_id = r.id
JOIN orders o ON o.id = s.order_id
LEFT JOIN customers c ON c.id = o.cliente_id
WHERE p.email ILIKE '%ivan%' OR p.nombre ILIKE '%ivan%'
ORDER BY s.stop_order;
