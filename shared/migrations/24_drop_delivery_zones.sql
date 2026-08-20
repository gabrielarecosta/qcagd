-- ============================================================
-- MIGRACIÓN: ELIMINACIÓN DE ZONAS DE REPARTO
-- Elimina tablas y columnas asociadas a zonas geográficas
-- ============================================================

-- 1. Eliminar tabla de zonas de reparto si existe
DROP TABLE IF EXISTS delivery_zones CASCADE;

-- 2. Eliminar columnas de zonas en la tabla de pedidos (orders)
ALTER TABLE orders 
  DROP COLUMN IF EXISTS delivery_zone,
  DROP COLUMN IF EXISTS zone_id,
  DROP COLUMN IF EXISTS zone_name,
  DROP COLUMN IF EXISTS zone_assignment_type,
  DROP COLUMN IF EXISTS zone_assigned_at;

-- 3. Eliminar columnas de zonas en clientes y direcciones secundarias
ALTER TABLE customers 
  DROP COLUMN IF EXISTS zona;

ALTER TABLE customer_addresses 
  DROP COLUMN IF EXISTS zona;

-- 4. Eliminar columna zone_id en hojas de ruta (delivery_routes)
ALTER TABLE delivery_routes 
  DROP COLUMN IF EXISTS zone_id;
