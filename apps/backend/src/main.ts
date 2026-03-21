import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { prisma } from './lib/prisma.js';
import { ensureRedisConnection } from './lib/redis.js';
import { initSocket } from './lib/socket.js';
import { bootstrapSystemRbac } from './services/system-rbac.js';

const uploadRoot = path.resolve(process.cwd(), 'uploads', 'avatars');
fs.mkdirSync(uploadRoot, { recursive: true });

const app = createApp();
const server = http.createServer(app);

void ensureRedisConnection();
initSocket(server);

void bootstrapSystemRbac(prisma)
  .then(() => {
    server.listen(env.PORT, () => {
      console.log(`[backend] http://localhost:${env.PORT}`);
    });
  })
  .catch((error: unknown) => {
    console.error('[backend] bootstrap failed', error);
    process.exit(1);
  });
