-- Migration 62: Agregar columna tipo_cliente a la tabla super_offers
-- Permite segmentar súper ofertas por tipo de cliente:
-- 'todos' (default / público general), 'minorista', 'mayorista', 'socio'

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'super_offers' AND column_name = 'tipo_cliente'
  ) THEN
    ALTER TABLE public.super_offers ADD COLUMN tipo_cliente TEXT DEFAULT 'todos';
  END IF;
END $$;
