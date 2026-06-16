import { Router } from 'express';
import { adminLogin } from '../controllers/auth.controller';
import { deleteUser, listUsers, updateUserStatus } from '../controllers/admin.controller';
import { authenticate, authorize } from '../middlewares/auth';
import { adminLoginRateLimiter } from '../middlewares/rateLimiter';
import { UserRole } from '../types/index';

const adminRouter = Router();

adminRouter.post('/login', adminLoginRateLimiter, adminLogin);
adminRouter.get('/users', authenticate, authorize(UserRole.ADMIN), listUsers);
adminRouter.patch('/users/:userId/status', authenticate, authorize(UserRole.ADMIN), updateUserStatus);
adminRouter.delete('/users/:userId', authenticate, authorize(UserRole.ADMIN), deleteUser);

export default adminRouter;
