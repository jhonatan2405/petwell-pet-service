-- ============================================================
-- PetWell — Pet Service Migration
-- Add photo_url column to pets table
-- Run this in your Supabase SQL editor
-- ============================================================

ALTER TABLE pets ADD COLUMN IF NOT EXISTS photo_url TEXT;

COMMENT ON COLUMN pets.photo_url IS 'Public URL of the pet photo stored in Supabase Storage (pet-photos bucket)';
