-- MIGRACION 37: Tabla de localidades habilitadas para reparto y venta
CREATE TABLE IF NOT EXISTS public.localidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    provincia TEXT DEFAULT 'Córdoba' NOT NULL,
    codigo_postal TEXT,
    branch_id BIGINT REFERENCES public.branches(id) ON DELETE SET NULL,
    activa BOOLEAN DEFAULT TRUE NOT NULL,
    reparto_habilitado BOOLEAN DEFAULT TRUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_localidad_nombre UNIQUE (nombre, provincia)
);

-- Habilitar RLS en localidades
ALTER TABLE public.localidades ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'localidades' AND policyname = 'Permitir lectura publica de localidades'
    ) THEN
        CREATE POLICY "Permitir lectura publica de localidades" ON public.localidades FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'localidades' AND policyname = 'Permitir gestion de localidades'
    ) THEN
        CREATE POLICY "Permitir gestion de localidades" ON public.localidades FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Semillas iniciales
INSERT INTO public.localidades (nombre, provincia, codigo_postal, activa, reparto_habilitado) VALUES
('General Deheza', 'Córdoba', '5923', true, true),
('General Cabrera', 'Córdoba', '5921', true, true),
('Las Perdices', 'Córdoba', '5925', true, true),
('Río Cuarto', 'Córdoba', '5800', true, true),
('Villa María', 'Córdoba', '5900', true, true)
ON CONFLICT DO NOTHING;
