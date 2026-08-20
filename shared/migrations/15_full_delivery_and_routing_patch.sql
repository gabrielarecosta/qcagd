-- ============================================================
-- SCRIPT DE ACTUALIZACIÓN Y PARCHE INTEGRAL DE REPARTOS Y RUTAS
-- Química General Deheza
-- Ejecutar en el SQL Editor de Supabase (es seguro y 100% idempotente)
-- ============================================================

-- 1. TABLA DE ZONAS GEOGRÁFICAS (delivery_zones)
CREATE TABLE IF NOT EXISTS delivery_zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    nombre TEXT,
    description TEXT DEFAULT '',
    polygon JSONB NOT NULL DEFAULT '[]'::jsonb,
    color TEXT NOT NULL DEFAULT '#1A56DB',
    active BOOLEAN DEFAULT TRUE NOT NULL,
    default_driver_id TEXT,
    branch_id TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS nombre TEXT;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS polygon JSONB DEFAULT '[]'::jsonb;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#1A56DB';
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS default_driver_id TEXT;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- Sincronizar name/nombre si falta alguno
UPDATE delivery_zones SET name = nombre WHERE (name IS NULL OR name = '') AND nombre IS NOT NULL;
UPDATE delivery_zones SET nombre = name WHERE (nombre IS NULL OR nombre = '') AND name IS NOT NULL;

