-- MIGRACION 42: Banderas de venta online, presencial, reparto y tipo de sucursal
ALTER TABLE public.branches
ADD COLUMN IF NOT EXISTS permite_venta_online BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS permite_venta_presencial BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS permite_reparto BOOLEAN DEFAULT TRUE NOT NULL,
ADD COLUMN IF NOT EXISTS tipo_sucursal TEXT DEFAULT 'sucursal_completa' NOT NULL;
