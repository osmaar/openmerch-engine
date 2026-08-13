import 'dotenv/config';

// Dev frontends (apps/demo on :3000, apps/admin on :3002) — the safe default
// when CORS_ORIGIN is unset. Never defaults to '*': the API has no auth, so a
// wildcard origin would let any site make credentialed-looking requests to it.
const DEFAULT_CORS_ORIGINS = ['http://localhost:3000', 'http://localhost:3002'];

function parseCorsOrigin(): string | string[] {
  const raw = process.env.CORS_ORIGIN;
  if (!raw) return DEFAULT_CORS_ORIGINS;
  if (raw === '*') return '*';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export const config = {
  port: Number(process.env.PORT ?? 3001),
  host: process.env.HOST ?? '0.0.0.0',

  // Database
  databaseUrl: process.env.DATABASE_URL ?? 'postgres://openmerch:openmerch@localhost:5432/openmerch',

  // Redis
  redisUrl: process.env.REDIS_URL ?? 'redis://localhost:6379',

  // MinIO
  minio: {
    endpoint: process.env.MINIO_ENDPOINT ?? 'localhost',
    port: Number(process.env.MINIO_PORT ?? 9000),
    accessKey: process.env.MINIO_ACCESS_KEY ?? 'openmerch',
    secretKey: process.env.MINIO_SECRET_KEY ?? 'openmerch123',
    bucket: process.env.MINIO_BUCKET ?? 'openmerch',
  },

  // AI background removal microservice (services/rembg). Empty string means
  // the service isn't configured/deployed — routes treat that as disabled
  // rather than trying to reach it.
  rembg: {
    url: process.env.REMBG_URL ?? '',
  },

  // Secret configured on the WooCommerce webhook (wp-admin) used to verify the
  // HMAC-SHA256 signature of incoming order webhooks. Empty string means the
  // webhook route treats it as not configured (503) rather than accepting
  // unverifiable requests.
  woocommerce: {
    webhookSecret: process.env.WOOCOMMERCE_WEBHOOK_SECRET ?? '',
  },

  // Abandoned-design cleanup: permanently deletes draft/cart designs (and their production
  // files in MinIO) that were never linked to a real order and haven't been edited in a
  // while. "cart" gets a longer grace period than "draft" — a design a customer actually
  // added to a cart carries more intent than one they merely started sketching.
  cleanup: {
    enabled: process.env.ABANDONED_DESIGNS_CLEANUP_ENABLED !== 'false',
    abandonedDraftRetentionMs: Number(process.env.ABANDONED_DRAFT_RETENTION_DAYS ?? 7) * 24 * 60 * 60 * 1000,
    abandonedCartRetentionMs: Number(process.env.ABANDONED_CART_RETENTION_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  },

  // webhook_deliveries (see orders-webhook-woocommerce.ts) is a pure audit log — one row per
  // inbound webhook request, kept so the Admin Panel can show rejected deliveries. Nothing
  // ever reads a row older than a few days in practice, so it's purged on the same cadence as
  // abandoned designs rather than kept forever.
  webhookDeliveriesCleanup: {
    enabled: process.env.WEBHOOK_DELIVERIES_CLEANUP_ENABLED !== 'false',
    retentionMs: Number(process.env.WEBHOOK_DELIVERIES_RETENTION_DAYS ?? 30) * 24 * 60 * 60 * 1000,
  },

  // CORS — comma-separated list of allowed origins, or a single origin.
  // Set explicitly to '*' to opt back into wildcard (not recommended).
  corsOrigin: parseCorsOrigin(),
};
