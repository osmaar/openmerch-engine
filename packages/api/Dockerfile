# Multi-stage Dockerfile for the OpenMerch API + worker.
# Both the HTTP API and the BullMQ worker share the same image — they're
# different commands of the same compiled package.

# ─── Stage 1: build ──────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

# Native deps for `canvas` (Cairo, Pango, libjpeg, libgif, librsvg, pixman).
# Bookworm has prebuilt binaries for Node 20 + canvas@3, but we keep the build
# tools available in case the prebuild is missing for the target arch.
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    pkg-config \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev \
    libpixman-1-dev \
    python3 \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /repo

# Enable corepack for pnpm.
RUN corepack enable

# Copy workspace manifests first for better layer caching.
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY tsconfig.base.json ./
COPY packages/core/package.json packages/core/
COPY packages/renderer/package.json packages/renderer/
COPY packages/api/package.json packages/api/

RUN pnpm install --frozen-lockfile

# Copy source.
COPY packages/core packages/core
COPY packages/renderer packages/renderer
COPY packages/api packages/api
COPY products products

# Build dependency packages first, then the API.
RUN pnpm --filter @openmerch/core build \
 && pnpm --filter @openmerch/renderer build \
 && pnpm --filter @openmerch/api build

# Prune dev deps to shrink the runtime image.
RUN pnpm --filter @openmerch/api deploy --prod /deploy

# ─── Stage 2: runtime ────────────────────────────────────────────────────────
FROM node:20-bookworm-slim AS runtime

# Runtime libs only (no -dev packages).
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcairo2 \
    libpango-1.0-0 \
    libpangocairo-1.0-0 \
    libjpeg62-turbo \
    libgif7 \
    librsvg2-2 \
    libpixman-1-0 \
    fontconfig \
    fonts-dejavu-core \
    fonts-liberation \
  && rm -rf /var/lib/apt/lists/* \
  && fc-cache -f

WORKDIR /app

COPY --from=builder --chown=node:node /deploy /app
# Product mockup images — needed by the worker for mockup rendering
COPY --from=builder --chown=node:node /repo/products /app/products

ENV NODE_ENV=production
EXPOSE 3001

# node:20-bookworm-slim ships a preexisting `node` user (uid 1000) — run as
# that instead of root. Both processes only write under os.tmpdir() (world-
# writable /tmp), so no extra chown is needed for /app itself.
USER node

# Only meaningful for the api service (the worker has no HTTP server and
# disables this check in docker-compose.yml). Uses Node's built-in fetch
# instead of curl/wget to avoid adding packages to the runtime image.
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3001/api/v1/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

# Default command runs the HTTP API. The worker service overrides this with
# `node dist/worker.js` in docker-compose.
CMD ["node", "dist/index.js"]
