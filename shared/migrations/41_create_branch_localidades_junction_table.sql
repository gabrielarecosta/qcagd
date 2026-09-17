-- MIGRACION 41: Tabla intermedia para la relación Muchos a Muchos entre Sucursales y Localidades
CREATE TABLE IF NOT EXISTS public.branch_localidades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    branch_id BIGINT NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
    localidad_id UUID NOT NULL REFERENCES public.localidades(id) ON DELETE CASCADE,
    es_principal BOOLEAN DEFAULT FALSE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_branch_localidad UNIQUE (branch_id, localidad_id)
);

-- Habilitar RLS en branch_localidades
ALTER TABLE public.branch_localidades ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'branch_localidades' AND policyname = 'Permitir lectura publica de branch_localidades'
    ) THEN
        CREATE POLICY "Permitir lectura publica de branch_localidades" ON public.branch_localidades FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'branch_localidades' AND policyname = 'Permitir gestion de branch_localidades'
    ) THEN
        CREATE POLICY "Permitir gestion de branch_localidades" ON public.branch_localidades FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- Sembrar relaciones iniciales uniendo sucursales activas con las localidades existentes
INSERT INTO public.branch_localidades (branch_id, localidad_id, es_principal)
SELECT b.id, l.id, true
FROM public.branches b
CROSS JOIN public.localidades l
WHERE (
    LOWER(b.nombre) LIKE '%' || LOWER(l.nombre) || '%'
    OR (b.id = 1 AND LOWER(l.nombre) LIKE '%deheza%')
)
ON CONFLICT (branch_id, localidad_id) DO NOTHING;
