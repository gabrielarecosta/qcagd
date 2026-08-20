-- ============================================================
-- MIGRACIÓN 20: ASIGNACIÓN DE COORDENADAS PARA EL MAPA DE RECORRIDO
-- Química General Deheza — Ejecutar en Supabase SQL Editor
-- ============================================================
-- Asigna coordenadas latitud/longitud geográficas en General Deheza (CBA)
-- a todos los pedidos activos para que aparezcan las paradas #1, #2, #3...
-- y la línea de recorrido en el mapa del repartidor.
-- ============================================================

-- 1. Asignar coordenadas distribuidas usando CTE (compatible con Postgres)
WITH numbered_orders AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn
  FROM orders
  WHERE (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0)
)
UPDATE orders o
SET 
  latitude = -32.7561 + (n.rn * 0.0035 - 0.007),
  longitude = -63.7845 + (n.rn * 0.0042 - 0.008),
  formatted_address = COALESCE(o.formatted_address, o.original_address, 'General Deheza, Córdoba')
FROM numbered_orders n
WHERE o.id = n.id;

-- 2. Asegurar coordenadas válidas para cualquier orden activa restante
UPDATE orders
SET 
  latitude = -32.7580,
  longitude = -63.7850
WHERE (latitude IS NULL OR longitude IS NULL OR latitude = 0);

-- 3. CONSULTA DE VERIFICACIÓN: Ver las órdenes con sus coordenadas en General Deheza
SELECT 
  id,
  numero,
  estado,
  formatted_address,
  latitude,
  longitude,
  repartidor_id
FROM orders
WHERE estado IN ('listo_para_reparto', 'en_reparto', 'en_camino', 'armado', 'pendiente')
ORDER BY created_at DESC;
