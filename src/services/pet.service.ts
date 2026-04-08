import { petRepository } from '../repositories/pet.repository';
import { userRepository } from '../repositories/user.repository';
import { CreatePetDto, UpdatePetDto, PetPublicProfile, JwtPayload } from '../models/pet.model';

// -----------------------------------------------------------------------
// Pet Service – business logic layer. No Supabase calls here.
// v2: ownership checks now use petRepository.isOwner() instead of
//     comparing pet.owner_id directly, enabling many-to-many ownership.
// -----------------------------------------------------------------------

export const petService = {
    /**
     * Creates a new pet associated with the authenticated owner.
     * owner_id is always taken from the JWT — never from the request body.
     */
    async createPet(ownerId: string, dto: CreatePetDto): Promise<PetPublicProfile> {
        return petRepository.create(ownerId, dto);
    },

    /**
     * Returns all pets belonging to the authenticated owner.
     */
    async getMyPets(ownerId: string): Promise<PetPublicProfile[]> {
        return petRepository.findAllByOwner(ownerId);
    },

    /**
     * Returns all pets belonging to a specific clinic.
     */
    async getPetsByClinic(clinicId: string): Promise<PetPublicProfile[]> {
        return petRepository.findByClinicId(clinicId);
    },

    /**
     * Returns a single pet by ID.
     * Enforces ownership: only a registered owner can access the pet.
     * ALSO accessible by clinic staff if the pet belongs to their clinic.
     */
    async getPetById(petId: string, user: JwtPayload): Promise<PetPublicProfile> {
        // First verify the pet exists
        const pet = await petRepository.findById(petId);

        if (!pet) {
            const err = new Error('Mascota no encontrada');
            (err as { statusCode?: number }).statusCode = 404;
            throw err;
        }

        // Then verify the requester is one of the owners OR belongs to the clinic
        let authorized = false;

        if (user.role === 'DUENO_MASCOTA') {
            authorized = await petRepository.isOwner(petId, user.sub);
        } else if ((user.role === 'CLINIC_ADMIN' || user.role === 'VETERINARIO' || user.role === 'RECEPCIONISTA') && user.clinic_id) {
            authorized = pet.primary_clinic_id === user.clinic_id;
        }

        if (!authorized) {
            const err = new Error('No tienes permiso para acceder a esta mascota');
            (err as { statusCode?: number }).statusCode = 403;
            throw err;
        }

        // Return full profile (with owner_ids populated)
        const profile = await petRepository.findByIdWithOwners(petId);
        return profile!;
    },

    /**
     * Updates a pet's data.
     * Enforces ownership before allowing any modification.
     */
    async updatePet(
        petId: string,
        ownerId: string,
        dto: UpdatePetDto,
    ): Promise<PetPublicProfile> {
        const existing = await petRepository.findById(petId);

        if (!existing) {
            const err = new Error('Mascota no encontrada');
            (err as { statusCode?: number }).statusCode = 404;
            throw err;
        }

        const authorized = await petRepository.isOwner(petId, ownerId);
        if (!authorized) {
            const err = new Error('No tienes permiso para modificar esta mascota');
            (err as { statusCode?: number }).statusCode = 403;
            throw err;
        }

        return petRepository.update(petId, dto);
    },

    /**
     * Deletes a pet.
     * Enforces ownership before deletion.
     * pet_owners rows are removed automatically by ON DELETE CASCADE.
     */
    async deletePet(petId: string, ownerId: string): Promise<void> {
        const existing = await petRepository.findById(petId);

        if (!existing) {
            const err = new Error('Mascota no encontrada');
            (err as { statusCode?: number }).statusCode = 404;
            throw err;
        }

        const authorized = await petRepository.isOwner(petId, ownerId);
        if (!authorized) {
            const err = new Error('No tienes permiso para eliminar esta mascota');
            (err as { statusCode?: number }).statusCode = 403;
            throw err;
        }

        await petRepository.deleteById(petId);
    },

    /**
     * Adds a new owner to an existing pet.
     * Only an existing owner can add another owner.
     * The new owner is identified by email.
     */
    async addOwner(petId: string, requesterId: string, email: string, token: string): Promise<void> {
        // 1. Verify the pet exists
        const pet = await petRepository.findById(petId);
        if (!pet) {
            const err = new Error('Mascota no encontrada');
            (err as { statusCode?: number }).statusCode = 404;
            throw err;
        }

        // 2. Verify the requester is already an owner
        const requesterIsOwner = await petRepository.isOwner(petId, requesterId);
        if (!requesterIsOwner) {
            const err = new Error('No tienes permiso para modificar esta mascota');
            (err as { statusCode?: number }).statusCode = 403;
            throw err;
        }

        // 3. Look up the target user by email
        const user = await userRepository.findByEmail(email, token);
        if (!user) {
            const err = new Error('Usuario no encontrado');
            (err as { statusCode?: number }).statusCode = 404;
            throw err;
        }

        // 4. Guard against duplicate ownership
        const alreadyOwner = await petRepository.isOwner(petId, user.id);
        if (alreadyOwner) {
            const err = new Error('El usuario ya es dueño de esta mascota');
            (err as { statusCode?: number }).statusCode = 400;
            throw err;
        }

        // 5. Insert the new ownership record
        await petRepository.addOwner(petId, user.id);
    },

    async getOwners(petId: string, requesterId: string, token: string) {
        const isOwner = await petRepository.isOwner(petId, requesterId);

        if (!isOwner) {
            throw new Error('No tienes acceso a esta mascota');
        }

        const ownerIds = await petRepository.getOwners(petId);

        const owners = await Promise.all(
            ownerIds.map(async (ownerId) => {
                try {
                    const response = await fetch(
                        `${process.env.USER_SERVICE_URL}/api/v1/users/${ownerId}`,
                        {
                            headers: {
                                Authorization: token,
                                'Content-Type': 'application/json',
                            },
                        },
                    );

                    if (!response.ok) {
                        throw new Error('User service error');
                    }

                    const result = (await response.json()) as {
                        data: { id: string; name: string; email: string };
                    };

                    const user = result.data;

                    return {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                    };
                } catch (error) {
                    return {
                        id: ownerId,
                        name: 'Desconocido',
                        email: 'N/A',
                    };
                }
            }),
        );

        return owners;
    },

    /**
     * Removes an owner from a pet.
     * Rules:
     *   - requester must be an owner
     *   - cannot remove the last owner
     */
    async removeOwner(
        petId: string,
        requesterId: string,
        targetOwnerId: string,
    ): Promise<void> {
        // Pet exists?
        const pet = await petRepository.findById(petId);
        if (!pet) {
            const err = new Error('Mascota no encontrada');
            (err as { statusCode?: number }).statusCode = 404;
            throw err;
        }

        // Requester must be an owner
        const authorized = await petRepository.isOwner(petId, requesterId);
        if (!authorized) {
            const err = new Error('No tienes permiso para modificar esta mascota');
            (err as { statusCode?: number }).statusCode = 403;
            throw err;
        }

        // Cannot remove the last owner
        const ownerIds = await petRepository['_getOwnerIds'](petId);
        if (ownerIds.length <= 1) {
            const err = new Error('No se puede eliminar al último dueño de la mascota');
            (err as { statusCode?: number }).statusCode = 400;
            throw err;
        }

        await petRepository.removeOwner(petId, targetOwnerId);
    },

    /**
     * Uploads a photo for a pet and saves the public URL.
     * Only an existing owner can upload a photo.
     */
    async uploadPhoto(
        petId: string,
        ownerId: string,
        fileBuffer: Buffer,
        mimetype: string,
    ): Promise<{ photo_url: string }> {
        const pet = await petRepository.findById(petId);
        if (!pet) {
            const err = new Error('Mascota no encontrada');
            (err as { statusCode?: number }).statusCode = 404;
            throw err;
        }

        const authorized = await petRepository.isOwner(petId, ownerId);
        if (!authorized) {
            const err = new Error('No tienes permiso para modificar esta mascota');
            (err as { statusCode?: number }).statusCode = 403;
            throw err;
        }

        const photoUrl = await petRepository.uploadPhoto(petId, fileBuffer, mimetype);
        await petRepository.updatePhotoUrl(petId, photoUrl);

        return { photo_url: photoUrl };
    },
};

