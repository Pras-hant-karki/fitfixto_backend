import { Router } from 'express';
import { adminLogin } from '../controllers/auth.controller';
import { adminLoginRateLimiter } from '../middlewares/rateLimiter';

const adminRouter = Router();

adminRouter.post('/login', adminLoginRateLimiter, adminLogin);

export default adminRouter;