-- 2. TABLA DE HOJAS DE RUTA (delivery_routes)
CREATE TABLE IF NOT EXISTS delivery_routes (
    id TEXT PRIMARY KEY,
    branch_id TEXT DEFAULT 'branch-gd1',
    repartidor_id TEXT,
    driver_id TEXT,
    fecha TEXT,
    date TEXT,
    estado TEXT DEFAULT 'armado',
    status TEXT DEFAULT 'optimized',
    zona TEXT DEFAULT 'General Deheza',
    zone_id TEXT,
    horario_estimado TEXT DEFAULT '08:00 a 20:00',
    notes TEXT DEFAULT '',
    observaciones TEXT DEFAULT '',
    total_distance NUMERIC DEFAULT 0,
    estimated_duration INTEGER DEFAULT 0,
    planned_by TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'branch-gd1';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS repartidor_id TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS driver_id TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS fecha TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'armado';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'optimized';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS zona TEXT DEFAULT 'General Deheza';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS zone_id TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS horario_estimado TEXT DEFAULT '08:00 a 20:00';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS observaciones TEXT DEFAULT '';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS total_distance NUMERIC DEFAULT 0;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS estimated_duration INTEGER DEFAULT 0;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS planned_by TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. TABLA DE PARADAS DE REPARTO (deliveries)
CREATE TABLE IF NOT EXISTS deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    estado TEXT DEFAULT 'pendiente',
    secuencia INTEGER NOT NULL DEFAULT 1,
    completado BOOLEAN DEFAULT FALSE,
    hora_real TEXT,
    motivo_no_entrega TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS route_id TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS estado TEXT DEFAULT 'pendiente';
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS secuencia INTEGER DEFAULT 1;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS completado BOOLEAN DEFAULT FALSE;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS hora_real TEXT;
ALTER TABLE deliveries ADD COLUMN IF NOT EXISTS motivo_no_entrega TEXT;

-- 4. TABLA DE PARADAS GEOGRÁFICAS (delivery_route_stops)
CREATE TABLE IF NOT EXISTS delivery_route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT NOT NULL,
    order_id TEXT NOT NULL,
    stop_order INTEGER NOT NULL DEFAULT 1,
    status TEXT DEFAULT 'pendiente',
    arrived_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE delivery_route_stops ADD COLUMN IF NOT EXISTS route_id TEXT;
ALTER TABLE delivery_route_stops ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE delivery_route_stops ADD COLUMN IF NOT EXISTS stop_order INTEGER DEFAULT 1;
ALTER TABLE delivery_route_stops ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'pendiente';
ALTER TABLE delivery_route_stops ADD COLUMN IF NOT EXISTS notes TEXT DEFAULT '';

-- 5. TABLA DE EVENTOS Y AUDITORÍA DE ENTREGAS (delivery_events)
CREATE TABLE IF NOT EXISTS delivery_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT NOT NULL,
    cliente_id TEXT,
    order_id TEXT,
    evento TEXT NOT NULL DEFAULT 'ENTREGA_PENDIENTE',
    completado BOOLEAN DEFAULT FALSE,
    hora_real TEXT,
    motivo_no_entrega TEXT,
    receptor_nombre TEXT,
    observaciones TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS route_id TEXT;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS cliente_id TEXT;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS order_id TEXT;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS evento TEXT DEFAULT 'ENTREGA_PENDIENTE';
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS completado BOOLEAN DEFAULT FALSE;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS hora_real TEXT;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS motivo_no_entrega TEXT;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS receptor_nombre TEXT;
ALTER TABLE delivery_events ADD COLUMN IF NOT EXISTS observaciones TEXT;

-- 6. CAMPOS EN TABLA ORDERS PARA GEOLOCALIZACIÓN Y REPARTO
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude NUMERIC;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'General Deheza';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS province TEXT DEFAULT 'Córdoba';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS zone_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_route_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_status TEXT DEFAULT 'geocoded';

-- 7. REGLAS RLS Y PERMISOS DE ACCESO TOTAL
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE deliveries ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_route_stops ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total delivery_zones" ON delivery_zones;
CREATE POLICY "Acceso total delivery_zones" ON delivery_zones FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Acceso total delivery_routes" ON delivery_routes;
CREATE POLICY "Acceso total delivery_routes" ON delivery_routes FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Acceso total deliveries" ON deliveries;
CREATE POLICY "Acceso total deliveries" ON deliveries FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Acceso total delivery_route_stops" ON delivery_route_stops;
CREATE POLICY "Acceso total delivery_route_stops" ON delivery_route_stops FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Acceso total delivery_events" ON delivery_events;
CREATE POLICY "Acceso total delivery_events" ON delivery_events FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 8. ZONAS INICIALES DE GENERAL DEHEZA SI LA TABLA ESTÁ VACÍA
INSERT INTO delivery_zones (id, name, nombre, description, color, active, polygon)
VALUES 
(
  'zone-centro',
  'Zona Centro',
  'Zona Centro',
  'Área céntrica y comercial de General Deheza (Plaza San Martín, Bv. San Martín)',
  '#0284c7',
  true,
  '[
    [-63.7925, -32.7510],
    [-63.7770, -32.7510],
    [-63.7770, -32.7610],
    [-63.7925, -32.7610],
    [-63.7925, -32.7510]
  ]'::jsonb
),
(
  'zone-norte',
  'Zona Norte',
  'Zona Norte',
  'Sector norte y accesos principales por Ruta 158 hacia Las Perdices',
  '#16a34a',
  true,
  '[
    [-63.7960, -32.7420],
    [-63.7740, -32.7420],
    [-63.7740, -32.7510],
    [-63.7960, -32.7510],
    [-63.7960, -32.7420]
  ]'::jsonb
),
(
  'zone-sur',
  'Zona Sur & Industrial',
  'Zona Sur & Industrial',
  'Sector sur residencial y parque agroindustrial hacia General Cabrera',
  '#ea580c',
  true,
  '[
    [-63.7960, -32.7610],
    [-63.7720, -32.7610],
    [-63.7720, -32.7740],
    [-63.7960, -32.7740],
    [-63.7960, -32.7610]
  ]'::jsonb
)
ON CONFLICT (id) DO UPDATE SET 
  name = EXCLUDED.name,
  nombre = EXCLUDED.nombre,
  polygon = EXCLUDED.polygon;
