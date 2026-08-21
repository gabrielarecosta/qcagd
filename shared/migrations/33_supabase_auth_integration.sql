-- ==============================================================================
-- MIGRACIÓN 33: INTEGRACIÓN CON SUPABASE AUTH (auth.users + public.profiles)
-- Permite que Supabase administre los usuarios y la autenticación nativa
-- ==============================================================================

-- 1. Habilitar extensión pgcrypto para encriptación de contraseñas en Supabase Auth
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- 2. Asegurar estructura de la tabla profiles vinculada a auth.users (UUID de Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY,
    nombre TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    rol TEXT NOT NULL DEFAULT 'ventas' CHECK (rol IN ('admin', 'encargado_sucursal', 'ventas', 'deposito', 'repartidor', 'caja', 'solo_lectura')),
    branch_id BIGINT REFERENCES branches(id) ON DELETE SET NULL,
    sector_id BIGINT REFERENCES sectors(id) ON DELETE SET NULL,
    activo BOOLEAN DEFAULT TRUE NOT NULL,
    telefono TEXT,
    password TEXT,
    auto TEXT,
    patente TEXT,
    foto_url TEXT,
    dni TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    deleted_at TIMESTAMP WITH TIME ZONE,
    deleted_by TEXT
);

-- 3. Asegurar estructura de la tabla drivers (Choferes vinculados a profiles por UUID)
CREATE TABLE IF NOT EXISTS public.drivers (
    id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    vehiculo_info TEXT,
    activo BOOLEAN DEFAULT TRUE NOT NULL
);

-- 4. Función y Trigger Automático para sincronizar usuarios de Supabase Auth a public.profiles
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, nombre, rol, branch_id, activo)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'nombre', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'rol', 'admin'),
    1,
    TRUE
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    nombre = EXCLUDED.nombre;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();

-- 5. CREACIÓN DE USUARIOS EN SUPABASE AUTH (auth.users)
-- Contraseñas configuradas: admin123, ventas123, deposito123, repartidor123

DO $$
DECLARE
  admin_id UUID := '00000000-0000-0000-0000-000000000001';
  ventas_id UUID := '00000000-0000-0000-0000-000000000002';
  deposito_id UUID := '00000000-0000-0000-0000-000000000003';
  repartidor_id UUID := '00000000-0000-0000-0000-000000000004';
BEGIN
  -- 5.1 Admin
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    admin_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'admin@quimicadeheza.com', crypt('admin123', gen_salt('bf')), NOW(), 
    '{"provider": "email", "providers": ["email"]}'::jsonb, 
    '{"nombre": "Administrador General", "rol": "admin"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

  INSERT INTO public.profiles (id, nombre, email, rol, branch_id, sector_id, activo, telefono)
  VALUES (admin_id, 'Administrador General', 'admin@quimicadeheza.com', 'admin', 1, 1, TRUE, '+54 358 400-0001')
  ON CONFLICT (id) DO UPDATE SET rol = 'admin', branch_id = 1;

  -- 5.2 Ventas
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    ventas_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'ventas@quimicadeheza.com', crypt('ventas123', gen_salt('bf')), NOW(), 
    '{"provider": "email", "providers": ["email"]}'::jsonb, 
    '{"nombre": "Vendedor Central", "rol": "ventas"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

  INSERT INTO public.profiles (id, nombre, email, rol, branch_id, sector_id, activo, telefono)
  VALUES (ventas_id, 'Vendedor Central', 'ventas@quimicadeheza.com', 'ventas', 1, 2, TRUE, '+54 358 400-0002')
  ON CONFLICT (id) DO UPDATE SET rol = 'ventas', branch_id = 1;

  -- 5.3 Depósito
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    deposito_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'deposito@quimicadeheza.com', crypt('deposito123', gen_salt('bf')), NOW(), 
    '{"provider": "email", "providers": ["email"]}'::jsonb, 
    '{"nombre": "Encargado Depósito", "rol": "deposito"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

  INSERT INTO public.profiles (id, nombre, email, rol, branch_id, sector_id, activo, telefono)
  VALUES (deposito_id, 'Encargado Depósito', 'deposito@quimicadeheza.com', 'deposito', 1, 3, TRUE, '+54 358 400-0003')
  ON CONFLICT (id) DO UPDATE SET rol = 'deposito', branch_id = 1;

  -- 5.4 Repartidor
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, 
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    repartidor_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
    'repartidor@quimicadeheza.com', crypt('repartidor123', gen_salt('bf')), NOW(), 
    '{"provider": "email", "providers": ["email"]}'::jsonb, 
    '{"nombre": "Repartidor Oficial", "rol": "repartidor"}'::jsonb, NOW(), NOW()
  ) ON CONFLICT (id) DO UPDATE SET encrypted_password = EXCLUDED.encrypted_password;

  INSERT INTO public.profiles (id, nombre, email, rol, branch_id, sector_id, activo, telefono, auto, patente)
  VALUES (repartidor_id, 'Repartidor Oficial', 'repartidor@quimicadeheza.com', 'repartidor', 1, 4, TRUE, '+54 358 400-0004', 'Camioneta Deheza', 'AF123JK')
  ON CONFLICT (id) DO UPDATE SET rol = 'repartidor', branch_id = 1;

  INSERT INTO public.drivers (id, vehiculo_info, activo)
  VALUES (repartidor_id, 'Camioneta Deheza (AF123JK)', TRUE)
  ON CONFLICT (id) DO UPDATE SET vehiculo_info = EXCLUDED.vehiculo_info;
END $$;

-- 6. Políticas RLS permisivas en la tabla profiles
ALTER TABLE IF EXISTS public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow all access on profiles" ON public.profiles;
CREATE POLICY "Allow all access on profiles" ON public.profiles FOR ALL USING (TRUE) WITH CHECK (TRUE);
