-- MIGRACION 36: Agregar columna branch_id a products e indice unico compuesto (codigo, branch_id)
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS branch_id BIGINT REFERENCES public.branches(id) ON DELETE CASCADE;

-- Asignar sucursal 1 (predeterminada) a productos existentes que no tengan branch_id
UPDATE public.products SET branch_id = 1 WHERE branch_id IS NULL;

-- Crear indice unico compuesto por (codigo, branch_id) para productos activos
CREATE UNIQUE INDEX IF NOT EXISTS products_codigo_branch_unique_idx 
ON public.products (codigo, COALESCE(branch_id, 1)) 
WHERE deleted_at IS NULL;
