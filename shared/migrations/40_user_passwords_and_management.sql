-- ==============================================================================
-- MIGRACIÓN 40: GESTIÓN DE USUARIOS, CONTRASENAS Y FUNCIONES RPC MULTI-PROYECTO
-- Proyecto: Química General Deheza
-- ==============================================================================

-- 0. Garantizar tablas de perfiles y repartidores si no existen en el esquema público
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    email TEXT,
    nombre TEXT NOT NULL,
    rol TEXT DEFAULT 'ventas',
    branch_id INT DEFAULT 1,
    activo BOOLEAN DEFAULT true,
    telefono TEXT,
    auto TEXT,
    patente TEXT,
    foto_url TEXT,
    dni TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    deleted_by TEXT
);

CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY,
    vehiculo_info TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 1. Asegurar extensión pgcrypto para hashing de contraseñas bcrypt
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Función RPC para actualizar contraseña del usuario logueado o mediante admin
CREATE OR REPLACE FUNCTION public.update_user_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verificar que el usuario no envíe una contraseña vacía o muy corta
    IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    -- Actualizar el hash encrypted_password en auth.users usando pgcrypto (bcrypt)
    UPDATE auth.users
    SET 
        encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No se encontró el usuario especificado en auth.users.';
    END IF;

    RETURN TRUE;
END;
$$;

-- 2.1 Función RPC para cambiar el email / usuario del admin o cualquier usuario
CREATE OR REPLACE FUNCTION public.update_user_email(
    target_user_id UUID,
    new_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF new_email IS NULL OR position('@' in new_email) = 0 THEN
        RAISE EXCEPTION 'El email especificado no es válido.';
    END IF;

    -- Actualizar en auth.users
    UPDATE auth.users
    SET 
        email = lower(trim(new_email)),
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Actualizar en public.profiles
    UPDATE public.profiles
    SET 
        email = lower(trim(new_email)),
        updated_at = NOW()
    WHERE id = target_user_id;

    RETURN TRUE;
END;
$$;

-- 3. Función RPC para creación / actualización completa de usuarios en auth.users y public.profiles
CREATE OR REPLACE FUNCTION public.admin_upsert_user(
    p_email TEXT,
    p_password TEXT,
    p_nombre TEXT,
    p_rol TEXT DEFAULT 'ventas',
    p_branch_id INT DEFAULT 1,
    p_telefono TEXT DEFAULT NULL,
    p_dni TEXT DEFAULT NULL,
    p_auto TEXT DEFAULT NULL,
    p_patente TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_encrypted_pw TEXT;
BEGIN
    IF p_email IS NULL OR trim(p_email) = '' THEN
        RAISE EXCEPTION 'El email es obligatorio.';
    END IF;

    -- Verificar si el usuario ya existe en auth.users
    SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = lower(p_email);

    IF v_user_id IS NULL THEN
        -- Crear nuevo usuario en auth.users
        v_user_id := gen_random_uuid();
        
        IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
            v_encrypted_pw := extensions.crypt(p_password, extensions.gen_salt('bf'));
        ELSE
            v_encrypted_pw := extensions.crypt('Quimica2026!', extensions.gen_salt('bf'));
        END IF;

        INSERT INTO auth.users (
            id, instance_id, email, encrypted_password, email_confirmed_at,
            raw_app_meta_data, raw_user_meta_data, created_at, updated_at, role, aud
        ) VALUES (
            v_user_id, '00000000-0000-0000-0000-000000000000', lower(p_email), v_encrypted_pw, NOW(),
            '{"provider":"email","providers":["email"]}',
            jsonb_build_object('nombre', p_nombre, 'rol', p_rol),
            NOW(), NOW(), 'authenticated', 'authenticated'
        );
    ELSE
        -- Si existe y se pasó contraseña nueva, actualizarla
        IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
            UPDATE auth.users
            SET 
                encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
                updated_at = NOW()
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- Upsert en la tabla public.profiles
    INSERT INTO public.profiles (
        id, email, nombre, rol, branch_id, telefono, dni, auto, patente, activo, updated_at
    ) VALUES (
        v_user_id, lower(p_email), p_nombre, p_rol, p_branch_id, p_telefono, p_dni, p_auto, p_patente, true, NOW()
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        nombre = EXCLUDED.nombre,
        rol = EXCLUDED.rol,
        branch_id = EXCLUDED.branch_id,
        telefono = COALESCE(EXCLUDED.telefono, public.profiles.telefono),
        dni = COALESCE(EXCLUDED.dni, public.profiles.dni),
        auto = COALESCE(EXCLUDED.auto, public.profiles.auto),
        patente = COALESCE(EXCLUDED.patente, public.profiles.patente),
        updated_at = NOW();

    -- Sincronización automática de repartidores en public.drivers si aplica
    IF p_rol = 'repartidor' THEN
        INSERT INTO public.drivers (id, vehiculo_info, activo)
        VALUES (
            v_user_id,
            CASE WHEN p_auto IS NOT NULL AND p_auto <> '' THEN p_auto || ' (Patente: ' || COALESCE(p_patente, '') || ')' ELSE 'Vehículo Asignado' END,
            true
        )
        ON CONFLICT (id) DO UPDATE SET
            vehiculo_info = EXCLUDED.vehiculo_info,
            activo = true;
    END IF;

    RETURN v_user_id;
END;
$$;

-- 4. EJEMPLOS DE USO Y CREACIÓN DE USUARIOS INICIALES CON CONTRASENAS
SELECT public.admin_upsert_user('admin@quimicadeheza.com', 'Admin2026!', 'Administrador General', 'admin', 1);
SELECT public.admin_upsert_user('encargado.deheza@quimicadeheza.com', 'Deheza2026!', 'Encargado General Deheza', 'encargado_sucursal', 1);
SELECT public.admin_upsert_user('ventas.deheza@quimicadeheza.com', 'Ventas2026!', 'Juan Pérez (Ventas)', 'ventas', 1);
SELECT public.admin_upsert_user('chofer1@quimicadeheza.com', 'Chofer2026!', 'Carlos Repartidor', 'repartidor', 1, '3584112233', '30111222', 'Toyota Hilux', 'AF 123 CD');
SELECT public.admin_upsert_user('caja@quimicadeheza.com', 'Caja2026!', 'María Tesorería', 'caja', 1);
