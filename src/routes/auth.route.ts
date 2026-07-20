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
  uploadProfileImage,
} from '../controllers/auth.controller';
import { authenticate } from '../middlewares/auth';
import { uploadProfileImage as uploadProfileImageMiddleware } from '../middlewares/fileUpload';
import {
  authLoginRateLimiter,
  authRegisterRateLimiter,
  authForgotPasswordRateLimiter,
  authSensitiveRateLimiter,
} from '../middlewares/rateLimiter';

const authRouter = Router();

authRouter.post('/register', authRegisterRateLimiter, register);
authRouter.post('/login', authLoginRateLimiter, login);
authRouter.post('/logout', authenticate, logout);
authRouter.get('/me', authenticate, getCurrentUser);
authRouter.put('/profile', authenticate, updateProfile);
authRouter.post('/profile/upload-image', authenticate, uploadProfileImageMiddleware.single('profileImage'), uploadProfileImage);
authRouter.post('/verify-email', authSensitiveRateLimiter, verifyEmail);
authRouter.post('/forgot-password', authForgotPasswordRateLimiter, forgotPassword);
authRouter.post('/reset-password', authSensitiveRateLimiter, resetPassword);
authRouter.post('/change-password', authenticate, authSensitiveRateLimiter, changePassword);

export default authRouter;
