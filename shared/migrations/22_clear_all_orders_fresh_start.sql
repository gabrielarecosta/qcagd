-- ============================================================
-- SCRIPT SQL: Limpieza de Pedidos e Inicio Desde Cero
-- Químicagd / Química General Deheza
-- ============================================================

-- 1. Desactivar temporalmente restricciones de clave foránea si es necesario
BEGIN;

-- 2. Eliminar paradas de ruta y hojas de ruta
TRUNCATE TABLE delivery_route_stops CASCADE;
TRUNCATE TABLE delivery_events CASCADE;
TRUNCATE TABLE delivery_assignments CASCADE;
TRUNCATE TABLE deliveries CASCADE;
TRUNCATE TABLE delivery_routes CASCADE;

-- 3. Eliminar registros de historial y pagos asociados a pedidos
TRUNCATE TABLE order_status_history CASCADE;
TRUNCATE TABLE payment_logs CASCADE;
TRUNCATE TABLE receipts CASCADE;

-- 4. Eliminar los detalles e ítems de los pedidos
TRUNCATE TABLE order_items CASCADE;

-- 5. Eliminar todos los pedidos principales
TRUNCATE TABLE orders CASCADE;

-- 6. Confirmar transacción
COMMIT;
