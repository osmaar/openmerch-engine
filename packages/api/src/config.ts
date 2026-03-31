import 'dotenv/config';

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

  // CORS
  corsOrigin: process.env.CORS_ORIGIN ?? '*',
};
