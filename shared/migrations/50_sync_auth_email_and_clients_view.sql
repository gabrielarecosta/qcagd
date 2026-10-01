-- ==============================================================================
-- MIGRACIÓN 50: VINCULACIÓN DIRECTA DE EMAIL DE AUTH.USERS CON CLIENTES
-- Proyecto: Química General Deheza
-- ==============================================================================

-- 1. Agregar columna auth_email en public.customers si no existe
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'customers' AND column_name = 'auth_email'
  ) THEN
    ALTER TABLE public.customers ADD COLUMN auth_email TEXT;
  END IF;
END $$;

-- 2. Sincronizar columna auth_email en customers con el email real de auth.users
UPDATE public.customers c
SET auth_email = lower(trim(u.email))
FROM auth.users u
WHERE c.user_id IS NOT NULL 
  AND c.user_id::text = u.id::text;

-- 3. Crear función RPC SECURITY DEFINER para obtener el mapeo de user_id a email de auth.users
-- Permite que el Panel Admin consulte de forma segura el email de registro oficial
CREATE OR REPLACE FUNCTION public.get_auth_users_map()
RETURNS TABLE (
    user_id TEXT,
    email TEXT
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT id::text AS user_id, lower(trim(email))::text AS email
    FROM auth.users;
$$;

-- Otorgar permisos de ejecución a los roles de Supabase
GRANT EXECUTE ON FUNCTION public.get_auth_users_map() TO anon, authenticated, service_role;

-- 4. Actualizar trigger handle_new_auth_user para guardar auth_email automáticamente
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
DECLARE
  v_rol TEXT;
  v_nombre TEXT;
  v_telefono TEXT;
BEGIN
  v_rol := COALESCE(NEW.raw_user_meta_data->>'rol', 'cliente');
  v_nombre := COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1));
  v_telefono := COALESCE(NEW.raw_user_meta_data->>'telefono', '');

  IF v_rol = 'cliente' THEN
    -- Si es un cliente, crear/actualizar en public.customers
    INSERT INTO public.customers (user_id, email, auth_email, nombre, telefono, direccion, branch_id, tipo_cliente, activo)
    VALUES (
      NEW.id,
      NEW.email,
      lower(trim(NEW.email)),
      v_nombre,
      v_telefono,
      'General Deheza',
      1,
      COALESCE(NEW.raw_user_meta_data->>'tipo_cliente', 'minorista'),
      TRUE
    )
    ON CONFLICT (email) DO UPDATE SET
      user_id = EXCLUDED.user_id,
      auth_email = EXCLUDED.auth_email,
      nombre = EXCLUDED.nombre;
  ELSE
    -- Si es un usuario interno del panel (admin, ventas, deposito, repartidor, etc.)
    INSERT INTO public.profiles (id, email, nombre, rol, branch_id, activo)
    VALUES (
      NEW.id,
      lower(trim(NEW.email)),
      v_nombre,
      v_rol,
      1,
      TRUE
    )
    ON CONFLICT (id) DO UPDATE SET
      email = EXCLUDED.email,
      nombre = EXCLUDED.nombre,
      rol = EXCLUDED.rol;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error en trigger handle_new_auth_user: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Actualizar función RPC update_user_email para sincronizar auth.users, profiles y customers
CREATE OR REPLACE FUNCTION public.update_user_email(
    target_user_id UUID,
    new_email TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF new_email IS NULL OR length(trim(new_email)) < 3 THEN
        RAISE EXCEPTION 'El nuevo correo no es válido.';
    END IF;

    -- Actualizar en auth.users
    UPDATE auth.users
    SET 
        email = lower(trim(new_email)),
        raw_user_meta_data = jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{email}', to_jsonb(lower(trim(new_email)))),
        email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Actualizar en public.profiles
    UPDATE public.profiles
    SET 
        email = lower(trim(new_email)),
        updated_at = NOW()
    WHERE id = target_user_id;

    -- Actualizar en public.customers
    UPDATE public.customers
    SET 
        email = lower(trim(new_email)),
        auth_email = lower(trim(new_email)),
        updated_at = NOW()
    WHERE user_id::text = target_user_id::text OR id::text = target_user_id::text;

    RETURN TRUE;
END;
$$;
