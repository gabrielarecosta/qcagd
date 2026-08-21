-- ============================================================
-- MIGRACIÓN 29: PERMISOS Y POLÍTICAS RLS PARA IMPORTACIÓN EXCEL
-- Habilita permisos de lectura/escritura en todas las tablas auxiliares e historiales de importación
-- ============================================================

-- 1. Tabla product_code_history
ALTER TABLE IF EXISTS product_code_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow read/write access to authenticated users on code history" ON product_code_history;
DROP POLICY IF EXISTS "Allow all access on product_code_history" ON product_code_history;
CREATE POLICY "Allow all access on product_code_history" ON product_code_history FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 2. Tabla product_prices
ALTER TABLE IF EXISTS product_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on product_prices" ON product_prices;
CREATE POLICY "Allow all access on product_prices" ON product_prices FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 3. Tabla audit_logs
ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on audit_logs" ON audit_logs;
CREATE POLICY "Allow all access on audit_logs" ON audit_logs FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 4. Tabla inventory_movements / stock_movements
ALTER TABLE IF EXISTS inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on inventory_movements" ON inventory_movements;
CREATE POLICY "Allow all access on inventory_movements" ON inventory_movements FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 5. Tablas imports e import_rows
ALTER TABLE IF EXISTS imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on imports" ON imports;
CREATE POLICY "Allow all access on imports" ON imports FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE IF EXISTS import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on import_rows" ON import_rows;
CREATE POLICY "Allow all access on import_rows" ON import_rows FOR ALL USING (TRUE) WITH CHECK (TRUE);
