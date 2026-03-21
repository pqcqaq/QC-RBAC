import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { closeRedisConnection, ensureRedisConnection } from './lib/redis.js';
import { initSocket } from './lib/socket.js';
import { bootstrapSystemRbac } from './services/system-rbac.js';
import { createBackendTimerRegistry } from './timers/index.js';

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(uploadRoot, { recursive: true });

const app = createApp();
const server = http.createServer(app);
const timers = createBackendTimerRegistry();
let shuttingDown = false;

const closeHttpServer = () =>
  new Promise<void>((resolve, reject) => {
    if (!server.listening) {
      resolve();
      return;
    }

    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });

const shutdown = async (signal: string) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log(`[backend] received ${signal}, shutting down`);
  timers.stop();

  try {
    await closeHttpServer();
  } catch (error) {
    console.error('[backend] server close failed', error);
  }

  await Promise.allSettled([
    closeRedisConnection(),
    prisma.$disconnect(),
  ]);
  process.exit(0);
};

void ensureRedisConnection();
initSocket(server);

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

void bootstrapSystemRbac(prisma)
  .then(() => {
    server.listen(env.PORT, () => {
      console.log(`[backend] http://localhost:${env.PORT}`);
      timers.start();
    });
  })
  .catch(async (error: unknown) => {
    console.error('[backend] bootstrap failed', error);
    timers.stop();
    await Promise.allSettled([
      closeRedisConnection(),
      prisma.$disconnect(),
    ]);
    process.exit(1);
  });
