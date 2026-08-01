import cors from 'cors';
import helmet from 'helmet';

export const securityHeaders = helmet();

export const corsMiddleware = cors({
  origin: '*',
  credentials: true,
});
