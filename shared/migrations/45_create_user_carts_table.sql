-- ==============================================================================
-- MIGRACIÓN 45: TABLA DE CARRITOS DE USUARIO PARA PERSISTENCIA DB + FRONT
-- Proyecto: Química General Deheza
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.user_carts (
    user_id TEXT PRIMARY KEY,
    items JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS en la tabla
ALTER TABLE public.user_carts ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura y escritura públicas/autenticadas
DROP POLICY IF EXISTS "Permitir lectura publica de carritos por user_id" ON public.user_carts;
CREATE POLICY "Permitir lectura publica de carritos por user_id"
    ON public.user_carts FOR SELECT
    USING (true);

DROP POLICY IF EXISTS "Permitir insercion y actualizacion publica de carritos por user_id" ON public.user_carts;
CREATE POLICY "Permitir insercion y actualizacion publica de carritos por user_id"
    ON public.user_carts FOR ALL
    USING (true);
