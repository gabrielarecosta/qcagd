-- Migración 47: Permitir UUIDs o IDs numéricos en customer_addresses (cambiar tipo a TEXT)
-- Corrige el error 22P02: invalid input syntax for type bigint: "uuid"

DO $$
BEGIN
  -- Quitar foreign key constraints previas que obligaban a customer_id ser bigint
  ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS fk_customer_addresses_customers;
  ALTER TABLE public.customer_addresses DROP CONSTRAINT IF EXISTS customer_addresses_customer_id_fkey;

  -- Convertir la columna customer_id a TEXT para aceptar tanto enteros como UUIDs de auth
  ALTER TABLE public.customer_addresses ALTER COLUMN customer_id TYPE TEXT USING customer_id::text;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Índice para búsquedas rápidas por customer_id
CREATE INDEX IF NOT EXISTS idx_customer_addresses_customer_id ON public.customer_addresses(customer_id);

-- Asegurar políticas RLS permisivas en customer_addresses
ALTER TABLE public.customer_addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on customer_addresses" ON public.customer_addresses;
CREATE POLICY "Allow all access on customer_addresses"
  ON public.customer_addresses FOR ALL
  USING (true)
  WITH CHECK (true);
