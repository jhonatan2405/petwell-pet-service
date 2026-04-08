import { Request, Response, NextFunction } from 'express';
import { petService } from '../services/pet.service';
import { sendSuccess, sendError } from '../utils/response.util';
import { CreatePetDto, UpdatePetDto } from '../models/pet.model';


export const petController = {
    /**
     * POST /pets
     * Registers a new pet for the authenticated owner.
     * owner_id is extracted from req.user.sub (JWT).
     */
    async createPet(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const ownerId = req.user!.sub;
            const dto: CreatePetDto = req.body;
            const pet = await petService.createPet(ownerId, dto);
            sendSuccess(res, pet, 'Mascota registrada correctamente', 201);
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /pets
     * Returns all pets belonging to the authenticated owner.
     */
    async getMyPets(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const ownerId = req.user!.sub;
            const pets = await petService.getMyPets(ownerId);
            sendSuccess(res, pets, 'Lista de mascotas obtenida correctamente');
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /pets/clinic
     * Returns all pets belonging to the requester's clinic.
     * Accessible by clinic staff.
     */
    async getPetsByClinic(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const clinicId = req.user!.clinic_id;

            if (!clinicId) {
                sendError(res, 'El usuario no pertenece a una clínica', 400);
                return;
            }

            const pets = await petService.getPetsByClinic(clinicId);
            sendSuccess(res, pets, 'Lista de mascotas de la clínica obtenida correctamente');
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /pets/:id
     * Returns a specific pet by ID (must belong to the authenticated owner).
     */
    async getPetById(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const user = req.user!;
            const { id } = req.params;
            const pet = await petService.getPetById(id, user);
            sendSuccess(res, pet, 'Mascota obtenida correctamente');
        } catch (err) {
            next(err);
        }
    },

    /**
     * PUT /pets/:id
     * Updates a pet's data (must belong to the authenticated owner).
     */
    async updatePet(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const ownerId = req.user!.sub;
            const { id } = req.params;
            const dto: UpdatePetDto = req.body;
            const pet = await petService.updatePet(id, ownerId, dto);
            sendSuccess(res, pet, 'Mascota actualizada correctamente');
        } catch (err) {
            next(err);
        }
    },

    /**
     * DELETE /pets/:id
     * Deletes a pet (must belong to the authenticated owner).
     */
    async deletePet(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const ownerId = req.user!.sub;
            const { id } = req.params;
            await petService.deletePet(id, ownerId);
            sendSuccess(res, null, 'Mascota eliminada correctamente');
        } catch (err) {
            next(err);
        }
    },

    /**
     * POST /pets/:id/owners
     * Adds a new owner to the pet (by email).
     * Only an existing owner can perform this action.
     */
    async addOwner(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const petId = req.params.id;
            const requesterId = req.user!.sub;
            const { email } = req.body;
            const token = req.headers.authorization!;
            await petService.addOwner(petId, requesterId, email, token);
            sendSuccess(res, null, 'Nuevo dueño vinculado a la mascota');
        } catch (err) {
            next(err);
        }
    },

    /**
     * GET /pets/:id/owners
     * Returns the list of owners of a pet.
     * Only an existing owner can view this.
     */
    async getOwners(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const petId = req.params.id;
            const requesterId = req.user!.sub;
            // Forward the original Bearer token so the service can call User Service
            const token = req.headers.authorization as string;
            const owners = await petService.getOwners(petId, requesterId, token);
            sendSuccess(res, { owners }, 'Dueños obtenidos correctamente');
        } catch (err) {
            next(err);
        }
    },

    /**
     * DELETE /pets/:petId/owners/:ownerId
     * Removes an owner from a pet.
     * Cannot remove the last owner.
     */
    async removeOwner(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const { petId, ownerId } = req.params;
            const requesterId = req.user!.sub;
            await petService.removeOwner(petId, requesterId, ownerId);
            sendSuccess(res, null, 'Dueño eliminado correctamente');
        } catch (err) {
            next(err);
        }
    },

    /**
     * POST /pets/:id/photo
     * Upload a photo for a pet. Accepts multipart/form-data with field "photo".
     * Only the pet's owner can upload a photo.
     */
    async uploadPhoto(
        req: Request,
        res: Response,
        next: NextFunction,
    ): Promise<void> {
        try {
            const ownerId = req.user!.sub;
            const petId = req.params.id;

            // multer memory storage attaches the file to req.file
            const file = (req as Request & { file?: Express.Multer.File }).file;

            if (!file) {
                sendError(res, 'Se requiere un archivo de imagen (campo "photo")', 400);
                return;
            }

            const result = await petService.uploadPhoto(
                petId,
                ownerId,
                file.buffer,
                file.mimetype,
            );

            sendSuccess(res, result, 'Foto subida correctamente');
        } catch (err) {
            next(err);
        }
    },
};

