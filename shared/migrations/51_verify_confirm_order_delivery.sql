-- ==============================================================================
-- SCRIPT DE VERIFICACIÓN: MIGRACIÓN 51
-- Tarea: QCA1 — Agregar o corregir el botón Entregado en el monitor de pedidos
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

DO $$
DECLARE
    v_func_exists BOOLEAN;
    v_test_order_id BIGINT;
    v_result JSONB;
    v_check_status TEXT;
    v_check_delivered_at TIMESTAMPTZ;
    v_check_payment TEXT;
    v_exception_caught BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '>>> INICIANDO VERIFICACIÓN DE MIGRACIÓN 51...';

    -- 1. Verificar existencia de la función RPC confirm_order_delivery
    SELECT EXISTS (
        SELECT 1 FROM pg_proc p
        JOIN pg_namespace n ON p.pronamespace = n.oid
        WHERE n.nspname = 'public' AND p.proname = 'confirm_order_delivery'
    ) INTO v_func_exists;

    IF NOT v_func_exists THEN
        RAISE EXCEPTION '❌ FALLO: La función public.confirm_order_delivery no existe en la base de datos.';
    ELSE
        RAISE NOTICE '✅ 1. Función public.confirm_order_delivery encontrada en el esquema public.';
    END IF;

    -- 2. Verificar índices en tabla orders
    IF NOT EXISTS (SELECT 1 FROM pg_indexes WHERE schemaname = 'public' AND tablename = 'orders' AND indexname = 'idx_orders_estado') THEN
        RAISE WARNING '⚠️ El índice idx_orders_estado no fue encontrado.';
    ELSE
        RAISE NOTICE '✅ 2. Índice idx_orders_estado verificado.';
    END IF;

    -- 3. Prueba transaccional de entrega con cuenta corriente (NO debe pagarse automáticamente)
    INSERT INTO public.orders (
        numero, branch_id, total, estado, payment_method, payment_status, observaciones
    ) VALUES (
        'TEST-VERIFY-CC-' || floor(random() * 100000)::text,
        1,
        1500.00,
        'en_reparto',
        'cuenta_corriente',
        'cuenta_corriente',
        'Orden de prueba para verificación'
    ) RETURNING id INTO v_test_order_id;

    -- Ejecutar entrega
    v_result := public.confirm_order_delivery(v_test_order_id, 'Recibido conforme en recepción', 'test@quimicadeheza.com');

    -- Comprobar estado actualizado
    SELECT estado, delivered_at, payment_status 
    INTO v_check_status, v_check_delivered_at, v_check_payment
    FROM public.orders 
    WHERE id = v_test_order_id;

    IF v_check_status <> 'entregado' THEN
        RAISE EXCEPTION '❌ FALLO: El estado no se actualizó a entregado. Estado actual: %', v_check_status;
    END IF;

    IF v_check_delivered_at IS NULL THEN
        RAISE EXCEPTION '❌ FALLO: delivered_at no fue completado con el timestamp del servidor.';
    END IF;

    -- Verificar que NO se marcó como pagado un pedido de cuenta corriente
    IF v_check_payment <> 'cuenta_corriente' THEN
        RAISE EXCEPTION '❌ FALLO: Se alteró indebidamente el payment_status de cuenta_corriente a %', v_check_payment;
    ELSE
        RAISE NOTICE '✅ 3. Entrega exitosa. Estado="entregado", delivered_at asignado y cuenta_corriente preservada.';
    END IF;

    -- 4. Prueba de idempotencia: re-ejecución sobre pedido ya entregado
    v_result := public.confirm_order_delivery(v_test_order_id, 'Segundo intento', 'test@quimicadeheza.com');
    IF (v_result->>'already_delivered')::boolean IS NOT TRUE THEN
        RAISE EXCEPTION '❌ FALLO: La función no detectó que el pedido ya estaba entregado.';
    ELSE
        RAISE NOTICE '✅ 4. Idempotencia verificada: detecta pedido ya entregado sin duplicar efectos.';
    END IF;

    -- 5. Prueba de rechazo sobre pedido cancelado
    UPDATE public.orders SET estado = 'cancelado' WHERE id = v_test_order_id;
    BEGIN
        v_result := public.confirm_order_delivery(v_test_order_id, 'Intento sobre cancelado', 'test@quimicadeheza.com');
    EXCEPTION WHEN OTHERS THEN
        v_exception_caught := TRUE;
        RAISE NOTICE '✅ 5. Validación de transición correcta: rechaza marcar como entregado un pedido cancelado (%)', SQLERRM;
    END;

    IF NOT v_exception_caught THEN
        RAISE EXCEPTION '❌ FALLO: No se bloqueó la entrega de un pedido cancelado.';
    END IF;

    -- Limpiar orden de prueba
    DELETE FROM public.orders WHERE id = v_test_order_id;

    RAISE NOTICE '🎉 VERIFICACIÓN COMPLETA: Todos los controles de la Migración 51 pasaron exitosamente.';
END $$;
