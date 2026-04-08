import { supabase } from '../config/supabase';
import { PetRow, CreatePetDto, UpdatePetDto, PetPublicProfile } from '../models/pet.model';

// -----------------------------------------------------------------------
// Pet Repository – all Supabase interactions for the pets and pet_owners tables.
// v2: owner_id column removed from pets; ownership managed via pet_owners.
// -----------------------------------------------------------------------

export const petRepository = {
    /**
     * Insert a new pet row and the corresponding pet_owners entry.
     * Returns PetPublicProfile with owner_ids populated.
     */
    async create(ownerId: string, dto: CreatePetDto): Promise<PetPublicProfile> {
        // 1. Insert the pet (no owner_id column any more)
        const { data: petData, error: petError } = await supabase
            .from('pets')
            .insert({
                name: dto.name,
                species: dto.species,
                breed: dto.breed ?? null,
                birth_date: dto.birth_date ?? null,
                sex: dto.sex ?? null,
                weight: dto.weight ?? null,
                microchip: dto.microchip ?? null,
                allergies: dto.allergies ?? null,
                primary_clinic_id: dto.primary_clinic_id ?? null,
            })
            .select('*')
            .single();

        if (petError) throw new Error(petError.message);
        const pet = petData as PetRow;

        // 2. Register the creator as the first owner
        const { error: ownerError } = await supabase
            .from('pet_owners')
            .insert({ pet_id: pet.id, owner_id: ownerId });

        if (ownerError) throw new Error(ownerError.message);

        return toPetPublicProfile(pet, [ownerId]);
    },

    /**
     * Retrieve all pets that belong to a specific owner via the pet_owners join table.
     * Uses idx_pet_owners_owner_id for performance.
     */
    async findAllByOwner(ownerId: string): Promise<PetPublicProfile[]> {
        // Fetch all pet_ids that belong to this owner
        const { data: ownerRows, error: ownerError } = await supabase
            .from('pet_owners')
            .select('pet_id')
            .eq('owner_id', ownerId);

        if (ownerError) throw new Error(ownerError.message);
        if (!ownerRows || ownerRows.length === 0) return [];

        const petIds = ownerRows.map((r: { pet_id: string }) => r.pet_id);

        // Fetch the actual pet rows
        const { data: pets, error: petsError } = await supabase
            .from('pets')
            .select('*')
            .in('id', petIds)
            .order('created_at', { ascending: false });

        if (petsError) throw new Error(petsError.message);
        if (!pets || pets.length === 0) return [];

        // For each pet, grab the full owner list
        const results: PetPublicProfile[] = await Promise.all(
            (pets as PetRow[]).map(async (pet) => {
                const ownerIds = await this._getOwnerIds(pet.id);
                return toPetPublicProfile(pet, ownerIds);
            }),
        );

        return results;
    },

    /**
     * Retrieve all pets that belong to a specific clinic.
     * Uses idx_pets_primary_clinic for performance.
     */
    async findByClinicId(clinicId: string): Promise<PetPublicProfile[]> {
        const { data: pets, error } = await supabase
            .from('pets')
            .select('*')
            .eq('primary_clinic_id', clinicId)
            .order('created_at', { ascending: false });

        if (error) throw new Error(error.message);
        if (!pets || pets.length === 0) return [];

        const results: PetPublicProfile[] = await Promise.all(
            (pets as PetRow[]).map(async (pet) => {
                const ownerIds = await this._getOwnerIds(pet.id);
                return toPetPublicProfile(pet, ownerIds);
            }),
        );

        return results;
    },

    /**
     * Find a pet by its primary key.
     * Returns the raw PetRow (without owner_ids — use isOwner() separately for auth checks).
     */
    async findById(id: string): Promise<PetRow | null> {
        const { data, error } = await supabase
            .from('pets')
            .select('*')
            .eq('id', id)
            .maybeSingle();

        if (error) throw new Error(error.message);
        return (data as PetRow) ?? null;
    },

    /**
     * Find a pet and build its full public profile (includes owner_ids).
     */
    async findByIdWithOwners(id: string): Promise<PetPublicProfile | null> {
        const pet = await this.findById(id);
        if (!pet) return null;
        const ownerIds = await this._getOwnerIds(id);
        return toPetPublicProfile(pet, ownerIds);
    },

    /**
     * Check whether a given user is one of the owners of a pet.
     * Uses idx_pet_owners_pet_id for the lookup.
     */
    async isOwner(petId: string, ownerId: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('pet_owners')
            .select('pet_id')
            .eq('pet_id', petId)
            .eq('owner_id', ownerId)
            .maybeSingle();

        if (error) throw new Error(error.message);
        return data !== null;
    },

    /**
     * Update a pet by id. Returns the updated public profile.
     */
    async update(id: string, dto: UpdatePetDto): Promise<PetPublicProfile> {
        const { data, error } = await supabase
            .from('pets')
            .update({
                ...(dto.name !== undefined && { name: dto.name }),
                ...(dto.species !== undefined && { species: dto.species }),
                ...(dto.breed !== undefined && { breed: dto.breed }),
                ...(dto.birth_date !== undefined && { birth_date: dto.birth_date }),
                ...(dto.sex !== undefined && { sex: dto.sex }),
                ...(dto.weight !== undefined && { weight: dto.weight }),
                ...(dto.microchip !== undefined && { microchip: dto.microchip }),
                ...(dto.allergies !== undefined && { allergies: dto.allergies }),
                ...(dto.primary_clinic_id !== undefined && { primary_clinic_id: dto.primary_clinic_id }),
            })
            .eq('id', id)
            .select('*')
            .single();

        if (error) throw new Error(error.message);
        const ownerIds = await this._getOwnerIds(id);
        return toPetPublicProfile(data as PetRow, ownerIds);
    },

    /**
     * Add a new owner to an existing pet.
     * If the relationship already exists the insert is rejected at the
     * caller level (petService checks isOwner first).
     */
    async addOwner(petId: string, ownerId: string): Promise<void> {
        const { error } = await supabase
            .from('pet_owners')
            .insert({ pet_id: petId, owner_id: ownerId });

        if (error) throw new Error(error.message);
    },

    /**
     * Returns the list of owner_ids for a given pet.
     * User details (name, email) are resolved by the service layer
     * via HTTP call to the User Service — not by querying users table.
     */
    async getOwners(petId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('pet_owners')
            .select('owner_id')
            .eq('pet_id', petId);

        if (error) throw new Error(error.message);
        return (data ?? []).map((r: { owner_id: string }) => r.owner_id);
    },

    /**
     * Removes an owner from the pet_owners table.
     * The service layer must verify that at least one owner remains.
     */
    async removeOwner(petId: string, ownerId: string): Promise<void> {
        const { error } = await supabase
            .from('pet_owners')
            .delete()
            .eq('pet_id', petId)
            .eq('owner_id', ownerId);

        if (error) throw new Error(error.message);
    },

    /**
     * Delete a pet by id.
     * ON DELETE CASCADE in pet_owners removes the owner rows automatically.
     */
    async deleteById(id: string): Promise<void> {
        const { error } = await supabase
            .from('pets')
            .delete()
            .eq('id', id);

        if (error) throw new Error(error.message);
    },

    // ── Photo upload ────────────────────────────────────────────────────────

    /**
     * Upload a photo to Supabase Storage bucket 'pet-photos' and return the public URL.
     * Overwrites any existing photo for this pet (same path).
     *
     * SETUP REQUIRED: The bucket 'pet-photos' must exist in Supabase Storage
     * with Public access enabled. If missing, a clear error is thrown.
     */
    async uploadPhoto(petId: string, fileBuffer: Buffer, mimetype: string): Promise<string> {
        const ext = mimetype.split('/')[1] ?? 'jpg';
        const filePath = `${petId}/photo.${ext}`;

        const { error } = await supabase.storage
            .from('pet-photos')
            .upload(filePath, fileBuffer, {
                contentType: mimetype,
                upsert: true,  // overwrite if exists
            });

        if (error) {
            // Provide a clear, actionable message for the most common setup error
            if (
                error.message.toLowerCase().includes('bucket not found') ||
                error.message.toLowerCase().includes('not found')
            ) {
                throw new Error(
                    'Bucket "pet-photos" no encontrado. ' +
                    'Crea el bucket en Supabase → Storage → New Bucket → ' +
                    'Nombre: pet-photos → habilita acceso público (Public).',
                );
            }
            throw new Error(`Error subiendo foto: ${error.message}`);
        }

        const { data: publicData } = supabase.storage
            .from('pet-photos')
            .getPublicUrl(filePath);

        return publicData.publicUrl;
    },

    /**
     * Persist the photo URL on the pets table.
     */
    async updatePhotoUrl(petId: string, photoUrl: string): Promise<void> {
        const { error } = await supabase
            .from('pets')
            .update({ photo_url: photoUrl })
            .eq('id', petId);

        if (error) throw new Error(error.message);
    },

    // ── Private helpers ────────────────────────────────────────────────────

    /** Returns all owner_ids for a given pet_id. */
    async _getOwnerIds(petId: string): Promise<string[]> {
        const { data, error } = await supabase
            .from('pet_owners')
            .select('owner_id')
            .eq('pet_id', petId);

        if (error) throw new Error(error.message);
        return (data ?? []).map((r: { owner_id: string }) => r.owner_id);
    },
};

// Helper: map a DB row + ownerIds to a safe public profile
export const toPetPublicProfile = (pet: PetRow, ownerIds: string[]): PetPublicProfile => ({
    id: pet.id,
    owner_ids: ownerIds,
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    birth_date: pet.birth_date,
    sex: pet.sex,
    weight: pet.weight,
    microchip: pet.microchip,
    allergies: pet.allergies,
    primary_clinic_id: pet.primary_clinic_id,
    photo_url: pet.photo_url ?? null,
    created_at: pet.created_at,
    updated_at: pet.updated_at,
});
