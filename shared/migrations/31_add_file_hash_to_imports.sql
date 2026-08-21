-- ============================================================
-- MIGRACIÓN 31: ELIMINACIÓN DE CONSTRAINTS RÍGIDOS, AGREGAR COLUMNA MARCA Y POLÍTICAS RLS EN IMPORTS
-- ============================================================

-- 1. Columna file_hash en imports
ALTER TABLE IF EXISTS imports ADD COLUMN IF NOT EXISTS file_hash TEXT;

-- 2. Columna marca en products
ALTER TABLE IF EXISTS products ADD COLUMN IF NOT EXISTS marca TEXT;

-- 3. Eliminar restricciones rígidamente restrictivas CHECK de estado en imports e import_rows
ALTER TABLE IF EXISTS imports DROP CONSTRAINT IF EXISTS imports_estado_check;
ALTER TABLE IF EXISTS import_rows DROP CONSTRAINT IF EXISTS import_rows_estado_check;

-- 4. Permisos RLS para tabla imports
ALTER TABLE IF EXISTS imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on imports" ON imports;
CREATE POLICY "Allow all access on imports" ON imports FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 5. Permisos RLS para tabla import_rows
ALTER TABLE IF EXISTS import_rows ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on import_rows" ON import_rows;
CREATE POLICY "Allow all access on import_rows" ON import_rows FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 6. Permisos RLS para tablas auxiliares de importación
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on products" ON products;
CREATE POLICY "Allow all access on products" ON products FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE IF EXISTS inventory ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on inventory" ON inventory;
CREATE POLICY "Allow all access on inventory" ON inventory FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE IF EXISTS product_code_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on product_code_history" ON product_code_history;
CREATE POLICY "Allow all access on product_code_history" ON product_code_history FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE IF EXISTS product_prices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on product_prices" ON product_prices;
CREATE POLICY "Allow all access on product_prices" ON product_prices FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE IF EXISTS audit_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on audit_logs" ON audit_logs;
CREATE POLICY "Allow all access on audit_logs" ON audit_logs FOR ALL USING (TRUE) WITH CHECK (TRUE);

ALTER TABLE IF EXISTS inventory_movements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on inventory_movements" ON inventory_movements;
CREATE POLICY "Allow all access on inventory_movements" ON inventory_movements FOR ALL USING (TRUE) WITH CHECK (TRUE);
