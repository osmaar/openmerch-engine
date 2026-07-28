// Worker process entrypoint.
// Runs separately from the HTTP API server. Started via `pnpm worker`
// (development) or `node dist/worker.js` (production).
//
// This process consumes BullMQ jobs from Redis and writes results back to
// PostgreSQL and MinIO. It must NOT be merged into the API process — heavy
// rendering would block HTTP requests otherwise.

import { promises as fs } from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { assertEncryptionKeyConfigured } from './utils/crypto.js';
import { startProductionFilesWorker } from './jobs/workers/production-files.worker.js';

// This worker decrypts settings (API keys, secrets) with the same key as the
// API — refuse to run in production against the insecure dev default.
assertEncryptionKeyConfigured();

// Wipe the font file cache. Stale or invalid files (e.g. WOFF/EOT from a prior
// run that were deleted) leave orphan entries in fontconfig's disk cache.
// When Pango later tries to load those entries it gets "couldn't load font"
// because the files are gone. Wiping both caches ensures a clean slate.
const FONT_CACHE_DIR = path.join(os.tmpdir(), 'openmerch-fonts');
await fs.rm(FONT_CACHE_DIR, { recursive: true, force: true }).catch(() => {});

// Wipe fontconfig's disk cache. fontconfig persists font metadata across
// processes; stale entries from deleted files cause "couldn't load font X
// Not-Rotated" even after fresh downloads. Clear the known cache locations
// so fontconfig rebuilds from the files we actually register this run.
const FC_CACHE_DIRS = [
  path.join(os.homedir(), 'AppData', 'Local', 'fontconfig', 'cache'), // Windows
  path.join(os.homedir(), '.cache', 'fontconfig'),                     // Linux/macOS (XDG)
  path.join(os.homedir(), '.fontconfig'),                               // older fontconfig
];
for (const dir of FC_CACHE_DIRS) {
  await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
}

console.log('🛠  OpenMerch worker starting...');

const worker = startProductionFilesWorker();

console.log('  ✓ production-files queue ready');
console.log('  Listening for jobs. Press Ctrl+C to stop.\n');

async function shutdown(signal: string) {
  console.log(`\n[worker] received ${signal}, draining...`);
  try {
    await worker.close();
    console.log('[worker] shutdown complete');
    process.exit(0);
  } catch (err) {
    console.error('[worker] error during shutdown:', err);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
