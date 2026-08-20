-- ============================================================
-- MIGRACIÓN: AGREGAR COORDENADAS A TABLA SUCURSALES (BRANCHES)
-- Permite configurar la ubicación geográfica de la Casa Central
-- ============================================================

ALTER TABLE branches 
ADD COLUMN IF NOT EXISTS latitude NUMERIC(10, 7),
ADD COLUMN IF NOT EXISTS longitude NUMERIC(10, 7);

-- Asignar coordenadas iniciales para Casa Central (Entre Ríos 151, General Deheza)
UPDATE branches
SET 
  direccion = COALESCE(NULLIF(direccion, ''), 'Entre Ríos 151, General Deheza, Córdoba'),
  latitude = -32.7650,
  longitude = -63.7860
WHERE id = 'branch-gd1' OR nombre ILIKE '%central%' OR nombre ILIKE '%deheza 1%';
