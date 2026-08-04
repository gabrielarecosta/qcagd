-- ============================================================
-- MIGRACIÓN: MÓDULO DE GEOLOCALIZACIÓN Y PLANIFICACIÓN DE RECORRIDOS
-- ============================================================

-- 1. TABLA DE CONFIGURACIÓN DEL DEPÓSITO Y REPARTO
CREATE TABLE IF NOT EXISTS business_delivery_settings (
    id TEXT PRIMARY KEY DEFAULT 'config_delivery',
    business_name TEXT NOT NULL,
    depot_address TEXT NOT NULL,
    depot_latitude DOUBLE PRECISION NOT NULL,
    depot_longitude DOUBLE PRECISION NOT NULL,
    service_radius_meters DOUBLE PRECISION DEFAULT 8000 NOT NULL,
    default_departure_time TEXT DEFAULT '08:00' NOT NULL,
    default_stop_duration_minutes INTEGER DEFAULT 10 NOT NULL,
    returns_to_depot BOOLEAN DEFAULT TRUE NOT NULL,
    max_orders_per_route INTEGER DEFAULT 20 NOT NULL,
    city TEXT NOT NULL DEFAULT 'General Deheza',
    province TEXT NOT NULL DEFAULT 'Córdoba',
    country TEXT NOT NULL DEFAULT 'Argentina',
    phone TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Seed de configuración inicial si no existe
INSERT INTO business_delivery_settings (id, business_name, depot_address, depot_latitude, depot_longitude, service_radius_meters, phone)
VALUES ('config_delivery', 'Sodería General Deheza', 'Bv. San Martín 123, General Deheza, Córdoba, Argentina', -32.7566, -63.7861, 8000.0, '3584123456')
ON CONFLICT (id) DO NOTHING;


-- 2. ADICIÓN DE COLUMNAS DE GEOLOCALIZACIÓN Y ESTADOS EN ORDERS
ALTER TABLE orders ADD COLUMN IF NOT EXISTS order_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS original_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS formatted_address TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS street_number TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS city TEXT DEFAULT 'General Deheza';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS province TEXT DEFAULT 'Córdoba';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS postal_code TEXT DEFAULT '5923';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS country TEXT DEFAULT 'Argentina';
ALTER TABLE orders ADD COLUMN IF NOT EXISTS geoapify_place_id TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS address_reference TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS verification_method TEXT; -- 'auto', 'manual'
ALTER TABLE orders ADD COLUMN IF NOT EXISTS location_verified_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS priority INTEGER DEFAULT 0; -- 0: normal, 1: alta, 2: urgente
ALTER TABLE orders ADD COLUMN IF NOT EXISTS requested_date TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time_from TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_time_to TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_status TEXT DEFAULT 'pending';

-- Copiar datos iniciales para pedidos existentes
UPDATE orders SET order_number = numero WHERE order_number IS NULL;


-- 3. ADICIÓN DE COLUMNAS A LA TABLA DE RECORRIDOS (DELIVERY_ROUTES)
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS route_number TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS route_date TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS status TEXT CHECK (status IN ('draft', 'optimized', 'confirmed', 'active', 'completed', 'cancelled')) DEFAULT 'draft';
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS origin_address TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS origin_latitude DOUBLE PRECISION;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS origin_longitude DOUBLE PRECISION;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS destination_address TEXT;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS destination_latitude DOUBLE PRECISION;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS destination_longitude DOUBLE PRECISION;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS returns_to_origin BOOLEAN DEFAULT TRUE;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS total_orders INTEGER DEFAULT 0;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS total_distance_meters DOUBLE PRECISION DEFAULT 0;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS total_duration_seconds DOUBLE PRECISION DEFAULT 0;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS route_geojson JSONB;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS started_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE delivery_routes ADD COLUMN IF NOT EXISTS created_by TEXT;

-- Trigger para mantener sincronizado el estado viejo (estado) y el nuevo (status)
CREATE OR REPLACE FUNCTION trg_fn_sync_route_status()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'draft' THEN
        NEW.estado := 'pendiente';
    ELSIF NEW.status = 'optimized' OR NEW.status = 'confirmed' THEN
        NEW.estado := 'armado';
    ELSIF NEW.status = 'active' THEN
        NEW.estado := 'en_camino';
    ELSIF NEW.status = 'completed' THEN
        NEW.estado := 'entregado';
    ELSIF NEW.status = 'cancelled' THEN
        NEW.estado := 'no_entregado';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_route_status ON delivery_routes;
CREATE TRIGGER trg_sync_route_status
BEFORE INSERT OR UPDATE OF status ON delivery_routes
FOR EACH ROW EXECUTE FUNCTION trg_fn_sync_route_status();


-- 4. CREACIÓN DE LA TABLA DE PARADAS DEL RECORRIDO (DELIVERY_ROUTE_STOPS)
CREATE TABLE IF NOT EXISTS delivery_route_stops (
    id TEXT PRIMARY KEY,
    route_id TEXT REFERENCES delivery_routes(id) ON DELETE CASCADE NOT NULL,
    order_id TEXT REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
    stop_position INTEGER NOT NULL,
    latitude DOUBLE PRECISION NOT NULL,
    longitude DOUBLE PRECISION NOT NULL,
    status TEXT CHECK (status IN ('pending', 'next', 'arrived', 'delivered', 'failed', 'skipped', 'rescheduled')) DEFAULT 'pending' NOT NULL,
    estimated_arrival_at TIMESTAMP WITH TIME ZONE,
    estimated_distance_from_previous DOUBLE PRECISION DEFAULT 0,
    estimated_duration_from_previous DOUBLE PRECISION DEFAULT 0,
    actual_arrival_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    failure_reason TEXT,
    delivery_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Creación de índices necesarios para optimizar las consultas y evitar bloqueos
CREATE INDEX IF NOT EXISTS idx_route_stops_route ON delivery_route_stops(route_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_order ON delivery_route_stops(order_id);
CREATE INDEX IF NOT EXISTS idx_route_stops_position ON delivery_route_stops(route_id, stop_position);
CREATE INDEX IF NOT EXISTS idx_routes_date_status ON delivery_routes(route_date, status);


-- 5. CONFIGURACIÓN DE SEGURIDAD RLS EN NUEVAS TABLAS
ALTER TABLE business_delivery_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_route_stops ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura general a autenticados en settings" ON business_delivery_settings;
CREATE POLICY "Permitir lectura general a autenticados en settings" 
ON business_delivery_settings FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Permitir escritura a administradores en settings" ON business_delivery_settings;
CREATE POLICY "Permitir escritura a administradores en settings" 
ON business_delivery_settings FOR ALL TO authenticated USING (
    EXISTS (
        SELECT 1 FROM profiles 
        WHERE profiles.id = auth.uid()::text 
        AND profiles.rol IN ('admin', 'vendedor')
    )
);

DROP POLICY IF EXISTS "Permitir acceso completo a paradas para autenticados" ON delivery_route_stops;
CREATE POLICY "Permitir acceso completo a paradas para autenticados" 
ON delivery_route_stops FOR ALL TO authenticated USING (true);


-- 6. TRIGGERS AUTOMÁTICOS PARA COLUMNAS DE ACTUALIZACIÓN (UPDATED_AT)
CREATE OR REPLACE FUNCTION trg_fn_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_business_settings ON business_delivery_settings;
CREATE TRIGGER trg_update_business_settings
BEFORE UPDATE ON business_delivery_settings
FOR EACH ROW EXECUTE FUNCTION trg_fn_update_timestamp();

DROP TRIGGER IF EXISTS trg_update_route_stops ON delivery_route_stops;
CREATE TRIGGER trg_update_route_stops
BEFORE UPDATE ON delivery_route_stops
FOR EACH ROW EXECUTE FUNCTION trg_fn_update_timestamp();
