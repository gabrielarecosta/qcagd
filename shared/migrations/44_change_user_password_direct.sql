-- ==============================================================================
-- SCRIPT SQL: CAMBIO DIRECTO DE CONTRASEÑA DE CUALQUIER USUARIO EN SUPABASE
-- Ejecutar en el SQL Editor de Supabase (sin necesidad de email de recuperación)
-- ==============================================================================

-- 1. Asegurar extensión pgcrypto para hashing bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

DO $$
DECLARE
    -- 2. REEMPLAZA AQUÍ EL USER_ID Y LA NUEVA CONTRASEÑA:
    v_user_id     TEXT := 'PEGA_AQUI_TU_USER_ID';  -- Ex: '123e4567-e89b-12d3-a456-426614174000'
    v_nueva_clave TEXT := 'TuNuevaContraseña123';  -- Mínimo 6 caracteres
BEGIN
    IF v_nueva_clave IS NULL OR length(trim(v_nueva_clave)) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    -- 3. Actualizar el hash de contraseña directamente en auth.users
    UPDATE auth.users
    SET 
        encrypted_password = extensions.crypt(trim(v_nueva_clave), extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id::text = trim(v_user_id);

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró ningún usuario en auth.users con el ID "%"', v_user_id;
    END IF;

    RAISE NOTICE '✅ Contraseña del usuario % actualizada exitosamente.', v_user_id;
END $$;
