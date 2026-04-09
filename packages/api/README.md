# @openmerch/api — Backend API

REST API server for OpenMerch Engine. Handles product configuration, design persistence, asset storage, and production file generation.

## Stack

- **Fastify** — HTTP framework (schema-first, TypeScript native)
- **Drizzle ORM** — Type-safe SQL queries + migrations
- **PostgreSQL 16** — Primary database
- **Redis 7** — Job queue (BullMQ)
- **MinIO** — S3-compatible object storage for images and production files
- **Sharp** — Image processing (compositing, export) — Phase 2
- **BullMQ** — Async job queue for heavy processing — Phase 2

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                   Editor (React)                     │
│              localhost:3000                           │
└──────────────────────┬──────────────────────────────┘
                       │ HTTP requests
                       ▼
┌─────────────────────────────────────────────────────┐
│              Fastify API Server                      │
│              localhost:3001                           │
│                                                      │
│  /api/v1/health      → Status check                  │
│  /api/v1/products    → CRUD products                 │
│  /api/v1/designs     → Save/load/update designs      │
│  /api/v1/assets/*    → Upload/serve files             │
│  /api/v1/production  → Generate print files (Phase 2) │
│  /api/v1/webhooks    → WooCommerce hooks (Phase 4)   │
│                                                      │
├──────────┬──────────┬──────────┬────────────────────┤
│          │          │          │                      │
│  PostgreSQL   Redis    MinIO    Python (embroidery)   │
│  :5432        :6379    :9000    :8000                 │
│                                                      │
│  Products     Jobs     Images   DST/PES generation   │
│  Designs      Queue    Assets   (Phase 3)            │
│  Settings              Exports                       │
└─────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 20+
- pnpm
- Docker and Docker Compose

### 1. Start Infrastructure

```bash
# From the project root
docker compose up -d
```

This starts:
- **PostgreSQL** on port 5432 (user: openmerch, pass: openmerch, db: openmerch)
- **Redis** on port 6379
- **MinIO** on port 9000 (console: 9001, user: openmerch, pass: openmerch123)

### 2. Configure Environment

```bash
# Copy the example env file (if not done already)
cp .env.example .env
```

Default `.env` values work with the Docker Compose setup out of the box.

### 3. Run Database Migrations

```bash
cd packages/api

# Generate migration files from schema
pnpm db:generate

# Apply migrations to database
pnpm db:migrate
```

### 4. Seed Default Translations (i18n)

OpenMerch ships with **English** (default), **Spanish**, and **French** translations for **both the editor and the admin panel**. Load them into the database:

```bash
cd packages/api
pnpm db:seed
```

This reads JSON files from `seeds/translations/*.json` and inserts them as languages + translations. The script is **idempotent** — running it multiple times won't overwrite existing translations.

**What gets seeded:**
- Languages: Spanish (es), French (fr)
- ~490 translation keys per language covering the entire editor UI **and** admin panel UI (all pages, modals, toasts, validation messages, API error messages)
- English is the source language (no translation needed — it's hardcoded)
- API error messages (`Product not found`, `Asset not found`, etc.) are also seeded so the frontend can translate them via `t(error.message)`

**Adding a new language to the seed:**

1. Create a new file `seeds/translations/de.json` (use the German example):
   ```json
   {
     "_meta": {
       "code": "de",
       "name": "German",
       "flag": "🇩🇪"
     },
     "Add to Cart": "In den Warenkorb",
     "Print": "Drucken",
     "Help": "Hilfe"
   }
   ```
2. Run `pnpm db:seed`
3. Activate the language from the admin panel → Languages

The full list of keys to translate is available in the admin UI at **Languages → Translations → Download JSON** (separate downloads for the Editor and the Admin Panel), or in `apps/admin/src/pages/Languages.tsx` (`EDITOR_TEXTS_BY_SECTION` and `ADMIN_TEXTS_BY_SECTION` constants).

### 5. Start the API Server

```bash
# From the project root
pnpm dev --filter @openmerch/api
```

The API will be available at `http://localhost:3001`.

### 6. Verify

```bash
curl http://localhost:3001/api/v1/health
# → {"status":"ok","timestamp":"...","version":"0.0.1"}
```

## API Endpoints

### Health

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Status check |

### Products

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/products` | List all products |
| GET | `/api/v1/products/:id` | Get product by ID |
| POST | `/api/v1/products` | Create a product |

**POST body:**
```json
{
  "name": "Basic T-Shirt",
  "slug": "basic-tshirt",
  "zones": [
    {
      "id": "front",
      "name": "Front",
      "baseImageWidthMM": 500,
      "baseImageHeightMM": 500,
      "printAreaWidthMM": 200,
      "printAreaHeightMM": 300,
      "printAreaXMM": 150,
      "printAreaYMM": 105,
      "baseImageUrl": "/products/tshirt/basic_tshirt_front.png"
    }
  ]
}
```

### Designs

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/designs` | List all designs |
| GET | `/api/v1/designs/:id` | Get design by ID |
| POST | `/api/v1/designs` | Save a new design |
| PUT | `/api/v1/designs/:id` | Update existing design |
| DELETE | `/api/v1/designs/:id` | Delete a design |

**POST body:**
```json
{
  "productId": "uuid-here",
  "name": "My T-Shirt Design",
  "designData": {
    "id": "...",
    "productId": "...",
    "activeZone": "front",
    "zones": {
      "front": {
        "zoneId": "front",
        "canvasWidthMM": 200,
        "canvasHeightMM": 300,
        "layers": [...]
      }
    }
  }
}
```

### Assets

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/v1/assets/upload` | Upload a file (multipart/form-data) |
| GET | `/api/v1/assets/*` | Serve a file from storage |

**Upload:**
```bash
curl -X POST http://localhost:3001/api/v1/assets/upload \
  -F "file=@myimage.png"
```

## Database Schema

```
┌─────────────┐     ┌──────────────┐
│  products    │     │   designs    │
├─────────────┤     ├──────────────┤
│ id (uuid)   │◄────│ product_id   │
│ name        │     │ id (uuid)    │
│ slug        │     │ name         │
│ zones (json)│     │ design_data  │
│ created_at  │     │ thumbnail_url│
│ updated_at  │     │ created_at   │
└─────────────┘     │ updated_at   │
                    └──────┬───────┘
                           │
                    ┌──────▼───────┐     ┌──────────────┐
                    │production_jobs│     │   assets     │
                    ├──────────────┤     ├──────────────┤
                    │ id (uuid)    │     │ id (uuid)    │
                    │ design_id    │     │ filename     │
                    │ status       │     │ mime_type    │
                    │ format       │     │ size         │
                    │ output_url   │     │ url          │
                    │ error        │     │ storage_key  │
                    │ created_at   │     │ created_at   │
                    │ completed_at │     └──────────────┘
                    └──────────────┘

┌──────────────┐
│   settings   │
├──────────────┤
│ key (pk)     │
│ value        │
│ is_secret    │
│ updated_at   │
└──────────────┘
```

## Error Format

All errors follow the same format:

```json
{
  "error": "Human-readable message",
  "code": "MACHINE_READABLE_CODE"
}
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3001` | API server port |
| `HOST` | `0.0.0.0` | API server host |
| `DATABASE_URL` | `postgres://openmerch:openmerch@localhost:5432/openmerch` | PostgreSQL connection |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection |
| `MINIO_ENDPOINT` | `localhost` | MinIO host |
| `MINIO_PORT` | `9000` | MinIO port |
| `MINIO_ACCESS_KEY` | `openmerch` | MinIO access key |
| `MINIO_SECRET_KEY` | `openmerch123` | MinIO secret key |
| `MINIO_BUCKET` | `openmerch` | MinIO bucket name |
| `CORS_ORIGIN` | `*` | Allowed CORS origin |

## Development

```bash
# Run with hot-reload
pnpm dev --filter @openmerch/api

# Build for production
pnpm build --filter @openmerch/api

# Run production build
cd packages/api && pnpm start

# Database operations
cd packages/api
pnpm db:generate    # Generate migration from schema changes
pnpm db:migrate     # Apply pending migrations
pnpm db:studio      # Open Drizzle Studio (visual DB browser)

# Lint
pnpm lint --filter @openmerch/api
```

## File Storage (MinIO)

Files are stored in MinIO with this structure:

```
openmerch/
├── assets/
│   ├── {uuid}.png     ← User uploaded images
│   ├── {uuid}.jpg
│   └── {uuid}.svg
├── exports/
│   ├── {uuid}_front.png  ← Production files (Phase 2)
│   └── {uuid}_back.svg
└── thumbnails/
    └── {uuid}.jpg     ← Design thumbnails
```

MinIO console is available at `http://localhost:9001` (user: openmerch, pass: openmerch123).

## Roadmap

- [x] Fastify server with health check
- [x] Products CRUD
- [x] Designs CRUD (save/load)
- [x] Asset upload/serve with MinIO
- [x] PostgreSQL with Drizzle ORM
- [x] Connect editor to API (save/load designs)
- [x] BullMQ production job queue (Docker worker, 300 DPI print + 96 DPI mockup)
- [x] Konva + node-canvas rendering at 300 DPI (custom fonts + Google Fonts via fontconfig)
- [x] Admin panel (products, templates, cliparts, fonts, printing types, orders, languages, settings)
- [x] Auto-generated design names ("Product - Design #001")
- [x] Settings API (AES-256 encryption, proxy endpoints, branding/favicon/store name)
- [ ] Checkout flow (payment → auto production file generation)
- [ ] rembg integration (Python remove background)
- [ ] WooCommerce webhook handler
