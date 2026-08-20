-- Add deleted_at column to super_offers for soft deletes (baja lógica)
ALTER TABLE super_offers ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
