-- ==============================================================================
-- MIGRACIÓN 49: VISIBILIDAD DE CONTRASEÑAS PARA ADMIN Y GESTIÓN DE CARRITOS
-- Proyecto: Química General Deheza
-- ==============================================================================

-- 1. Agregar columna password_plain en public.profiles para usuarios internos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'password_plain'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN password_plain TEXT;
  END IF;
END $$;

-- 2. Agregar columna password_plain en public.customers para clientes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'password_plain'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN password_plain TEXT;
  END IF;
END $$;

-- 3. Actualizar función RPC admin_upsert_user para guardar password_plain
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
        -- Si existe y se pasó contraseña nueva, actualizarla en auth.users
        IF p_password IS NOT NULL AND length(trim(p_password)) >= 6 THEN
            UPDATE auth.users
            SET 
                encrypted_password = extensions.crypt(p_password, extensions.gen_salt('bf')),
                updated_at = NOW()
            WHERE id = v_user_id;
        END IF;
    END IF;

    -- Upsert en la tabla public.profiles guardando también password_plain
    INSERT INTO public.profiles (
        id, email, nombre, rol, branch_id, telefono, dni, auto, patente, activo, password_plain, updated_at
    ) VALUES (
        v_user_id, lower(p_email), p_nombre, p_rol, p_branch_id, p_telefono, p_dni, p_auto, p_patente, true, p_password, NOW()
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
        password_plain = COALESCE(EXCLUDED.password_plain, public.profiles.password_plain),
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

-- 4. Actualizar función RPC update_user_password para reflejar password_plain
CREATE OR REPLACE FUNCTION public.update_user_password(
    target_user_id UUID,
    new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    -- Actualizar hash en auth.users
    UPDATE auth.users
    SET 
        encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Actualizar en public.profiles
    UPDATE public.profiles
    SET 
        password_plain = new_password,
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Actualizar en public.customers si está vinculado por user_id o id
    UPDATE public.customers
    SET 
        password_plain = new_password
    WHERE user_id = target_user_id::text OR id::text = target_user_id::text;

    RETURN TRUE;
END;
$$;

-- 5. Función RPC para actualizar contraseña de un cliente por id o user_id
CREATE OR REPLACE FUNCTION public.admin_set_customer_password(
    target_customer_id TEXT,
    new_password TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
    v_target_text TEXT := trim(target_customer_id);
BEGIN
    IF new_password IS NULL OR length(trim(new_password)) < 6 THEN
        RAISE EXCEPTION 'La contraseña debe tener al menos 6 caracteres.';
    END IF;

    -- Actualizar en public.customers
    UPDATE public.customers
    SET 
        password_plain = new_password
    WHERE id::text = v_target_text OR user_id = v_target_text;

    -- Intentar obtener el user_id para actualizar auth.users si existe
    BEGIN
        SELECT user_id::uuid INTO v_user_id 
        FROM public.customers 
        WHERE (id::text = v_target_text OR user_id = v_target_text) 
          AND user_id IS NOT NULL;
    EXCEPTION WHEN OTHERS THEN
        v_user_id := NULL;
    END;

    IF v_user_id IS NOT NULL THEN
        UPDATE auth.users
        SET 
            encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
            updated_at = NOW()
        WHERE id = v_user_id;
    END IF;

    RETURN TRUE;
END;
$$;

-- 6. Semilla de contraseñas conocidas en profiles para usuarios iniciales
UPDATE public.profiles SET password_plain = 'Admin2026!' WHERE lower(email) = 'admin@quimicadeheza.com' AND (password_plain IS NULL OR password_plain = '');
UPDATE public.profiles SET password_plain = 'Deheza2026!' WHERE lower(email) = 'encargado.deheza@quimicadeheza.com' AND (password_plain IS NULL OR password_plain = '');
UPDATE public.profiles SET password_plain = 'Ventas2026!' WHERE lower(email) = 'ventas.deheza@quimicadeheza.com' AND (password_plain IS NULL OR password_plain = '');
UPDATE public.profiles SET password_plain = 'Chofer2026!' WHERE lower(email) = 'chofer1@quimicadeheza.com' AND (password_plain IS NULL OR password_plain = '');
UPDATE public.profiles SET password_plain = 'Caja2026!' WHERE lower(email) = 'caja@quimicadeheza.com' AND (password_plain IS NULL OR password_plain = '');
