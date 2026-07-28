import cors from 'cors';
import helmet from 'helmet';
import env from '../config/env';

export const securityHeaders = helmet();

export const corsMiddleware = cors({
  origin: env.FRONTEND_URL,
  credentials: true,
  // The session-integrity headers are custom, so they must be explicitly allowed
  // through preflight or browsers will strip them.
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization', 'x-session-state', 'x-session-sig'],
});
