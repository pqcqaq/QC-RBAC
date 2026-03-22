import Redis from 'ioredis';
import { env } from '../config/env';

let ready = false;

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  maxRetriesPerRequest: 1,
});

export const ensureRedisConnection = async () => {
  if (ready) {
    return true;
  }

  try {
    await redis.connect();
    ready = true;
    return true;
  } catch (error) {
    console.warn('[redis] unavailable, running in degraded mode');
    return false;
  }
};

export const cacheGet = async (key: string) => {
  if (!(await ensureRedisConnection())) {
    return null;
  }
  return redis.get(key);
};

export const cacheSet = async (key: string, value: string, seconds: number) => {
  if (!(await ensureRedisConnection())) {
    return;
  }
  await redis.set(key, value, 'EX', seconds);
};

export const cacheDel = async (...keys: string[]) => {
  if (!keys.length || !(await ensureRedisConnection())) {
    return;
  }
  await redis.del(...keys);
};

export const closeRedisConnection = async () => {
  ready = false;

  if (redis.status === 'end') {
    return;
  }

  try {
    await redis.quit();
  } catch {
    redis.disconnect();
  }
};
