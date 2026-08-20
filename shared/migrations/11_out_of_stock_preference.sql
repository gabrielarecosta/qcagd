-- ============================================================
-- MIGRACIÓN 11: PREFERENCIA DE FALTANTE DE STOCK EN PEDIDOS
-- Permite registrar si ante un producto sin stock se debe llamar al cliente, reemplazarlo o no incluirlo.
-- ============================================================

ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS out_of_stock_preference TEXT DEFAULT 'llamar';
