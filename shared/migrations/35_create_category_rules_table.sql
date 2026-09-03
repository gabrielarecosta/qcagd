-- MIGRACION 35: Tabla de reglas de categorizacion y soporte de categorias dinamicas
CREATE TABLE IF NOT EXISTS public.category_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    categoria TEXT NOT NULL,
    pattern TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_cat_pattern UNIQUE (categoria, pattern)
);

ALTER TABLE public.category_names ADD COLUMN IF NOT EXISTS activa BOOLEAN DEFAULT TRUE;
ALTER TABLE public.category_names ADD COLUMN IF NOT EXISTS orden INT DEFAULT 0;

-- Habilitar RLS en category_rules
ALTER TABLE public.category_rules ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'category_rules' AND policyname = 'Permitir lectura publica de category_rules'
    ) THEN
        CREATE POLICY "Permitir lectura publica de category_rules" ON public.category_rules FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'category_rules' AND policyname = 'Permitir gestion de category_rules'
    ) THEN
        CREATE POLICY "Permitir gestion de category_rules" ON public.category_rules FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
