import { Router } from 'express';
import petRoutes from './pet.routes';

const router = Router();

// Health check – used by API Gateway and load balancers
router.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'pet-service', timestamp: new Date().toISOString() });
});

// Mount domain routes
router.use('/pets', petRoutes);

export default router;
