-- ==============================================================================
-- MIGRACIÓN 51: RPC ATÓMICO Y VALIDADO PARA CONFIRMAR ENTREGA DE PEDIDOS
-- Tarea: QCA1 — Agregar o corregir el botón Entregado en el monitor de pedidos
-- Proyecto: Química General Deheza
-- ==============================================================================

-- 1. Asegurar índice en orders por estado para optimizar filtros y concurrencia
CREATE INDEX IF NOT EXISTS idx_orders_estado ON public.orders(estado);
CREATE INDEX IF NOT EXISTS idx_orders_delivered_at ON public.orders(delivered_at);

-- 2. Función RPC para confirmar entrega con bloqueo de concurrencia y validación de reglas de negocio
CREATE OR REPLACE FUNCTION public.confirm_order_delivery(
    p_order_id BIGINT,
    p_notes TEXT DEFAULT NULL,
    p_user_email TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
    v_order RECORD;
    v_new_payment_status TEXT;
    v_caller_email TEXT;
    v_caller_role TEXT;
    v_auth_uid UUID;
    v_now TIMESTAMPTZ := NOW();
BEGIN
    -- 1. Control de autorización del usuario
    v_auth_uid := auth.uid();
    
    -- Si la petición viene con token JWT autenticado
    IF v_auth_uid IS NOT NULL THEN
        SELECT email, rol INTO v_caller_email, v_caller_role
        FROM public.profiles
        WHERE id = v_auth_uid;
        
        -- Rechazar si tiene rol 'solo_lectura'
        IF v_caller_role = 'solo_lectura' THEN
            RAISE EXCEPTION 'Acceso denegado: El rol "solo_lectura" no tiene permisos para confirmar entregas.';
        END IF;
    END IF;

    -- Si no hay JWT disponible o se envió email de auditoría explícito
    IF v_caller_email IS NULL THEN
        v_caller_email := COALESCE(p_user_email, current_setting('app.current_user_email', true), 'admin@quimicadeheza.com');
    END IF;

    -- 2. Concurrencia: Bloquear la fila del pedido con FOR UPDATE para evitar condiciones de carrera
    SELECT id, numero, estado, payment_method, payment_status, total, observaciones
    INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'El pedido con ID % no existe.', p_order_id;
    END IF;

    -- 3. Idempotencia: Si ya está entregado, devolver éxito coherente sin duplicar efectos
    IF v_order.estado = 'entregado' THEN
        RETURN jsonb_build_object(
            'success', true,
            'already_delivered', true,
            'message', 'El pedido ya se encontraba marcado como entregado.',
            'order_id', p_order_id,
            'numero', v_order.numero,
            'estado', 'entregado',
            'payment_status', v_order.payment_status
        );
    END IF;

    -- 4. Rechazar pedidos cancelados
    IF v_order.estado = 'cancelado' THEN
        RAISE EXCEPTION 'Transición inválida: No se puede marcar como entregado un pedido cancelado.';
    END IF;

    -- 5. Validar estados de origen permitidos
    IF v_order.estado NOT IN ('recibido', 'en_preparacion', 'listo_para_reparto', 'asignado', 'en_reparto') THEN
        RAISE EXCEPTION 'Transición inválida: No se puede entregar un pedido en estado "%".', v_order.estado;
    END IF;

    -- 6. Reglas de negocio sobre cobros y cuenta corriente:
    -- - 'cuenta_corriente' NUNCA se marca como 'pagado' (el cliente aún debe el saldo).
    -- - 'transferencia' pendiente permanece pendiente hasta confirmación bancaria.
    -- - 'efectivo' se cobra en mano y pasa a 'pagado'.
    -- - Si ya estaba 'pagado' o 'aprobado', se preserva.
    IF v_order.payment_method = 'cuenta_corriente' THEN
        v_new_payment_status := 'cuenta_corriente';
    ELSIF v_order.payment_method = 'transferencia' AND v_order.payment_status IN ('transferencia_pendiente', 'pendiente') THEN
        v_new_payment_status := 'transferencia_pendiente';
    ELSIF v_order.payment_status = 'pagado' OR v_order.payment_status = 'aprobado' THEN
        v_new_payment_status := v_order.payment_status;
    ELSE
        -- Efectivo u otros cobros al entregar
        v_new_payment_status := 'pagado';
    END IF;

    -- 7. Registrar identidad para el trigger de auditoría de historial
    PERFORM set_config('app.current_user_email', v_caller_email, true);

    -- 8. Actualizar el pedido en orders de forma atómica
    UPDATE public.orders
    SET 
        estado = 'entregado',
        payment_status = v_new_payment_status,
        delivered_at = v_now,
        observaciones = CASE 
            WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' 
            THEN COALESCE(observaciones || ' | ', '') || trim(p_notes)
            ELSE observaciones 
        END,
        updated_at = v_now
    WHERE id = p_order_id;

    -- 9. Sincronizar paradas activas asociadas al pedido si estuviera en una hoja de ruta
    UPDATE public.delivery_route_stops
    SET 
        status = 'entregado',
        delivered_at = v_now,
        notes = CASE 
            WHEN p_notes IS NOT NULL AND trim(p_notes) <> '' 
            THEN COALESCE(notes || ' | ', '') || trim(p_notes)
            ELSE notes 
        END
    WHERE order_id = p_order_id::text 
       OR order_id = v_order.numero;

    -- 10. Devolver respuesta estructurada
    RETURN jsonb_build_object(
        'success', true,
        'already_delivered', false,
        'message', 'Pedido entregado exitosamente.',
        'order_id', p_order_id,
        'numero', v_order.numero,
        'estado', 'entregado',
        'delivered_at', v_now,
        'payment_status', v_new_payment_status
    );
END;
$$;

-- Permisos de ejecución
GRANT EXECUTE ON FUNCTION public.confirm_order_delivery(BIGINT, TEXT, TEXT) TO anon, authenticated, service_role;
