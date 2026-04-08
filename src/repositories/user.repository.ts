// Supabase is no longer imported here as this repo uses HTTP exclusively

// -----------------------------------------------------------------------
// User Repository – read-only queries against the shared users table.
// The Pet Service uses Supabase's service role key, which grants access
// to the users table managed by the User Service.
// -----------------------------------------------------------------------

export interface UserRow {
    id: string;
    email: string;
}

export const userRepository = {
    /**
     * Find a user by email address.
     * Returns the id + email, or null if not found.
     */
    async findByEmail(email: string, token: string): Promise<UserRow | null> {
        try {
            const response = await fetch(
                `${process.env.USER_SERVICE_URL || 'http://localhost:3003'}/api/v1/users/by-email?email=${encodeURIComponent(email)}`,
                {
                    headers: {
                        Authorization: token,
                    },
                },
            );

            if (!response.ok) {
                return null;
            }

            const data = (await response.json()) as { data: { id: string; email: string } };
            return { id: data.data.id, email: data.data.email };
        } catch {
            return null;
        }
    },
};
