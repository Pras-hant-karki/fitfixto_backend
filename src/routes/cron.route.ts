import { Router } from 'express';
import { cleanupPendingOrders } from '../controllers/cron.controller';

const router = Router();

router.post('/cleanup-pending-orders', cleanupPendingOrders);

export default router;
