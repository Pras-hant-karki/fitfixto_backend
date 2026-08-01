export const APP_CONSTANTS = {
  API_BASE_PATH: '/api',
  API_VERSION: 'v1',
  APP_NAME: 'FitFIXto Backend',
} as const;

export const API_PREFIX = `${APP_CONSTANTS.API_BASE_PATH}/${APP_CONSTANTS.API_VERSION}`;

export const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  TOO_MANY_REQUESTS: 429,
  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
} as const;

export const RATE_LIMIT_CONFIG = {
  WINDOW_MS: 15 * 60 * 1000,
  MAX_REQUESTS: process.env.NODE_ENV === 'production' ? 300 : 2000,
  ADMIN_LOGIN_MAX_REQUESTS: process.env.NODE_ENV === 'production' ? 50 : 1000,
} as const;

/**
 * Per-account login throttle, persisted on the user document.
 *
 * This is the primary brute-force control: it is scoped to one account rather than one IP,
 * so a shared network (or a developer reloading the app) cannot lock out everyone. The
 * counters live in MongoDB and can be cleared by hand — see clearLoginAttempts on the User
 * model, or set loginAttempts to 0 and loginLockedUntil to null in Compass.
 */
export const LOGIN_ATTEMPT_POLICY = {
  /** Failed attempts allowed inside one window before the account is locked. */
  MAX_ATTEMPTS: 10,
  /** Rolling window length. */
  WINDOW_MS: 60 * 1000,
  /** How long the account stays locked once the limit is reached. */
  LOCK_MS: 60 * 1000,
} as const;

export const AUTH_RATE_LIMIT = {
  // Coarse per-IP backstop for login. The per-account policy above does the real work, so
  // this only needs to stop bulk credential-stuffing against many different accounts.
  LOGIN_WINDOW_MS: 15 * 60 * 1000,
  LOGIN_MAX: 100,
  // Register: 5 accounts per hour per IP
  REGISTER_WINDOW_MS: 60 * 60 * 1000,
  REGISTER_MAX: 5,
  // Forgot password: 5 requests per hour per IP
  FORGOT_PASSWORD_WINDOW_MS: 60 * 60 * 1000,
  FORGOT_PASSWORD_MAX: 5,
  // Sensitive endpoints (reset-password, verify-email, change-password): 10 per 15 minutes
  SENSITIVE_WINDOW_MS: 15 * 60 * 1000,
  SENSITIVE_MAX: 10,
} as const;
