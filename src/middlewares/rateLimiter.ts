import rateLimit from 'express-rate-limit';
import { AUTH_RATE_LIMIT, RATE_LIMIT_CONFIG } from '../constants/app.constants';

export const apiRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => process.env.NODE_ENV !== 'production' && req.method === 'GET',
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.',
  },
});

export const adminLoginRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.ADMIN_LOGIN_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many admin login attempts. Please try again later.',
  },
});

// Brute-force protection for customer/trainer login
export const authLoginRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.LOGIN_WINDOW_MS,
  max: AUTH_RATE_LIMIT.LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again in 15 minutes.',
  },
});

// Prevent mass account creation
export const authRegisterRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.REGISTER_WINDOW_MS,
  max: AUTH_RATE_LIMIT.REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many registration attempts from this IP. Please try again in an hour.',
  },
});

// Prevent email enumeration via password reset flooding
export const authForgotPasswordRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.FORGOT_PASSWORD_WINDOW_MS,
  max: AUTH_RATE_LIMIT.FORGOT_PASSWORD_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again in an hour.',
  },
});

// General sensitive auth actions (token use endpoints)
export const authSensitiveRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.SENSITIVE_WINDOW_MS,
  max: AUTH_RATE_LIMIT.SENSITIVE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again in 15 minutes.',
  },
});
