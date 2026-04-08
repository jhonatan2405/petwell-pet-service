-- =========================================================
--  PetWell — Pet Service | Migration v2
--  Migrates from single owner_id to many-to-many pet_owners.
--
--  ⚠  Run AFTER schema.sql has been applied (v1 must exist).
--  ⚠  For a fresh database, apply this script right after schema.sql.
--  ⚠  For an existing database with data, this script preserves
--     all existing owner relationships via the INSERT...SELECT below.
-- =========================================================

-- ── 1. Create the pet_owners join table ──────────────────
--  Supports many-to-many: a pet can have one or more owners.
--  owner_id references the user managed by the User Service.
CREATE TABLE public.pet_owners (
    pet_id   UUID REFERENCES public.pets(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL,
    PRIMARY KEY (pet_id, owner_id)
);

-- ── 2. Migrate existing data ─────────────────────────────
--  Copy each pet's current owner_id into the new join table.
--  Skip this block if the database is empty (no pets yet).
INSERT INTO public.pet_owners (pet_id, owner_id)
SELECT id, owner_id
FROM   public.pets;

-- ── 3. Add indexes on pet_owners ─────────────────────────
-- Speeds up GET /pets (list all pets for a given owner)
CREATE INDEX IF NOT EXISTS idx_pet_owners_owner_id
    ON public.pet_owners(owner_id);

-- Speeds up isOwner() checks and joins from the pet_id side
CREATE INDEX IF NOT EXISTS idx_pet_owners_pet_id
    ON public.pet_owners(pet_id);

-- ── 4. Remove the now-redundant owner_id column ──────────
ALTER TABLE public.pets DROP COLUMN owner_id;
DROP INDEX IF EXISTS idx_pets_owner_id;
