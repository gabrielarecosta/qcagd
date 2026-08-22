-- MIGRACION 34: Agregar columna activa a category_names
ALTER TABLE public.category_names ADD COLUMN IF NOT EXISTS activa BOOLEAN NOT NULL DEFAULT TRUE;
UPDATE public.category_names SET activa = TRUE WHERE activa IS NULL;
