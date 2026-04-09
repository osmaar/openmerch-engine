import type { ConnectionOptions } from 'bullmq';
import { config } from '../config.js';

// Parse the redis URL into BullMQ-compatible connection options.
// BullMQ uses ioredis internally, which accepts host/port/password/db.
function parseRedisUrl(url: string): ConnectionOptions {
  const u = new URL(url);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    password: u.password || undefined,
    db: u.pathname && u.pathname !== '/' ? Number(u.pathname.slice(1)) : 0,
    // Required by BullMQ for blocking commands (workers).
    maxRetriesPerRequest: null,
  };
}

export const redisConnection: ConnectionOptions = parseRedisUrl(config.redisUrl);
