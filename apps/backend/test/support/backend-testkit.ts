import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AuthClientType, buildAuthClientHeaders } from '@rbac/api-common';
import ExcelJS from 'exceljs';
import type { Express } from 'express';
import type { PrismaClient } from '../../src/lib/prisma-generated';
import { waitForPendingRequestAuditFlushes } from '../../src/lib/request-audit-flush-queue';
import request from 'supertest';

export type BackendTestContext = {
  app: Express;
  prisma: PrismaClient;
  prismaRaw: PrismaClient;
  seedDatabase: (prisma: PrismaClient) => Promise<void>;
};

export type TestSession = {
  tokens: { accessToken: string; refreshToken: string };
  client: { code: string; name: string; type: string };
  user: { id: string; permissions: string[] };
};

type WebTestClient = {
  code: string;
  secret: string;
  type: AuthClientType.WEB;
  origin: string;
};

type UniMiniappTestClient = {
  code: string;
  secret: string;
  type: AuthClientType.UNI_WECHAT_MINIAPP;
  appId: string;
};

type NativeAppTestClient = {
  code: string;
  secret: string;
  type: AuthClientType.APP;
  packageName: string;
  platform: string;
};

const deriveTestDatabaseUrl = () => {
  const source = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!source) {
    throw new Error('DATABASE_URL is required for tests');
  }

  const url = new URL(source);
  const databaseName = url.pathname.replace(/^\//, '');
  url.pathname = `/${databaseName}_test`;
  return url.toString();
};

export const testDatabaseUrl = deriveTestDatabaseUrl();
process.env.DATABASE_URL = testDatabaseUrl;

const backendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export const webClient: WebTestClient = {
  code: 'web-console',
  secret: 'rbac-web-client-secret',
  type: AuthClientType.WEB,
  origin: 'http://localhost:5173',
};

export const webH5Client: WebTestClient = {
  code: 'web-uni-h5',
  secret: 'rbac-web-uni-h5-secret',
  type: AuthClientType.WEB,
  origin: 'http://localhost:9000',
};

export const uniClient: UniMiniappTestClient = {
  code: 'uni-wechat-miniapp',
  secret: 'rbac-uni-miniapp-secret',
  type: AuthClientType.UNI_WECHAT_MINIAPP,
  appId: 'wx-demo-miniapp-appid',
};

export const appClient: NativeAppTestClient = {
  code: 'native-app',
  secret: 'rbac-native-app-secret',
  type: AuthClientType.APP,
  packageName: 'com.example.rbac',
  platform: 'android',
};

export type BackendTestClient = WebTestClient | UniMiniappTestClient | NativeAppTestClient;

type SupertestBinaryParser = Exclude<
  Parameters<InstanceType<typeof request.Test>['parse']>[0],
  (input: string) => unknown
>;

type ExcelWorkbookLoadInput = Parameters<ExcelJS.Workbook['xlsx']['load']>[0];

let mockProviderServer: http.Server | null = null;
let mockProviderBaseUrl: string | null = null;

const execPrisma = (...args: string[]) => {
  const result = spawnSync(`pnpm exec prisma ${args.join(' ')}`, {
    cwd: backendRoot,
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    encoding: 'utf8',
    shell: true,
  });

  if (result.status !== 0) {
    throw new Error([result.stdout, result.stderr].filter(Boolean).join('\n'));
  }
};

const startMockOAuthProvider = async () => {
  if (mockProviderServer && mockProviderBaseUrl) {
    return;
  }

  let refreshCounter = 0;
  const server = http.createServer(async (req, res) => {
    const requestUrl = new URL(req.url ?? '/', mockProviderBaseUrl ?? 'http://127.0.0.1');

    if (req.method === 'POST' && requestUrl.pathname === '/oauth2/token') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }

      const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'));
      if (form.get('grant_type') === 'refresh_token' && form.get('refresh_token') !== 'upstream-refresh-fixed') {
        res.statusCode = 400;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({
          error: 'invalid_grant',
          error_description: 'refresh token is invalid',
        }));
        return;
      }

      const responseBody = form.get('grant_type') === 'refresh_token'
        ? {
            access_token: `upstream-access-refreshed-${++refreshCounter}`,
            refresh_token: 'upstream-refresh-fixed',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email offline_access',
          }
        : {
            access_token: 'upstream-access-initial',
            refresh_token: 'upstream-refresh-fixed',
            token_type: 'Bearer',
            expires_in: 3600,
            scope: 'openid profile email offline_access',
          };

      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify(responseBody));
      return;
    }

    if (req.method === 'GET' && requestUrl.pathname === '/oauth2/userinfo') {
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(JSON.stringify({
        sub: 'demo-upstream-user',
        preferred_username: 'upstream_admin',
        name: 'Upstream Admin',
        email: 'admin@example.com',
        picture: 'https://example.com/avatar.png',
      }));
      return;
    }

    res.statusCode = 404;
    res.end();
  });

  await new Promise<void>((resolve, reject) => {
    const handleError = (error: Error) => {
      server.off('listening', handleListening);
      reject(error);
    };
    const handleListening = () => {
      server.off('error', handleError);
      resolve();
    };

    server.once('error', handleError);
    server.once('listening', handleListening);
    server.listen(0, '127.0.0.1');
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
    throw new Error('Failed to resolve mock OAuth provider port');
  }

  mockProviderServer = server;
  mockProviderBaseUrl = `http://127.0.0.1:${address.port}`;
};

