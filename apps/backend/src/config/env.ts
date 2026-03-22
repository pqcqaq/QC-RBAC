import 'dotenv/config';
import { z } from 'zod';

const booleanFromEnv = (defaultValue: boolean) =>
  z
    .union([z.boolean(), z.string()])
    .optional()
    .default(defaultValue ? 'true' : 'false')
    .transform((value) => value === true || value === 'true' || value === '1');

const envSchema = z.object({
  PORT: z.coerce.number().default(3300),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://127.0.0.1:6379'),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default('2h'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  OAUTH_ISSUER: z.string().default('http://localhost:3300'),
  OAUTH_ACCESS_TOKEN_EXPIRES_IN: z.string().default('30m'),
  OAUTH_AUTHORIZATION_CODE_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(300),
  OAUTH_REFRESH_TOKEN_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(2592000),
  OAUTH_STATE_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(600),
  OAUTH_LOGIN_TICKET_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(180),
  OAUTH_TOKEN_ENCRYPTION_SECRET: z.string().optional().default(''),
  OIDC_KID: z.string().default('rbac-oidc-main'),
  OIDC_PRIVATE_KEY: z.string().optional().default(''),
  OIDC_PUBLIC_KEY: z.string().optional().default(''),
  BROWSER_SESSION_COOKIE_NAME: z.string().default('rbac_browser_access_token'),
  OAUTH_UPSTREAM_REFRESH_ENABLED: booleanFromEnv(true),
  OAUTH_UPSTREAM_REFRESH_RUN_ON_START: booleanFromEnv(true),
  OAUTH_UPSTREAM_REFRESH_INTERVAL_MINUTES: z.coerce.number().int().positive().default(5),
  OAUTH_UPSTREAM_REFRESH_BATCH_SIZE: z.coerce.number().int().positive().default(50),
  SNOWFLAKE_NODE_ID: z.coerce.number().int().min(0).max(1023).default(1),
  SNOWFLAKE_EPOCH: z.coerce.number().int().positive().default(1704067200000),
  S3_REGION: z.string().optional().default(''),
  S3_BUCKET: z.string().optional().default(''),
  S3_ACCESS_KEY_ID: z.string().optional().default(''),
  S3_ACCESS_KEY_SECRET: z.string().optional().default(''),
  S3_ENDPOINT: z.string().optional().default(''),
  S3_PUBLIC_BASE_URL: z.string().optional().default(''),
  S3_FORCE_PATH_STYLE: booleanFromEnv(false),
  OSS_REGION: z.string().optional().default(''),
  OSS_BUCKET: z.string().optional().default(''),
  OSS_ACCESS_KEY_ID: z.string().optional().default(''),
  OSS_ACCESS_KEY_SECRET: z.string().optional().default(''),
  OSS_ENDPOINT: z.string().optional().default(''),
  UPLOAD_PUBLIC_BASE_URL: z.string().default('http://localhost:3300/uploads'),
  UPLOAD_RECONCILE_ENABLED: booleanFromEnv(true),
  UPLOAD_RECONCILE_RUN_ON_START: booleanFromEnv(true),
  UPLOAD_RECONCILE_INTERVAL_MINUTES: z.coerce.number().int().positive().default(60),
  UPLOAD_PENDING_TIMEOUT_MINUTES: z.coerce.number().int().positive().default(60),
  UPLOAD_RECONCILE_BATCH_SIZE: z.coerce.number().int().positive().default(100),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173,http://127.0.0.1:5173,http://localhost:4173,http://127.0.0.1:4173,http://localhost:9000,http://127.0.0.1:9000,http://localhost:3300,http://127.0.0.1:3300'),
});

export const env = envSchema.parse(process.env);

export const clientOrigins = env.CLIENT_ORIGIN.split(',')
  .map((item) => item.trim())
  .filter(Boolean);

