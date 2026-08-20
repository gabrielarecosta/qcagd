-- ============================================================
-- MIGRACIÓN 28: ACTUALIZAR TRIGGER DE VALIDACIÓN DE PRECIOS PARA COMBOS Y SÚPER OFERTAS
-- Permite validar correctamente los precios unitarios efectivos de súper ofertas y combos.
-- ============================================================

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

    -- B. Obtener precios base del producto
    SELECT precio, COALESCE(precio_mayorista, precio) INTO v_precio_minorista, v_precio_mayorista
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
            -- Precio unitario proporcional de oferta
            (o.precio_original > 0 AND ABS(ROUND((o.precio_oferta::numeric * v_precio_minorista::numeric) / o.precio_original::numeric, 2) - NEW.precio_unitario) <= 1.00)
            OR
            -- Distribución por unidades del combo
            (ABS(ROUND(o.precio_oferta::numeric / NULLIF((SELECT SUM(cantidad) FROM super_offer_items WHERE offer_id = o.id), 0), 2) - NEW.precio_unitario) <= 1.00)
            OR
            -- Fallback: Precio de oferta menor o igual al precio de lista normal
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
      AND (tipo_cliente = 'todos' OR tipo_cliente = v_tipo_cliente);

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

-- Reasegurar trigger
DROP TRIGGER IF EXISTS trg_validate_order_item_price ON order_items;
CREATE TRIGGER trg_validate_order_item_price
BEFORE INSERT OR UPDATE ON order_items
FOR EACH ROW EXECUTE FUNCTION trg_fn_validate_order_item_price();
