import { Router } from 'express';
import { register, login, logout, getCurrentUser } from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', authenticate, logout);
authRouter.get('/me', authenticate, getCurrentUser);

export default authRouter;
