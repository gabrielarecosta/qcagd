-- ============================================================
-- MIGRACIÓN 13: SOLICITUDES DE REEMBOLSO / BOTÓN DE ARREPENTIMIENTO
-- Conforme a la Ley 24.240 de Defensa del Consumidor (Art. 34) y Res. 424/2020
-- ============================================================

CREATE TABLE IF NOT EXISTS refund_requests (
  id TEXT PRIMARY KEY DEFAULT ('ref-' || floor(extract(epoch from now())) || '-' || substr(md5(random()::text), 1, 6)),
  order_numero TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  customer_email TEXT DEFAULT '',
  customer_phone TEXT NOT NULL,
  motivo TEXT NOT NULL,
  detalle TEXT DEFAULT '',
  cbu_reintegro TEXT DEFAULT '',
  alias_reintegro TEXT DEFAULT '',
  estado TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_revision', 'aprobado', 'rechazado', 'reembolsado'
  resolucion_notas TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE refund_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total refund_requests" ON refund_requests;
CREATE POLICY "Acceso total refund_requests"
  ON refund_requests
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

CREATE INDEX IF NOT EXISTS idx_refund_requests_order ON refund_requests (order_numero);
CREATE INDEX IF NOT EXISTS idx_refund_requests_estado ON refund_requests (estado);
