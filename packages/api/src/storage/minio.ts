import { Client } from 'minio';
import { config } from '../config.js';

export const minioClient = new Client({
  endPoint: config.minio.endpoint,
  port: config.minio.port,
  useSSL: false,
  accessKey: config.minio.accessKey,
  secretKey: config.minio.secretKey,
});

let bucketReady = false;

export async function ensureBucket(): Promise<void> {
  if (bucketReady) return;

  const exists = await minioClient.bucketExists(config.minio.bucket);
  if (!exists) {
    await minioClient.makeBucket(config.minio.bucket);
  }
  bucketReady = true;
}
