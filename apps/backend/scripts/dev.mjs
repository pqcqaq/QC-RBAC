import { spawn } from 'node:child_process';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const backendDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const children = new Set();
let shuttingDown = false;

const spawnPnpm = (args, options = {}) => {
  const command = process.platform === 'win32' ? 'cmd.exe' : 'pnpm';
  const commandArgs = process.platform === 'win32'
    ? ['/d', '/s', '/c', 'pnpm', ...args]
    : args;

  const child = spawn(command, commandArgs, {
    cwd: backendDir,
    env: process.env,
    stdio: 'inherit',
    detached: process.platform !== 'win32',
    windowsHide: true,
    ...options,
  });

  children.add(child);
  child.once('exit', () => {
    children.delete(child);
  });

  return child;
};

const runPnpmOnce = (args) =>
  new Promise((resolve, reject) => {
    const child = spawnPnpm(args, { detached: false });

    child.once('error', reject);
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`pnpm ${args.join(' ')} exited with code=${code ?? 'null'} signal=${signal ?? 'null'}`));
    });
  });

const terminateChild = async (child) => {
  if (!child.pid || child.exitCode !== null || child.signalCode !== null) {
    return;
  }

  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], {
        stdio: 'ignore',
        windowsHide: true,
      });

      killer.once('error', () => resolve());
      killer.once('exit', () => resolve());
    });
    return;
  }

  try {
    process.kill(-child.pid, 'SIGTERM');
  } catch {
    try {
      child.kill('SIGTERM');
    } catch {
      return;
    }
  }
};

const shutdown = async (exitCode) => {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;
  console.log('[backend-dev] shutting down watchers');

  await Promise.allSettled([...children].map((child) => terminateChild(child)));
  process.exit(exitCode);
};

const onWatcherExit = (name, child) => {
  child.once('exit', (code, signal) => {
    if (shuttingDown) {
      return;
    }

    const normalizedCode = code ?? 1;
    console.error(
      `[backend-dev] ${name} stopped unexpectedly (code=${normalizedCode} signal=${signal ?? 'null'})`,
    );
    void shutdown(normalizedCode);
  });
};

process.on('SIGINT', () => {
  void shutdown(0);
});

process.on('SIGTERM', () => {
  void shutdown(0);
});

console.log('[backend-dev] generating Prisma client');
await runPnpmOnce(['exec', 'prisma', 'generate']);

console.log('[backend-dev] starting Prisma schema watcher');
const prismaWatcher = spawnPnpm(['exec', 'prisma', 'generate', '--watch']);
onWatcherExit('prisma generate --watch', prismaWatcher);

console.log('[backend-dev] starting backend hot-reload watcher');
const serverWatcher = spawnPnpm([
  'exec',
  'tsx',
  'watch',
  '--clear-screen=false',
  '--include',
  'prisma/**/*.prisma',
  '--include',
  'prisma/generated/**/*.ts',
  '--include',
  '.env',
  'src/main.ts',
]);
onWatcherExit('tsx watch', serverWatcher);
