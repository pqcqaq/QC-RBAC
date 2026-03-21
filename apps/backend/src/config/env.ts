import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3300),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('2h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  AUTH_WEB_CLIENT_SECRET: z.string().min(16).default('rbac-web-client-secret'),
  AUTH_UNI_WECHAT_MINIAPP_CLIENT_SECRET: z.string().min(16).default('rbac-uni-miniapp-secret'),
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
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
});

export const env = envSchema.parse(process.env);

export const clientOrigins = env.CLIENT_ORIGIN.split(',')
  .map((item) => item.trim())
  .filter(Boolean);
