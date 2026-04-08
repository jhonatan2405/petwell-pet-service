import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt.util';
import { sendError } from '../utils/response.util';
import { JwtPayload } from '../models/pet.model';

// Extend Express Request to carry the authenticated user payload
declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

/**
 * Middleware that validates the Bearer JWT in the Authorization header.
 * Attaches the decoded payload to req.user on success.
 */
export const authenticate = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const authHeader = req.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
        sendError(res, 'Cabecera de autorización faltante o incorrecta', 401);
        return;
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
        sendError(res, 'Token no proporcionado', 401);
        return;
    }

    try {
        const decoded = verifyToken(token);
        req.user = decoded;
        next();
    } catch (err: unknown) {
        const message =
            err instanceof Error && err.name === 'TokenExpiredError'
                ? 'El token ha expirado'
                : 'Token inválido';
        sendError(res, message, 401);
    }
};

/**
 * Middleware that checks if the authenticated user has one of the required roles.
 */
export const authorize = (...roles: string[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user || !roles.includes(req.user.role)) {
            sendError(res, 'No tienes permisos para realizar esta acción', 403);
            return;
        }
        next();
    };
};
