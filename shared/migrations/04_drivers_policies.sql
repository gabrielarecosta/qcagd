-- ============================================================
-- MIGRACIÓN: POLÍTICAS DE SEGURIDAD RLS PARA LA TABLA DRIVERS
-- ============================================================

-- Habilitar RLS en drivers
ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

-- Crear política de acceso total para que las operaciones del admin y choferes funcionen
DROP POLICY IF EXISTS "Acceso total para drivers" ON drivers;
CREATE POLICY "Acceso total para drivers" ON drivers FOR ALL USING (TRUE) WITH CHECK (TRUE);
