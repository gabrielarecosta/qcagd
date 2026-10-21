-- ==============================================================================
-- MIGRACIÓN 60: AGREGAR PRECIO SOCIOS (LISTA 4) Y SOPORTE DE ROL SOCIOS
-- Química General Deheza - Listas de Precios Diferenciadas
-- Lista 1: Columna F (Minoristas / Público General) -> precio
-- Lista 3: Columna I (Mayoristas chicos) -> precio_mayorista
-- Lista 4: Columna J (Socios) -> precio_socios
-- ==============================================================================

-- 1. Agregar columna precio_socios en tabla products
ALTER TABLE products 
    ADD COLUMN IF NOT EXISTS precio_socios NUMERIC;

-- 2. Actualizar restricción de tipo_cliente en customers para incluir 'socio' y 'socios'
ALTER TABLE customers 
    DROP CONSTRAINT IF EXISTS customers_tipo_cliente_check;

ALTER TABLE customers 
    ADD CONSTRAINT customers_tipo_cliente_check 
    CHECK (tipo_cliente IN ('minorista', 'mayorista', 'socio', 'socios', 'sucursal', 'consumidor_final'));

-- 3. Actualizar restricción en product_promotions si la tabla existe
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' AND table_name = 'product_promotions'
    ) THEN
        ALTER TABLE product_promotions DROP CONSTRAINT IF EXISTS product_promotions_tipo_cliente_check;
        ALTER TABLE product_promotions ADD CONSTRAINT product_promotions_tipo_cliente_check 
            CHECK (tipo_cliente IN ('mayorista', 'minorista', 'socio', 'socios', 'todos'));
    END IF;
END $$;

-- 4. Actualizar trigger de validación de precios de pedidos (trg_fn_validate_order_item_price)
CREATE OR REPLACE FUNCTION trg_fn_validate_order_item_price()
RETURNS TRIGGER AS $$
DECLARE
    v_tipo_cliente TEXT;
    v_precio_minorista NUMERIC;
    v_precio_mayorista NUMERIC;
    v_precio_socios NUMERIC;
    v_precio_base NUMERIC;
    v_fecha_pedido TIMESTAMP WITH TIME ZONE;
    v_promo_pct NUMERIC := 0.0;
    v_expected_price NUMERIC;
    v_is_combo BOOLEAN := FALSE;
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

    -- B. Obtener precios base del producto (Lista 1, Lista 3, Lista 4)
    SELECT 
        precio, 
        COALESCE(precio_mayorista, precio),
        COALESCE(precio_socios, precio)
    INTO v_precio_minorista, v_precio_mayorista, v_precio_socios
    FROM products
    WHERE id = NEW.product_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Producto con ID % no existe.', NEW.product_id;
    END IF;

    -- C. Verificar si el producto pertenece a una súper oferta/combo activo
    SELECT COALESCE(
      (
        SELECT TRUE 
        FROM super_offers o
        JOIN super_offer_items oi ON oi.offer_id = o.id
        WHERE o.activo = TRUE 
          AND oi.product_id = NEW.product_id
          AND (
            (o.precio_original > 0 AND ABS(ROUND((o.precio_oferta::numeric * v_precio_minorista::numeric) / o.precio_original::numeric, 2) - NEW.precio_unitario) <= 1.00)
            OR
            (ABS(ROUND(o.precio_oferta::numeric / NULLIF((SELECT SUM(cantidad) FROM super_offer_items WHERE offer_id = o.id), 0), 2) - NEW.precio_unitario) <= 1.00)
            OR
            (NEW.precio_unitario <= v_precio_minorista AND NEW.precio_unitario > 0)
          )
        LIMIT 1
      ), FALSE
    ) INTO v_is_combo;

    IF v_is_combo THEN
        -- Aceptar el precio unitario del combo
        NEW.subtotal := NEW.precio_unitario * NEW.cantidad;
        RETURN NEW;
    END IF;

    -- D. Determinar precio según tipo de cliente
    IF v_tipo_cliente = 'mayorista' THEN
        v_precio_base := v_precio_mayorista;
    ELSIF v_tipo_cliente IN ('socio', 'socios') THEN
        v_precio_base := v_precio_socios;
    ELSE
        v_precio_base := v_precio_minorista;
    END IF;

    -- E. Buscar la mejor promoción aplicable
    SELECT COALESCE(MAX(descuento_porcentaje), 0.0) INTO v_promo_pct
    FROM product_promotions
    WHERE product_id = NEW.product_id
      AND activo = TRUE
      AND fecha_inicio <= v_fecha_pedido
      AND fecha_fin >= v_fecha_pedido
      AND NEW.cantidad >= cantidad_minima
      AND (
          tipo_cliente = 'todos' 
          OR tipo_cliente = v_tipo_cliente 
          OR (v_tipo_cliente IN ('socio', 'socios') AND tipo_cliente IN ('socio', 'socios'))
      );

    -- F. Calcular precio esperado
    v_expected_price := v_precio_base * ((100.0 - v_promo_pct) / 100.0);
    v_expected_price := ROUND(v_expected_price, 2);

    -- G. Validar contra el precio enviado (tolerancia de 5 centavos por redondeos)
    IF ABS(NEW.precio_unitario - v_expected_price) > 0.05 THEN
        RAISE EXCEPTION 'Discrepancia de precios para producto %: esperado %, recibido %', 
            NEW.product_id, v_expected_price, NEW.precio_unitario;
    END IF;

    -- Normalizar subtotal del item
    NEW.subtotal := NEW.precio_unitario * NEW.cantidad;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
