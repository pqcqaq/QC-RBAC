import dotenv from 'dotenv';
import path from 'node:path';
import { z } from 'zod';

const envCandidates = [
  process.env.BACKEND_JOBS_ENV_PATH,
  path.resolve(process.cwd(), '.env'),
  path.resolve(process.cwd(), '../backend/.env'),
  path.resolve(process.cwd(), '../../backend/.env'),
  path.resolve(process.cwd(), 'apps/backend/.env'),
].filter((value): value is string => Boolean(value));

for (const envPath of envCandidates) {
  const result = dotenv.config({ path: envPath, override: false });
  if (!result.error) {
    break;
  }
}

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  S3_REGION: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_ACCESS_KEY_SECRET: z.string().optional().default(''),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: z
    .union([z.boolean(), z.string()])
    .optional()
    .default('false')
    .transform((value) => value === true || value === 'true' || value === '1'),
  OSS_REGION: z.string().optional().default(''),
  OSS_BUCKET: z.string().optional().default(''),
  OSS_ACCESS_KEY_ID: z.string().optional().default(''),
  OSS_ACCESS_KEY_SECRET: z.string().optional().default(''),
  OSS_ENDPOINT: z.string().optional().default(''),
  UPLOAD_PUBLIC_BASE_URL: z.string().default('http://localhost:3300/uploads'),
  UPLOAD_RECONCILE_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  UPLOAD_PENDING_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
  UPLOAD_RECONCILE_BATCH_SIZE: z.coerce.number().int().positive().default(100),
});

export const env = envSchema.parse(process.env);
