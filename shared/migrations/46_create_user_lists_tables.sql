-- Migración 46: Tablas para "Mis Listas" de clientes
-- user_lists: listas de productos favoritos por usuario
-- user_list_items: productos dentro de cada lista (sin cantidad, solo presencia)

-- ───────────────────────────────────────────────────────────
-- TABLA user_lists
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_lists (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     TEXT NOT NULL,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- Si la tabla ya existía con user_id UUID o FK a auth.users, convertir a TEXT y quitar FK
DO $$
BEGIN
  -- Quitar constraint de foreign key a auth.users si existía
  ALTER TABLE public.user_lists DROP CONSTRAINT IF EXISTS user_lists_user_id_fkey;
  -- Convertir tipo a TEXT para soportar tanto UUIDs como IDs numéricos de clientes
  ALTER TABLE public.user_lists ALTER COLUMN user_id TYPE TEXT USING user_id::text;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_user_lists_user_id ON public.user_lists(user_id);

-- ───────────────────────────────────────────────────────────
-- TABLA user_list_items
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_list_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list_id     BIGINT NOT NULL REFERENCES public.user_lists(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_user_list_items_list_id ON public.user_list_items(list_id);

-- ───────────────────────────────────────────────────────────
-- RLS Y POLÍTICAS (Igual que en user_carts para máxima compatibilidad)
-- ───────────────────────────────────────────────────────────
ALTER TABLE public.user_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_list_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_lists" ON public.user_lists;
DROP POLICY IF EXISTS "user_lists_all" ON public.user_lists;
CREATE POLICY "user_lists_all"
  ON public.user_lists FOR ALL
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "users_own_list_items" ON public.user_list_items;
DROP POLICY IF EXISTS "user_list_items_all" ON public.user_list_items;
CREATE POLICY "user_list_items_all"
  ON public.user_list_items FOR ALL
  USING (true)
  WITH CHECK (true);

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_user_lists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_lists_updated_at ON public.user_lists;
CREATE TRIGGER trg_user_lists_updated_at
  BEFORE UPDATE ON public.user_lists
  FOR EACH ROW EXECUTE FUNCTION update_user_lists_updated_at();
