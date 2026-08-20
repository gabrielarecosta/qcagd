-- Migration 27: Add Mercado Pago preference fields to orders for expiration tracking and payment retries
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_preference_id TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_init_point TEXT DEFAULT NULL;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS mp_preference_expires_at TIMESTAMPTZ DEFAULT NULL;
