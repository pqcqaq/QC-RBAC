import { env } from './config/env.js';
import { prisma } from './lib/prisma.js';
import { reconcilePendingUploads } from './services/upload-reconciler.js';

const intervalMs = env.UPLOAD_RECONCILE_INTERVAL_MINUTES * 60 * 1000;
let timer: NodeJS.Timeout | null = null;
let running = false;

const runReconcile = async () => {
  if (running) {
    console.log('[backend-jobs] skip tick: previous reconcile still running');
    return;
  }

  running = true;
  try {
    const result = await reconcilePendingUploads();
    console.log(
      `[backend-jobs] checked=${result.checked} completed=${result.completed} failed=${result.failed} pending=${result.pending}`,
    );
  } finally {
    running = false;
  }
};

const shutdown = async (signal: string) => {
  console.log(`[backend-jobs] received ${signal}, shutting down`);
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', () => {
  void shutdown('SIGINT');
});

process.on('SIGTERM', () => {
  void shutdown('SIGTERM');
});

console.log(
  `[backend-jobs] start upload reconcile worker, interval=${env.UPLOAD_RECONCILE_INTERVAL_MINUTES}m timeout=${env.UPLOAD_PENDING_TIMEOUT_MINUTES}m`,
);

void runReconcile();
timer = setInterval(() => {
  void runReconcile();
}, intervalMs);
