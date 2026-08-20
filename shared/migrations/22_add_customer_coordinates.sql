-- ============================================================
-- MIGRACIÓN 22: COORDENADAS GEOGRÁFICAS DE CLIENTES Y DIRECCIONES
-- Química General Deheza — Ejecutar en Supabase SQL Editor
-- ============================================================
-- Añade columnas de latitud y longitud a las tablas `customers`
-- y `customer_addresses` para permitir la selección y confirmación
-- de ubicación exacta en mapa durante el registro y edición.
-- ============================================================

-- 1. Añadir columnas a la tabla `customers` si no existen
ALTER TABLE customers
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;

-- 2. Añadir columnas a la tabla `customer_addresses` si no existen
ALTER TABLE customer_addresses
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;

-- 3. Asignar coordenadas iniciales en General Deheza a clientes existentes sin lat/lng
UPDATE customers
SET 
  latitude = -32.7561 + (ROW_NUMBER() OVER (ORDER BY id) * 0.002 - 0.004),
  longitude = -63.7845 + (ROW_NUMBER() OVER (ORDER BY id) * 0.002 - 0.004),
  location_verified = TRUE
WHERE (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0);

-- 4. Asignar coordenadas iniciales a direcciones secundarias de clientes
UPDATE customer_addresses
SET 
  latitude = -32.7561 + (ROW_NUMBER() OVER (ORDER BY id) * 0.002 - 0.004),
  longitude = -63.7845 + (ROW_NUMBER() OVER (ORDER BY id) * 0.002 - 0.004),
  location_verified = TRUE
WHERE (latitude IS NULL OR longitude IS NULL OR latitude = 0 OR longitude = 0);

-- 5. VERIFICACIÓN: Mostrar clientes con sus coordenadas registradas
SELECT id, nombre, email, direccion, latitude, longitude, location_verified
FROM customers
ORDER BY nombre;
