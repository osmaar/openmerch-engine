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

  // CORS — comma-separated list of allowed origins, or a single origin.
  // Set explicitly to '*' to opt back into wildcard (not recommended).
  corsOrigin: parseCorsOrigin(),
};
