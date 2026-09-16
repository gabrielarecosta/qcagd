-- MIGRACION 39: Campos de auditoría en tabla products (fecha_modificacion, usuario_id, rol_id, sucursal)
ALTER TABLE public.products
ADD COLUMN IF NOT EXISTS updated_by_user_id TEXT,
ADD COLUMN IF NOT EXISTS updated_by_role_id TEXT,
ADD COLUMN IF NOT EXISTS updated_by_branch_id BIGINT;

COMMENT ON COLUMN public.products.updated_by_user_id IS 'ID del usuario que realizó la última modificación';
COMMENT ON COLUMN public.products.updated_by_role_id IS 'Rol del usuario que realizó la última modificación';
COMMENT ON COLUMN public.products.updated_by_branch_id IS 'ID de la sucursal activa durante la última modificación';