const stopMockOAuthProvider = async () => {
  if (!mockProviderServer) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    mockProviderServer?.close((error) => (error ? reject(error) : resolve()));
  });
  mockProviderServer = null;
  mockProviderBaseUrl = null;
};

const syncMockOAuthProviderConfig = async (prisma: PrismaClient) => {
  if (!mockProviderBaseUrl) {
    return;
  }

  await prisma.oAuthProvider.updateMany({
    where: { code: 'demo-provider' },
    data: {
      issuer: mockProviderBaseUrl,
      discoveryUrl: `${mockProviderBaseUrl}/.well-known/openid-configuration`,
      authorizationEndpoint: `${mockProviderBaseUrl}/oauth2/authorize`,
      tokenEndpoint: `${mockProviderBaseUrl}/oauth2/token`,
      userinfoEndpoint: `${mockProviderBaseUrl}/oauth2/userinfo`,
    },
  });
};

export const bootstrapBackendTestContext = async (options?: { mockOAuthProvider?: boolean }) => {
  process.env.DATABASE_URL = testDatabaseUrl;
  await waitForPendingRequestAuditFlushes();
  execPrisma('db', 'push', '--force-reset', '--accept-data-loss');

  const [{ createApp }, prismaModule, { seedDatabase }] = await Promise.all([
    import('../../src/app'),
    import('../../src/lib/prisma'),
    import('../../prisma/seed-data'),
  ]);

  if (options?.mockOAuthProvider) {
    await startMockOAuthProvider();
  }

  return {
    app: createApp(),
    prisma: prismaModule.prisma,
    prismaRaw: prismaModule.prismaRaw,
    seedDatabase,
  } satisfies BackendTestContext;
};

export const reseedBackendTestContext = async (context: BackendTestContext) => {
  await waitForPendingRequestAuditFlushes();
  await context.seedDatabase(context.prisma);
  await syncMockOAuthProviderConfig(context.prisma);
};

export const teardownBackendTestContext = async (context?: BackendTestContext) => {
  await waitForPendingRequestAuditFlushes();
  await stopMockOAuthProvider();
  if (!context) {
    return;
  }
  await context.prisma.$disconnect();
  await context.prismaRaw.$disconnect();

  const { closeRedisConnection } = await import('../../src/lib/redis');
  await closeRedisConnection();
};

export const withClientAuth = (
  target: request.Test,
  client: BackendTestClient = webClient,
) => {
  const headers = client.type === AuthClientType.UNI_WECHAT_MINIAPP
    ? buildAuthClientHeaders({
        code: client.code,
        secret: client.secret,
        type: client.type,
        config: {
          appId: client.appId,
        },
      })
    : client.type === AuthClientType.APP
      ? buildAuthClientHeaders({
          code: client.code,
          secret: client.secret,
          type: client.type,
          config: {
            packageName: client.packageName,
            platform: client.platform,
          },
        })
      : buildAuthClientHeaders({
          code: client.code,
          secret: client.secret,
          type: client.type,
        });

  Object.entries(headers).forEach(([key, value]) => {
    target = target.set(key, value);
  });

  if (client.type === AuthClientType.WEB) {
    target = target.set('Origin', client.origin);
  }

  return target;
};

export const binaryParser: SupertestBinaryParser = (res, callback) => {
  const chunks: Buffer[] = [];
  res.on('data', (chunk: ArrayBufferLike) => {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  });
  res.on('end', () => callback(null, Buffer.concat(chunks)));
  res.on('error', (error: Error) => callback(error, undefined));
};

export const loadWorksheet = async (buffer: Buffer) => {
  const workbook = new ExcelJS.Workbook();
  const workbookBuffer = buffer as unknown as ExcelWorkbookLoadInput;
  await workbook.xlsx.load(workbookBuffer);

  const worksheet = workbook.worksheets[0];
  assert.ok(worksheet);
  return worksheet;
};

export const uploadManagedFileForTest = async (
  app: Express,
  input: {
    accessToken: string;
    fileName: string;
    contentType: string;
    content: string;
    kind?: 'avatar' | 'attachment';
    tag1?: string;
    tag2?: string;
  },
) => {
  const prepareResponse = await request(app)
    .post('/api/files/presign')
    .set('Authorization', `Bearer ${input.accessToken}`)
    .send({
      kind: input.kind ?? 'attachment',
      fileName: input.fileName,
      contentType: input.contentType,
      size: Buffer.byteLength(input.content),
      tag1: input.tag1,
      tag2: input.tag2,
    })
    .expect(200);

  const localUploadTarget = new URL(prepareResponse.body.data.parts[0].url);
  await request(app)
    .post(localUploadTarget.pathname)
    .field('token', prepareResponse.body.data.parts[0].fields.token)
    .attach('file', Buffer.from(input.content), input.fileName)
    .expect(204);

  const uploadResponse = await request(app)
    .post('/api/files/callback')
    .set('Authorization', `Bearer ${input.accessToken}`)
    .send({ fileId: prepareResponse.body.data.fileId })
    .expect(200);

  return {
    fileId: prepareResponse.body.data.fileId as string,
    url: uploadResponse.body.data.url as string,
  };
};

export const loginAs = async (
  app: Express,
  account: string,
  password: string,
  client: BackendTestClient = webClient,
) => {
  const response = await withClientAuth(request(app).post('/api/auth/login'), client)
    .send({ account, password })
    .expect(200);

  return response.body.data as TestSession;
};
