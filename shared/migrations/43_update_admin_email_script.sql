-- ==============================================================================
-- SCRIPT SQL: ACTUALIZAR EMAIL POR USER_ID (UUID / TEXT)
-- Ejecutar en el SQL Editor de Supabase
-- ==============================================================================

DO $$
DECLARE
    -- 1. COLOCA AQUÍ TU USER_ID Y EL NUEVO EMAIL:
    v_user_id     TEXT := 'PEGA_AQUI_TU_USER_ID'; -- Ex: '123e4567-e89b-12d3-a456-426614174000'
    v_nuevo_email TEXT := 'nuevo_email@ejemplo.com'; -- Ex: 'admin@quimica.com'
BEGIN
    -- 1. Actualizar en auth.users (Supabase Auth - requiere cast a UUID)
    UPDATE auth.users
    SET 
        email = lower(trim(v_nuevo_email)),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb(lower(trim(v_nuevo_email)))),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id::text = trim(v_user_id);

    -- 2. Actualizar en public.profiles (soporta tanto id TEXT como UUID)
    UPDATE public.profiles
    SET 
        email = lower(trim(v_nuevo_email)),
        updated_at = NOW()
    WHERE id::text = trim(v_user_id);

    -- 3. Actualizar en public.customers si existiera registro de cliente
    UPDATE public.customers
    SET 
        email = lower(trim(v_nuevo_email)),
        updated_at = NOW()
    WHERE user_id::text = trim(v_user_id);

    RAISE NOTICE '✅ Email del usuario % actualizado correctamente a %', v_user_id, v_nuevo_email;
END $$;
