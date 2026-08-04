-- ============================================================
-- MIGRACIÓN: GEOLOCALIZACIÓN Y DIRECCIÓN PREDETERMINADA EN DIRECCIONES
-- ============================================================

ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE customer_addresses ADD COLUMN IF NOT EXISTS default_address BOOLEAN DEFAULT FALSE;
