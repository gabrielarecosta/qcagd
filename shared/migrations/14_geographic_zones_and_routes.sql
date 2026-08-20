-- ============================================================
-- MIGRACIÓN 14: ZONAS POLIGONALES, GEOLOCALIZACIÓN Y RUTAS
-- Química General Deheza
-- ============================================================

-- 1. Asegurar tabla de zonas con soporte para polígonos GeoJSON
CREATE TABLE IF NOT EXISTS delivery_zones (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    polygon JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array de [lng, lat] formando el polígono
    color TEXT NOT NULL DEFAULT '#1A56DB',
    active BOOLEAN DEFAULT TRUE NOT NULL,
    default_driver_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Si la tabla ya existía con columnas anteriores, asegurar nuevas columnas
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS description TEXT DEFAULT '';
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS polygon JSONB DEFAULT '[]'::jsonb;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS color TEXT DEFAULT '#1A56DB';
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS active BOOLEAN DEFAULT TRUE;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS default_driver_id TEXT REFERENCES profiles(id) ON DELETE SET NULL;
ALTER TABLE delivery_zones ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Actualizar 'name' desde 'nombre' si existía
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='delivery_zones' AND column_name='nombre') THEN
        UPDATE delivery_zones SET name = nombre WHERE name IS NULL OR name = '';
    END IF;
END $$;

-- 2. Enriquecer tabla orders con geolocalización y asignación de zona
ALTER TABLE orders 
ADD COLUMN IF NOT EXISTS latitude NUMERIC,
ADD COLUMN IF NOT EXISTS longitude NUMERIC,
ADD COLUMN IF NOT EXISTS street TEXT,
ADD COLUMN IF NOT EXISTS street_number TEXT,
ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'General Deheza',
ADD COLUMN IF NOT EXISTS province TEXT DEFAULT 'Córdoba',
ADD COLUMN IF NOT EXISTS zone_id TEXT REFERENCES delivery_zones(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS zone_assignment_type TEXT DEFAULT 'automatic',
ADD COLUMN IF NOT EXISTS zone_assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS location_status TEXT DEFAULT 'pending';

-- 3. Tabla de Rutas de Reparto (delivery_routes)
CREATE TABLE IF NOT EXISTS delivery_routes (
    id TEXT PRIMARY KEY,
    zone_id TEXT REFERENCES delivery_zones(id) ON DELETE SET NULL,
    driver_id TEXT REFERENCES profiles(id) ON DELETE SET NULL,
    date TEXT NOT NULL, -- YYYY-MM-DD
    status TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_curso', 'completada', 'cancelada'
    total_distance NUMERIC DEFAULT 0, -- en km
    estimated_duration INTEGER DEFAULT 0, -- en minutos
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 4. Paradas de la Ruta (delivery_route_stops)
CREATE TABLE IF NOT EXISTS delivery_route_stops (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    route_id TEXT REFERENCES delivery_routes(id) ON DELETE CASCADE NOT NULL,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    stop_order INTEGER NOT NULL,
    status TEXT DEFAULT 'pendiente', -- 'pendiente', 'en_camino', 'entregado', 'no_entregado'
    arrived_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    notes TEXT DEFAULT '',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- 5. Índices para consultas espaciales y de alto rendimiento
CREATE INDEX IF NOT EXISTS idx_orders_zone_id ON orders(zone_id);
CREATE INDEX IF NOT EXISTS idx_orders_location_status ON orders(location_status);
CREATE INDEX IF NOT EXISTS idx_delivery_routes_date_driver ON delivery_routes(date, driver_id);
CREATE INDEX IF NOT EXISTS idx_delivery_route_stops_route_order ON delivery_route_stops(route_id, stop_order);

-- 6. Habilitar RLS con acceso total para operaciones
ALTER TABLE delivery_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_route_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Acceso total delivery_zones" ON delivery_zones;
CREATE POLICY "Acceso total delivery_zones" ON delivery_zones FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Acceso total delivery_routes" ON delivery_routes;
CREATE POLICY "Acceso total delivery_routes" ON delivery_routes FOR ALL USING (TRUE) WITH CHECK (TRUE);

DROP POLICY IF EXISTS "Acceso total delivery_route_stops" ON delivery_route_stops;
CREATE POLICY "Acceso total delivery_route_stops" ON delivery_route_stops FOR ALL USING (TRUE) WITH CHECK (TRUE);

-- 7. Semilla inicial de zonas para General Deheza con polígonos representativos reales
INSERT INTO delivery_zones (id, name, description, color, active, polygon)
VALUES 
(
  'zone-centro',
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
ON CONFLICT (id) DO NOTHING;
