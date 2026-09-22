-- Migración 46: Tablas para "Mis Listas" de clientes
-- user_lists: listas de productos favoritos por usuario
-- user_list_items: productos dentro de cada lista (sin cantidad, solo presencia)

-- ───────────────────────────────────────────────────────────
-- TABLA user_lists
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_lists (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre      TEXT NOT NULL,
  descripcion TEXT,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_lists_user_id ON user_lists(user_id);

-- ───────────────────────────────────────────────────────────
-- TABLA user_list_items
-- ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_list_items (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  list_id     BIGINT NOT NULL REFERENCES user_lists(id) ON DELETE CASCADE,
  product_id  BIGINT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(list_id, product_id)
);

CREATE INDEX IF NOT EXISTS idx_user_list_items_list_id ON user_list_items(list_id);

-- ───────────────────────────────────────────────────────────
-- RLS
-- ───────────────────────────────────────────────────────────
ALTER TABLE user_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_list_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_lists"
  ON user_lists FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "users_own_list_items"
  ON user_list_items FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_lists ul
      WHERE ul.id = user_list_items.list_id
        AND ul.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_lists ul
      WHERE ul.id = user_list_items.list_id
        AND ul.user_id = auth.uid()
    )
  );

-- Trigger updated_at
CREATE OR REPLACE FUNCTION update_user_lists_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_user_lists_updated_at
  BEFORE UPDATE ON user_lists
  FOR EACH ROW EXECUTE FUNCTION update_user_lists_updated_at();
