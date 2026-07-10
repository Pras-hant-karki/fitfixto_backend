import cors from 'cors';
import helmet from 'helmet';
import env from '../config/env';

export const securityHeaders = helmet();

export const corsMiddleware = cors({
  origin: env.FRONTEND_URL,
  credentials: true,
});
