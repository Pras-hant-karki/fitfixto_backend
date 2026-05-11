import { Router } from 'express';
import {
  register,
  login,
  logout,
  getCurrentUser,
  verifyEmail,
  forgotPassword,
  resetPassword,
  changePassword,
  updateProfile,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';

const authRouter = Router();

authRouter.post('/register', register);
authRouter.post('/login', login);
authRouter.post('/logout', authenticate, logout);
authRouter.get('/me', authenticate, getCurrentUser);
authRouter.put('/profile', authenticate, updateProfile);
authRouter.post('/verify-email', verifyEmail);
authRouter.post('/forgot-password', forgotPassword);
authRouter.post('/reset-password', resetPassword);
authRouter.post('/change-password', authenticate, changePassword);

export default authRouter;
