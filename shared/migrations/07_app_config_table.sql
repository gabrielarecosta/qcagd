-- ============================================================
-- MIGRACIÓN 07: TABLA DE CONFIGURACIONES DE LA APP (SIN TRIGGER)
-- Alternativa a system_settings para evitar el trigger roto.
-- ============================================================

-- Crear tabla app_config sin trigger de auditoría
CREATE TABLE IF NOT EXISTS app_config (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_by TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed: valor por defecto del monto mínimo de compra
INSERT INTO app_config (key, value, updated_by)
VALUES ('global_order_min_amount', '{"amount": 0}', 'sistema')
ON CONFLICT (key) DO NOTHING;

-- Habilitar RLS con acceso total (lectura pública + escritura admin con anon key)
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total app_config" ON app_config;
CREATE POLICY "Acceso total app_config"
  ON app_config
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);
