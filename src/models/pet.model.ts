// =============================================
// PetWell Pet Service - Domain Models & Types
// =============================================

// --- Database Row Shape (matches Supabase table) ---

export interface PetRow {
    id: string;
    // owner_id removed — ownership is in pet_owners table
    name: string;
    species: string;
    breed: string | null;
    birth_date: string | null;
    sex: string | null;
    weight: number | null;
    microchip: string | null;
    allergies: string | null;
    primary_clinic_id: string | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
}

// --- Join table row shape ---

export interface PetOwnerRow {
    pet_id: string;
    owner_id: string;
}

// --- Application-level DTOs ---

export interface CreatePetDto {
    name: string;
    species: string;
    breed?: string;
    birth_date?: string;
    sex?: string;
    weight?: number;
    microchip?: string;
    allergies?: string;
    primary_clinic_id?: string;
}

export interface UpdatePetDto {
    name?: string;
    species?: string;
    breed?: string;
    birth_date?: string;
    sex?: string;
    weight?: number;
    microchip?: string;
    allergies?: string;
    primary_clinic_id?: string;
    photo_url?: string;
}

// --- API Response Shape ---

export interface PetPublicProfile {
    id: string;
    owner_ids: string[];           // replaces the former single owner_id
    name: string;
    species: string;
    breed: string | null;
    birth_date: string | null;
    sex: string | null;
    weight: number | null;
    microchip: string | null;
    allergies: string | null;
    primary_clinic_id: string | null;
    photo_url: string | null;
    created_at: string;
    updated_at: string;
}

// --- JWT Payload (mirrors User Service shape) ---

export interface JwtPayload {
    sub: string;        // user_id — used as owner_id in pet_owners
    email: string;
    role: string;
    clinic_id?: string | null;
    iat?: number;
    exp?: number;
}
