-- Migration 25: Drop sectors table and sector_id from profiles
DROP TABLE IF EXISTS public.sectors CASCADE;

ALTER TABLE public.profiles DROP COLUMN IF EXISTS sector_id;
