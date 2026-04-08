-- =========================================================
--  PetWell — Pet Service | Database Schema
--  Run this script once in the Supabase SQL Editor.
-- =========================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── Pets table ────────────────────────────────────────────
CREATE TABLE public.pets (
    id                UUID        PRIMARY KEY DEFAULT uuid_generate_v4(),
    owner_id          UUID        NOT NULL,
    name              VARCHAR(100) NOT NULL,
    species           VARCHAR(50)  NOT NULL,
    breed             VARCHAR(100),
    birth_date        DATE,
    sex               VARCHAR(10),
    weight            DECIMAL(5,2),
    microchip         VARCHAR(100),
    allergies         TEXT,
    primary_clinic_id UUID,
    created_at        TIMESTAMPTZ  DEFAULT NOW(),
    updated_at        TIMESTAMPTZ  DEFAULT NOW()
);

-- ── Indexes ───────────────────────────────────────────────
-- Speeds up GET /pets (list pets by owner)
CREATE INDEX IF NOT EXISTS idx_pets_owner_id
    ON public.pets(owner_id);

-- Speeds up future queries filtering by clinic
CREATE INDEX IF NOT EXISTS idx_pets_primary_clinic
    ON public.pets(primary_clinic_id);

-- ── Auto-update updated_at trigger ───────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_pets_updated_at
    BEFORE UPDATE ON public.pets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
