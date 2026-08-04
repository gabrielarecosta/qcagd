-- ============================================================
-- MIGRACIÓN BASE: ADICIONES PARA ETAPAS 6 y 7
-- ============================================================

-- 1. CREACIÓN DE LA TABLA DE PROMOCIONES DE PRODUCTOS (ETAPA 6)
CREATE TABLE IF NOT EXISTS product_promotions (
    id TEXT PRIMARY KEY,
    product_id TEXT REFERENCES products(id) ON DELETE CASCADE NOT NULL,
    descuento_porcentaje NUMERIC NOT NULL CHECK (descuento_porcentaje >= 0 AND descuento_porcentaje <= 100),
    cantidad_minima INTEGER DEFAULT 1 NOT NULL CHECK (cantidad_minima >= 1),
    fecha_inicio TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    fecha_fin TIMESTAMP WITH TIME ZONE NOT NULL,
    tipo_cliente TEXT CHECK (tipo_cliente IN ('mayorista', 'minorista', 'todos')) DEFAULT 'todos' NOT NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Indexar por producto y rango de fechas para consultas ultrarrápidas
CREATE INDEX IF NOT EXISTS idx_promotions_lookup 
ON product_promotions (product_id, activo, fecha_inicio, fecha_fin);


-- 2. CREACIÓN DE LA TABLA DE FRANJAS HORARIAS DE ENTREGA (ETAPA 7)
CREATE TABLE IF NOT EXISTS delivery_time_slots (
    id TEXT PRIMARY KEY,
    nombre TEXT NOT NULL,
    hora_inicio TEXT NOT NULL, -- formato "HH:MM"
    hora_fin TEXT NOT NULL,    -- formato "HH:MM"
    max_pedidos INTEGER,       -- capacidad máxima
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed de franjas horarias iniciales
INSERT INTO delivery_time_slots (id, nombre, hora_inicio, hora_fin, max_pedidos, activo)
VALUES 
('slot-morning', 'Mañana', '08:00', '12:00', 15, true),
('slot-midday', 'Mediodía', '12:00', '14:00', 15, true),
('slot-siesta', 'Siesta', '14:00', '16:00', 15, true),
('slot-afternoon', 'Tarde', '16:00', '19:30', 15, true),
('slot-night', 'Tarde Noche', '19:30', '22:00', 15, true)
ON CONFLICT (id) DO UPDATE SET
  nombre = EXCLUDED.nombre,
  hora_inicio = EXCLUDED.hora_inicio,
  hora_fin = EXCLUDED.hora_fin,
  max_pedidos = EXCLUDED.max_pedidos,
  activo = EXCLUDED.activo;


-- 3. AGREGAR COLUMNAS ESTRUCTURADAS A LA TABLA DE PEDIDOS (ORDERS) (ETAPA 7)
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_date TEXT; -- YYYY-MM-DD
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_start_time TEXT; -- HH:MM
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_end_time TEXT; -- HH:MM
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time_slot_id TEXT REFERENCES delivery_time_slots(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_method TEXT CHECK (delivery_method IN ('reparto', 'retiro', 'whatsapp'));


-- 4. AGREGAR COLUMNA DE PLANIFICADOR A HOJAS DE RUTA (DELIVERY_ROUTES) (ETAPA 8)
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS planned_by TEXT;


-- 5. TRIGGER DE VALIDACIÓN DE PRECIOS EN EL SERVIDOR (ETAPA 6)
CREATE OR REPLACE FUNCTION trg_fn_validate_order_item_price()
RETURNS TRIGGER AS $$
DECLARE
    v_tipo_cliente TEXT;
    v_precio_minorista NUMERIC;
    v_precio_mayorista NUMERIC;
    v_precio_base NUMERIC;
    v_fecha_pedido TIMESTAMP WITH TIME ZONE;
    v_promo_pct NUMERIC := 0.0;
    v_expected_price NUMERIC;
BEGIN
    -- A. Obtener el tipo de cliente y fecha del pedido
    SELECT c.tipo_cliente, o.fecha INTO v_tipo_cliente, v_fecha_pedido
    FROM orders o
    JOIN customers c ON c.id = o.cliente_id
    WHERE o.id = NEW.order_id;

    IF NOT FOUND THEN
        v_tipo_cliente := 'minorista';
        v_fecha_pedido := NOW();
    END IF;

    -- B. Obtener precios base del producto
    SELECT precio, COALESCE(precio_mayorista, precio) INTO v_precio_minorista, v_precio_mayorista
    FROM products
    WHERE id = NEW.product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto con ID % no existe.', NEW.product_id;
    END IF;

    -- C. Determinar precio según tipo de cliente
    IF v_tipo_cliente = 'mayorista' THEN
        v_precio_base := v_precio_mayorista;
    ELSE
        v_precio_base := v_precio_minorista;
    END IF;

    -- D. Buscar la mejor promoción aplicable
    SELECT COALESCE(MAX(descuento_porcentaje), 0.0) INTO v_promo_pct
    FROM product_promotions
    WHERE product_id = NEW.product_id
      AND activo = TRUE
      AND fecha_inicio <= v_fecha_pedido
      AND fecha_fin >= v_fecha_pedido
      AND NEW.cantidad >= cantidad_minima
      AND (tipo_cliente = 'todos' OR tipo_cliente = v_tipo_cliente);

    -- E. Calcular precio esperado
    v_expected_price := v_precio_base * ((100.0 - v_promo_pct) / 100.0);
    v_expected_price := ROUND(v_expected_price, 2);

    -- F. Validar contra el precio enviado (tolerancia de 5 centavos por redondeos)
    IF ABS(NEW.precio_unitario - v_expected_price) > 0.05 THEN
        RAISE EXCEPTION 'Discrepancia de precios para producto %: esperado %, recibido %', 
            NEW.product_id, v_expected_price, NEW.precio_unitario;
    END IF;

    -- Normalizar subtotal del item
    NEW.subtotal := NEW.precio_unitario * NEW.cantidad;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear el trigger
DROP TRIGGER IF EXISTS trg_validate_order_item_price ON order_items;
CREATE TRIGGER trg_validate_order_item_price
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_order_item_price();


-- 6. CREACIÓN DE LA TABLA DE CONFIGURACIONES DE LA EMPRESA
CREATE TABLE IF NOT EXISTS company_settings (
    id TEXT PRIMARY KEY DEFAULT 'config_main',
    whatsapp TEXT NOT NULL DEFAULT '5493511234567',
    direccion TEXT NOT NULL DEFAULT 'Bv. San Martín 123, General Deheza',
    telefono TEXT NOT NULL DEFAULT '3584123456',
    instagram TEXT NOT NULL DEFAULT 'quimica_deheza',
    facebook TEXT NOT NULL DEFAULT 'quimicadeheza',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Insertar configuración inicial
INSERT INTO company_settings (id, whatsapp, direccion, telefono, instagram, facebook)
VALUES ('config_main', '5493511234567', 'Bv. San Martín 123, General Deheza', '3584123456', 'quimica_deheza', 'quimicadeheza')
ON CONFLICT (id) DO NOTHING;


-- 7. COLUMNA DE CONTRASEÑA EN PERFILES INTERNOS
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS password TEXT;

-- Seed de contraseñas de ejemplo para usuarios preexistentes
UPDATE profiles 
SET password = 'daniel' 
WHERE email = 'daniel@quimicadeheza.com' AND (password IS NULL OR password = '');


-- 8. COLUMNAS DE DETALLES DEL CHOFER / REPARTIDOR EN PROFILES
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS auto TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS patente TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS foto_url TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dni TEXT;


-- 9. COLUMNAS DE SEGUIMIENTO Y RECEPCIÓN DE PEDIDOS EN ORDERS
ALTER TABLE orders ADD COLUMN IF NOT EXISTS taken_by_id TEXT REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS taken_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMP WITH TIME ZONE;
