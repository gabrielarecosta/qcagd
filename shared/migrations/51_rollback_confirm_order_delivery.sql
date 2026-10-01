-- ==============================================================================
-- SCRIPT DE REVERSIÓN (ROLLBACK): MIGRACIÓN 51
-- Tarea: QCA1 — Agregar o corregir el botón Entregado en el monitor de pedidos
-- Ejecutar en el SQL Editor de Supabase únicamente si se requiere revertir
-- ==============================================================================

-- 1. Eliminar función RPC confirm_order_delivery
DROP FUNCTION IF EXISTS public.confirm_order_delivery(BIGINT, TEXT, TEXT);

-- 2. Eliminar índices auxiliares si se crearon en esta migración
DROP INDEX IF EXISTS public.idx_orders_estado;
DROP INDEX IF EXISTS public.idx_orders_delivered_at;

-- NOTA: Todos los datos existentes en la tabla orders y tablas vinculadas se preservan intactos.
