-- ============================================================
-- MIGRACIÓN 12: DATOS BANCARIOS Y CONFIGURACIÓN DE TRANSFERENCIAS
-- Permite al admin configurar CBU, Alias, Titular, Banco, Tipo de Cuenta, WhatsApp de Transferencias e Instrucciones
-- ============================================================

CREATE TABLE IF NOT EXISTS company_settings (
  id TEXT PRIMARY KEY DEFAULT 'config_main',
  whatsapp TEXT DEFAULT '',
  whatsapp_transferencias TEXT DEFAULT '',
  direccion TEXT DEFAULT '',
  telefono TEXT DEFAULT '',
  instagram TEXT DEFAULT '',
  facebook TEXT DEFAULT '',
  banco TEXT DEFAULT '',
  cbu TEXT DEFAULT '',
  alias_cbu TEXT DEFAULT '',
  cuit TEXT DEFAULT '',
  titular TEXT DEFAULT '',
  tipo_cuenta TEXT DEFAULT 'Cuenta Corriente',
  instrucciones_transferencia TEXT DEFAULT 'Enviar comprobante por WhatsApp con el número de pedido para agilizar el despacho.',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Asegurar columnas si la tabla ya existía
ALTER TABLE company_settings
  ADD COLUMN IF NOT EXISTS whatsapp_transferencias TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS banco TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cbu TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS alias_cbu TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS cuit TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS titular TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS tipo_cuenta TEXT DEFAULT 'Cuenta Corriente',
  ADD COLUMN IF NOT EXISTS instrucciones_transferencia TEXT DEFAULT 'Enviar comprobante por WhatsApp con el número de pedido para agilizar el despacho.';

-- Habilitar RLS con acceso total
ALTER TABLE company_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total company_settings" ON company_settings;
CREATE POLICY "Acceso total company_settings"
  ON company_settings
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- Semilla inicial
INSERT INTO company_settings (id, whatsapp, whatsapp_transferencias, banco, titular, cuit, cbu, alias_cbu, tipo_cuenta, instrucciones_transferencia)
VALUES (
  'config_main',
  '5493511234567',
  '5493511234567',
  'Banco Galicia',
  'Química General Deheza',
  '30-71234567-8',
  '0070123420000012345678',
  'QUIMICA.DEHEZA',
  'Cuenta Corriente en Pesos',
  'Enviar comprobante por WhatsApp indicando el número de pedido.'
)
ON CONFLICT (id) DO NOTHING;
