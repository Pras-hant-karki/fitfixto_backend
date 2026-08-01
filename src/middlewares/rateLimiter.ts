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

// Per-account throttling (see LOGIN_ATTEMPT_POLICY and the User model) is the primary
// brute-force control for both login routes. These IP limiters are only a coarse backstop
// against credential stuffing across many accounts, so they are skipped outside production —
// a shared office IP or a developer reloading the app should never trip them.
const skipOutsideProduction = () => process.env.NODE_ENV !== 'production';

export const adminLoginRateLimiter = rateLimit({
  windowMs: RATE_LIMIT_CONFIG.WINDOW_MS,
  max: RATE_LIMIT_CONFIG.ADMIN_LOGIN_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: {
    success: false,
    message: 'Too many admin login attempts. Please try again later.',
  },
});

export const authLoginRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.LOGIN_WINDOW_MS,
  max: AUTH_RATE_LIMIT.LOGIN_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: {
    success: false,
    message: 'Too many login attempts from this IP. Please try again later.',
  },
});

// Prevent mass account creation
export const authRegisterRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.REGISTER_WINDOW_MS,
  max: AUTH_RATE_LIMIT.REGISTER_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
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
  skip: skipOutsideProduction,
  message: {
    success: false,
    message: 'Too many password reset requests. Please try again in an hour.',
  },
});

// General sensitive auth actions. This also covers /auth/refresh, which the client calls
// automatically — throttling it in development turns a normal token refresh into a forced
// sign-out, so it is skipped outside production like the other IP backstops.
export const authSensitiveRateLimiter = rateLimit({
  windowMs: AUTH_RATE_LIMIT.SENSITIVE_WINDOW_MS,
  max: AUTH_RATE_LIMIT.SENSITIVE_MAX,
  standardHeaders: true,
  legacyHeaders: false,
  skip: skipOutsideProduction,
  message: {
    success: false,
    message: 'Too many requests. Please try again in 15 minutes.',
  },
});
