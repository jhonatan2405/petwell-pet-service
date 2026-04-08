import { Router } from 'express';
import multer from 'multer';
import { body } from 'express-validator';
import { petController } from '../controllers/pet.controller';
import { authenticate, authorize } from '../middlewares/auth.middleware';
import { validate } from '../middlewares/validate.middleware';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });


// All routes require authentication — owner_id is ALWAYS read from JWT

// POST /pets — Register a new pet
router.post(
    '/',
    authenticate,
    [
        body('name')
            .trim()
            .notEmpty()
            .withMessage('El nombre de la mascota es requerido'),
        body('species')
            .trim()
            .notEmpty()
            .withMessage('La especie de la mascota es requerida'),
        body('breed')
            .optional()
            .trim(),
        body('birth_date')
            .optional()
            .isISO8601()
            .withMessage('La fecha de nacimiento debe estar en formato ISO 8601 (YYYY-MM-DD)'),
        body('sex')
            .optional()
            .isIn(['macho', 'hembra', 'male', 'female'])
            .withMessage('El sexo debe ser: macho, hembra, male o female'),
        body('weight')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('El peso debe ser un número positivo'),
        body('microchip')
            .optional()
            .trim(),
        body('allergies')
            .optional()
            .trim(),
        body('primary_clinic_id')
            .optional()
            .isUUID()
            .withMessage('primary_clinic_id debe ser un UUID válido'),
    ],
    validate,
    petController.createPet,
);

// GET /pets — List all pets of the authenticated owner
router.get('/', authenticate, petController.getMyPets);

// GET /pets/clinic — Get a list of pets belonging to the authenticated user's clinic
router.get(
    '/clinic',
    authenticate,
    authorize('CLINIC_ADMIN', 'VETERINARIO', 'RECEPCIONISTA'),
    petController.getPetsByClinic,
);

// GET /pets/:id — Get a specific pet (must belong to authenticated owner)
router.get('/:id', authenticate, petController.getPetById);

// PUT /pets/:id — Update pet data (must belong to authenticated owner)
router.put(
    '/:id',
    authenticate,
    [
        body('name')
            .optional()
            .trim()
            .notEmpty()
            .withMessage('El nombre no puede estar vacío'),
        body('species')
            .optional()
            .trim()
            .notEmpty()
            .withMessage('La especie no puede estar vacía'),
        body('breed')
            .optional()
            .trim(),
        body('birth_date')
            .optional()
            .isISO8601()
            .withMessage('La fecha de nacimiento debe estar en formato ISO 8601 (YYYY-MM-DD)'),
        body('sex')
            .optional()
            .isIn(['macho', 'hembra', 'male', 'female'])
            .withMessage('El sexo debe ser: macho, hembra, male o female'),
        body('weight')
            .optional()
            .isFloat({ min: 0 })
            .withMessage('El peso debe ser un número positivo'),
        body('microchip')
            .optional()
            .trim(),
        body('allergies')
            .optional()
            .trim(),
        body('primary_clinic_id')
            .optional()
            .isUUID()
            .withMessage('primary_clinic_id debe ser un UUID válido'),
    ],
    validate,
    petController.updatePet,
);

// DELETE /pets/:id — Delete a pet (must belong to authenticated owner)
router.delete('/:id', authenticate, petController.deletePet);

// POST /pets/:id/owners — Add a new owner to the pet (by email)
router.post(
    '/:id/owners',
    authenticate,
    [
        body('email')
            .isEmail()
            .withMessage('Se requiere un email válido'),
    ],
    validate,
    petController.addOwner,
);

// GET /pets/:id/owners — List all owners of a pet
router.get('/:id/owners', authenticate, petController.getOwners);

// DELETE /pets/:petId/owners/:ownerId — Remove an owner from a pet
router.delete('/:petId/owners/:ownerId', authenticate, petController.removeOwner);

// POST /pets/:id/photo — Upload a photo (multipart/form-data, field: "photo")
router.post(
    '/:id/photo',
    authenticate,
    upload.single('photo'),
    petController.uploadPhoto,
);

export default router;

