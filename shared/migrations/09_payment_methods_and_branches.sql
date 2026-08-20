-- ============================================================
-- MIGRACIÓN 09: CONFIGURACIÓN DE MEDIOS DE PAGO Y TIPO SUCURSAL
-- Permite habilitar/deshabilitar medios de pago globalmente y por tipo de cliente (Particular, Mayorista, Sucursal).
-- Habilita el tipo de cliente 'sucursal' en la tabla customers.
-- ============================================================

-- 1. Actualizar restricción CHECK en tabla customers para admitir 'sucursal' y 'consumidor_final'
ALTER TABLE customers DROP CONSTRAINT IF EXISTS customers_tipo_cliente_check;
ALTER TABLE customers ADD CONSTRAINT customers_tipo_cliente_check 
  CHECK (tipo_cliente IN ('mayorista', 'minorista', 'sucursal', 'consumidor_final'));

-- 2. Crear tabla de configuración de medios de pago
CREATE TABLE IF NOT EXISTS payment_method_settings (
    id TEXT PRIMARY KEY, -- 'efectivo', 'mercadopago', 'transferencia', 'pago_a_acordar', 'cuenta_corriente'
    nombre TEXT NOT NULL,
    descripcion TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    disponible_minorista BOOLEAN DEFAULT TRUE NOT NULL,  -- Clientes particulares / consumidor final
    disponible_mayorista BOOLEAN DEFAULT TRUE NOT NULL,  -- Clientes mayoristas
    disponible_sucursal BOOLEAN DEFAULT TRUE NOT NULL,   -- Sucursales
    orden INT DEFAULT 0 NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 3. Habilitar RLS con acceso total
ALTER TABLE payment_method_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total payment_method_settings" ON payment_method_settings;
CREATE POLICY "Acceso total payment_method_settings"
  ON payment_method_settings
  FOR ALL
  USING (TRUE)
  WITH CHECK (TRUE);

-- 4. Semillas de medios de pago iniciales
INSERT INTO payment_method_settings (id, nombre, descripcion, activo, disponible_minorista, disponible_mayorista, disponible_sucursal, orden)
VALUES 
  ('efectivo', 'Contra entrega / Efectivo', 'Abonás en efectivo cuando recibís tu pedido', TRUE, TRUE, TRUE, TRUE, 1),
  ('mercadopago', 'Mercado Pago (Tarjeta o dinero en cuenta)', 'Dinero en cuenta, débito o crédito', TRUE, TRUE, TRUE, TRUE, 2),
  ('transferencia', 'Transferencia Bancaria', 'Mostrar datos bancarios al confirmar', TRUE, TRUE, TRUE, TRUE, 3),
  ('pago_a_acordar', 'Pago a acordar', 'Coordinar condiciones de pago con el vendedor / administración', TRUE, TRUE, TRUE, TRUE, 4),
  ('cuenta_corriente', 'Cuenta Corriente', 'Facturación diferida a cuenta corriente', TRUE, FALSE, TRUE, TRUE, 5)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  descripcion = EXCLUDED.descripcion,
  orden = EXCLUDED.orden;
