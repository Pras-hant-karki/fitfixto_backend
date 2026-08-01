import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // MongoDB — accepts MONGODB_URL (preferred) or legacy MONGODB_URI
  MONGODB_URL: z.string().min(1).optional(),
  MONGODB_URI: z.string().min(1).optional(),
  DB_NAME: z.string().default('FitFIXto'),

  // JWT — new names preferred, old names as fallback
  ACCESS_TOKEN_SECRET: z.string().min(10).optional(),
  JWT_SECRET: z.string().min(10).optional(),
  ACCESS_TOKEN_EXPIRY: z.string().default('20d'),
  JWT_EXPIRY: z.string().optional(),

  REFRESH_TOKEN_SECRET: z.string().min(10).optional(),
  JWT_REFRESH_SECRET: z.string().min(10).optional(),
  REFRESH_TOKEN_EXPIRY: z.string().default('20d'),
  JWT_REFRESH_EXPIRY: z.string().optional(),

  // Email
  EMAIL_HOST: z.string().default('smtp.gmail.com'),
  EMAIL_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_USER: z.string().default(''),
  EMAIL_PASS: z.string().default(''),
  EMAIL_PASSWORD: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@fitfixto.com'),

  // App
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(10485760),

  // Scheduled jobs
  CRON_SECRET: z.string().default(''),

  // Google Maps (server-side usage, e.g. Places API)
  GOOGLE_MAPS_API_KEY: z.string().default(''),

  // Stripe
  STRIPE_SECRET_KEY: z.string().default(''),
  STRIPE_WEBHOOK_SECRET: z.string().default(''),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const raw = parsed.data;

// Resolve aliases so the rest of the codebase uses a single stable name
const MONGODB_URL = raw.MONGODB_URL || raw.MONGODB_URI || '';
if (!MONGODB_URL) {
  console.error('Missing required env: MONGODB_URL (or MONGODB_URI)');
  process.exit(1);
}

const ACCESS_TOKEN_SECRET = raw.ACCESS_TOKEN_SECRET || raw.JWT_SECRET || '';
if (!ACCESS_TOKEN_SECRET) {
  console.error('Missing required env: ACCESS_TOKEN_SECRET (or JWT_SECRET)');
  process.exit(1);
}

const REFRESH_TOKEN_SECRET = raw.REFRESH_TOKEN_SECRET || raw.JWT_REFRESH_SECRET || '';
if (!REFRESH_TOKEN_SECRET) {
  console.error('Missing required env: REFRESH_TOKEN_SECRET (or JWT_REFRESH_SECRET)');
  process.exit(1);
}

const env = {
  ...raw,
  MONGODB_URL,
  DB_NAME: raw.DB_NAME,
  ACCESS_TOKEN_SECRET,
  ACCESS_TOKEN_EXPIRY: raw.ACCESS_TOKEN_EXPIRY || raw.JWT_EXPIRY || '20d',
  REFRESH_TOKEN_SECRET,
  REFRESH_TOKEN_EXPIRY: raw.REFRESH_TOKEN_EXPIRY || raw.JWT_REFRESH_EXPIRY || '20d',
};

export default env;
