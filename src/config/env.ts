import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(5000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  MONGODB_URI: z.string().min(1),
  MONGODB_TEST_URI: z.string().min(1).default('mongodb://localhost:27017/fitfixto-test'),
  JWT_SECRET: z.string().min(10),
  JWT_EXPIRY: z.string().default('7d'),
  JWT_REFRESH_SECRET: z.string().min(10),
  JWT_REFRESH_EXPIRY: z.string().default('30d'),
  EMAIL_HOST: z.string().default('smtp.gmail.com'),
  EMAIL_PORT: z.coerce.number().int().positive().default(587),
  EMAIL_USER: z.string().default(''),
  EMAIL_PASSWORD: z.string().default(''),
  EMAIL_FROM: z.string().default('noreply@fitfixto.com'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().int().positive().default(5242880),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;

export default env;
