# OpenMerch Engine

> Open-source, self-hosted product customization platform for ecommerce stores.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

OpenMerch Engine lets any ecommerce store offer visual product customization directly on their website — no third-party SaaS required. Customers design products before buying; merchants get print-ready production files automatically.

> **Status:** Phase 2 complete — Product overlay/mask system closed with MVP coverage (21 overlays across 7 product types, 7 PSD sources versioned), Konva zone editor in admin, 13 products with variants, Settings API, BullMQ production jobs, full i18n. A full internal audit (security, frontend, backend, test coverage, code quality — 54 findings) has been closed end-to-end, plus interactive API docs (Swagger/OpenAPI) and a full architecture/roadmap writeup — see [Documentation](#documentation) below. Next: rembg AI background removal, then displacement maps (fabric-realistic mockups). WooCommerce/Shopify plugins, embroidery/per-technique validation, native checkout, and 3D preview are explicitly Post-MVP — see [Roadmap](#roadmap).

---

## Features

- **Visual canvas editor** — upload images, add text, shapes, cliparts. Move, scale, rotate with snap guides
- **AI image generation** — powered by Pollinations.ai with 5 models and 8 styles (1024x1024)
- **200,000+ cliparts** — Iconify API integration with 10+ icon collections
- **Photos & backgrounds** — Unsplash API with search and category browsing
- **120+ Google Fonts** — instant search, dynamic loading
- **Multi-zone support** — design front and back independently
- **9 geometric shapes** — rectangle, circle, triangle, star, diamond, pentagon, hexagon, cross, rounded-rect
- **QR code generator** — transparent background, add to any design
- **Product color tinting** — change t-shirt color in real-time (12 colors)
- **Export PNG/SVG** — 600 DPI, with or without mockup base, front + back
- **20+ keyboard shortcuts** — undo/redo, duplicate, move, zoom, download
- **Full toolbar** — filters, fill, crop, remove background, arrange, position, transform
- **Admin panel** — merchant dashboard to manage products, templates, cliparts, fonts, printing types, orders, languages, and settings
- **Full i18n** — both Editor and Admin Panel ship with English, Spanish and French. Merchants can add more languages via the admin or import JSON files
- **Self-hosted** — your data, your server, Docker Compose in one command

---

## Supported Products (MVP)

13 base products with calibrated print zones, variants, and overlay masks where applicable:

| Product | Variants | Overlay |
|---|---|---|
| Classic / Oversized / Box T-Shirt | S/M/L/XL × 12 colors | — |
| Premium Hoodie | sizes × colors | — |
| Dad Hat / Trucker Hat | one size × colors | — |
| Glossy Mug | 11 oz / 15 oz / 20 oz | ✅ |
| iPhone Case | 31 models (iPhone 7 → 17 Pro Max) | ⚠️ 1/31 (17 Pro Max only) |
| Wall Art Poster | 5×7 → 24×36 in (6 sizes) | ✅ |
| Flag Poster | one size | ✅ |
| Desk Mat | 12×18 / 12×22 / 16×32 in | ✅ |
| Mousepad | one size | ✅ |
| Throw Pillow | 18×18 / 20×12 / 22×22 in (front + back) | ✅ |

## Decoration Techniques (MVP)

| Technique | File Output | Status |
|---|---|---|
| Sublimation | PNG 300 DPI | Planned |
| Screen Printing | PNG 300 DPI + SVG | Planned |
| Embroidery | DST / PES | Planned (Experimental) |

---

## Quick Start

### Requirements

- Docker and Docker Compose
- Node.js 20+
- pnpm

### Setup

```bash
git clone https://github.com/osmaar/openmerch-engine.git
cd openmerch-engine
cp .env.example .env
docker compose up -d
pnpm install
pnpm --filter @openmerch/api db:seed
pnpm dev
```

`db:seed` loads the default translations (English/Spanish/French) and the 13-product starter catalog — skip it and you'll get a running app with an empty database (no products to design). It's idempotent, safe to re-run.

Editor demo will be available at `http://localhost:3000`
Admin panel will be available at `http://localhost:5173`

---

## Architecture

```
openmerch-engine/
├── packages/
│   ├── editor/       # React + Konva.js canvas editor
│   ├── core/         # Shared TypeScript types and utilities
│   ├── api/          # Fastify REST API
│   ├── renderer/     # 2D compositing engine (Sharp)
│   └── embroidery/   # Python microservice (DST/PES generation)
├── apps/
│   ├── demo/         # Standalone demo app
│   └── admin/        # Merchant admin panel (Mantine UI)
├── plugins/
│   └── plugin-woocommerce/   # WooCommerce PHP plugin
├── products/                  # Product mockups + overlays consumed by the worker
│   ├── tshirt/
│   ├── mug/
│   ├── phone-case/
│   │   ├── variants/          # Per-model base mockups (iphone-17-pro-max.png, …)
│   │   └── overlays/          # Per-model overlay PNGs (camera cutouts, edges)
│   └── …                      # one folder per product slug
└── overlays-products-base/    # PSD sources for overlays (artist working files)
    ├── case iphone/
    ├── mug/
    └── …                      # one folder per product, with the .psd + exported PNGs
```

**Stack:** React 19 · TypeScript · Konva.js · Zustand · Fastify · BullMQ · Sharp · PostgreSQL · Redis · MinIO · Python + pyembroidery

---

## Documentation

| Doc | What's in it |
|---|---|
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System diagram, database schema, production pipeline, overlay system — with real mermaid diagrams |
| [docs/API_REFERENCE.md](docs/API_REFERENCE.md) | All 12 REST resources, request/response shapes, curl examples |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Detailed, phase-by-phase backlog (including the "Future — Advanced AI" track) |
| [docs/integrations/shopify.md](docs/integrations/shopify.md) | Generic pattern for embedding the editor in a Shopify storefront (headless or classic) |
| `/api/v1/docs` | Live interactive API explorer (Swagger UI, generated from the Fastify schemas — run the API and open it locally) |

Every doc above ships in English (source of truth) with a `.es.md` Spanish counterpart alongside it.

---

## WooCommerce Integration

> **Not built yet — pattern only.** This plugin isn't on the maintainer's active roadmap right now (see [Roadmap](#roadmap) below). The flow described here is the intended integration pattern for whoever picks it up — `plugins/plugin-woocommerce` is currently an empty placeholder. Contributions welcome.

1. Deploy OpenMerch Engine on your server
2. Install the WooCommerce plugin from `/plugins/plugin-woocommerce`
3. Configure the plugin with your OpenMerch Engine URL
4. Enable the customizer on any product

The editor embeds via iframe on the product page. When a customer finishes their design and clicks "Add to Cart", the design is saved and linked to the order. Production files are generated automatically when the order is confirmed.

---

## Roadmap

- [x] Monorepo setup (pnpm + Turborepo + ESLint + Prettier + Vitest + CI)
- [ ] Canvas editor core (Phase 1)
  - [x] T-shirt mockup with front/back zone selector
  - [x] Image upload (button + drag & drop) and text layers
  - [x] Move, scale, rotate with snap guides and rotation snap
  - [x] Keyboard shortcuts (Delete, Ctrl+C/X/V/Z)
  - [x] Image toolbar (replace, crop, remove bg, 36 filters, fill/tint, opacity)
  - [x] Text toolbar (font, size, color, bold/italic/underline, align, case, effects)
  - [x] Arrange, position, and transform popovers for all layer types
  - [x] Text effects (curved, oblique) with per-character rendering
  - [x] Fullscreen layout with sidebar, top toolbar, floating controls
  - [x] NavBar (Print, Help, Languages, Cart — placeholders for backend)
  - [x] Sidebar: Product (color picker, sizes), Image (upload + gallery), Text (effect tiles + fonts), Layers (reorder, show/hide, lock, rename)
  - [x] Zoom (scroll + controls) and pan (drag when zoomed)
  - [x] Stage navigator (floating front/back switcher)
  - [x] QR code generator (transparent background)
  - [x] Product color tinting (auto-detect background type)
  - [x] Cliparts (Iconify API — 200,000+ icons from 10+ collections)
  - [x] Shapes (9 shapes with contextual toolbar: fill, stroke, opacity)
  - [x] Photos (Unsplash API integration with search)
  - [x] Backgrounds (Unsplash API with 10 texture/pattern categories)
  - [x] AI Image generation (Pollinations.ai — 5 models, 8 styles, 1024x1024)
  - [x] Google Fonts (120+ fonts with instant search)
  - [x] Toggle print zone visibility (preview mode)
  - [x] Compositing multiply effect (fabric texture blending)
  - [x] PNG/SVG export (600 DPI, include base, include back, zoom-safe)
  - [x] Full keyboard shortcuts (20+ shortcuts including arrow key movement)
  - [x] Out-of-zone transparency feedback (elements fade when outside print area)
  - [x] Remove background modal (threshold-based, AI-powered coming in Phase 2)
  - [x] Undo/redo full support
- [ ] Backend API and admin panel (Phase 2)
  - [x] Fastify server with REST endpoints (/api/v1/)
  - [x] PostgreSQL database with Drizzle ORM (products, designs, assets, jobs, settings)
  - [x] MinIO storage integration (S3-compatible, self-hosted)
  - [x] Docker Compose infrastructure (PostgreSQL + Redis + MinIO)
  - [x] Backend documentation with architecture diagrams
  - [x] Admin panel UI (products, templates, cliparts, shapes, fonts, printing types, orders, languages, settings)
  - [x] Mantine modals for confirmations + toast notifications
  - [x] Dark mode support across all admin pages
  - [x] Admin panel ↔ API integration (all modules connected to PostgreSQL via REST API)
  - [x] Database schema expansion (8 new tables: templates, cliparts, shapes, fonts, printing_types, orders, languages, translations)
  - [x] i18n system with JSON import/export, validation, 35 languages, editor + admin separation
  - [x] File uploads to MinIO (cliparts, fonts, product images) with FontFace preview
  - [x] Editor ↔ API integration (load product by UUID, save designs with Ctrl+S)
  - [x] MinIO storage organized by category (cliparts/, fonts/, products/, uploads/, production/)
  - [x] ProductEdit connected to API (load existing data, save changes)
  - [x] Configurable storage mode (Database/MinIO/Hybrid) in Settings
  - [x] Cart flow (Add to Cart saves design to DB, cart dropdown with qty controls, remove deletes from DB)
  - [x] Editor consumes merchant resources from admin (cliparts, fonts, shapes via API)
  - [x] i18n runtime system (337 keys, English + Spanish + French shipped via seeds)
  - [x] Language selector in editor navbar with localStorage persistence
  - [x] Admin panel i18n (separate translation system for merchant dashboard)
  - [x] BullMQ production job queue (Docker worker, 300 DPI print + 96 DPI mockup, custom fonts + Google Fonts)
  - [x] Settings API (AES-256 encryption, proxy endpoints, dynamic branding/favicon/store name)
  - [x] Product overlay/mask system (designs clip to print area, overlays for camera/edges/shapes)
  - [x] Interactive Konva zone editor in admin (drag & resize print areas visually)
  - [x] Interactive API documentation (Swagger/OpenAPI UI at `/api/v1/docs`, spec generated from Fastify schemas across all 30 endpoints)
  - [ ] rembg AI-powered background removal (Python)
- [ ] 2D preview with displacement maps (Phase 2) — fabric-realistic mockups (design follows garment wrinkles/folds), **confirmed in scope for v1**

**Post-MVP — explicitly not planned right now** (large, open-ended scopes that would delay a polished v1; contributions welcome, just not on the maintainer's roadmap — see [docs/ROADMAP.md](docs/ROADMAP.md#post-mvp--explicitly-out-of-scope-for-now) for the reasoning behind each):
- [ ] Per-technique validation and embroidery files (previously Phase 3)
- [ ] WooCommerce integration (previously Phase 4)
- [ ] Shopify integration
- [ ] Native checkout / payment flow — the existing `POST /api/v1/designs/:id/generate-files` endpoint is the real integration point; no plan to build payment processing into OpenMerch itself
- [ ] 3D preview

> This checklist tracks features. For the detailed, prioritized backlog (including the security/reliability findings from the internal audit), see [docs/ROADMAP.md](docs/ROADMAP.md).

---

## Languages

OpenMerch Engine ships with **English** (default), **Spanish**, and **French** translations for the customer-facing editor. Translations are loaded from PostgreSQL and seeded automatically.

### First-time setup

After installing the project, run the seed command to load default translations:

```bash
pnpm --filter @openmerch/api db:seed
```

This loads all translations from `packages/api/seeds/translations/*.json` into the database. The script is **idempotent** — running it multiple times will not overwrite existing translations.

### How translations work

- Each language has a JSON seed file at `packages/api/seeds/translations/<code>.json`
- The seed file contains a `_meta` block (code, name, flag) and key-value pairs
- The editor loads active languages at runtime via `GET /api/v1/languages/active`
- Customers can switch languages using the globe icon in the editor navbar
- The selected language is persisted in `localStorage`

### Adding a new language

**Option A — Ship with the product (official languages):**

1. Create `packages/api/seeds/translations/de.json` (or your language code) with this format:
   ```json
   {
     "_meta": { "code": "de", "name": "German", "flag": "🇩🇪" },
     "Add to Cart": "In den Warenkorb",
     "Print": "Drucken",
     ...
   }
   ```
2. Run `pnpm --filter @openmerch/api db:seed`
3. Activate the language from the admin panel → Languages
4. Commit the JSON file to the repo

**Option B — Custom language for a single store:**

1. Go to **Admin → Languages → Add New Language**
2. Click **"Translations"** for the new language
3. **Download JSON** to get a template with all 337 keys empty
4. Translate the values externally (or use Google Translate)
5. **Import JSON** to load the translations
6. Activate the language with the switch

### Translating the editor

The editor uses ~337 unique strings organized in 25 sections (NavBar, Cart, Toolbars, Tabs, Popovers, Filters, AI prompts, etc.). All strings are visible in the admin panel under **Languages → Translations → OpenMerch Editor tab**, with section headers for easy navigation.

Both the editor and the admin panel are fully translated.

---

## Product Overlays

Overlays are PNGs with transparency that render **on top** of the customer's design — they reproduce features of the physical product that the design cannot cover: phone-camera cutouts, rounded corners, rim of a mug, edges of a poster, etc. They make the preview (and the production-file export) look like the real product.

### Where overlays live

```
overlays-products-base/         ← PSD sources (artist working files, versioned)
  case iphone/iphone-17-pro-max.psd
  mug/mug.psd
  …

products/<slug>/overlays/        ← PNGs consumed by the Docker worker (production files)
  mug/overlays/11oz-overlay.png
  phone-case/overlays/iphone-17-pro-max-overlay.png
  …

apps/demo/public/products/<slug>/overlays/   ← Same PNGs, served by Vite to the browser editor
```

The two PNG copies are intentional and must stay in sync: the worker reads from `products/` (mounted into the Docker image), while the browser-side editor fetches from `apps/demo/public/products/` over HTTP.

### How they get applied at runtime

Each zone (or variant zone) in `packages/api/seeds/products/catalog.json` may carry an `overlayImageUrl`:

```json
{
  "id": "iphone-17-pro-max",
  "name": "iPhone 17 Pro Max",
  "zones": [{
    "id": "back",
    "baseImageUrl": "/products/phone-case/variants/iphone-17-pro-max.png",
    "overlayImageUrl": "/products/phone-case/overlays/iphone-17-pro-max-overlay.png",
    ...
  }]
}
```

When the seed runs (`pnpm --filter @openmerch/api db:seed`), the path is stored in the `products.zones` / `products.variants` JSONB column. Both the editor (compositing layer above the design) and the renderer (3-pass export: base → clipped design → overlay) honor that field automatically.

### Adding overlays for a new product

1. **Create the PSD** in `overlays-products-base/<product>/`, working from the base mockup as a reference layer.
2. **Cut out the printable area** (delete it to transparent). Everything else stays opaque — the parts of the product that should sit on top of the design.
3. **Export each variant** as `<variant>-overlay.png` (or `<zone>-overlay.png` for single-zone products) into the same folder.
4. **Copy the exported PNGs** to both:
   - `products/<slug>/overlays/<variant>-overlay.png`
   - `apps/demo/public/products/<slug>/overlays/<variant>-overlay.png`
5. **Add the path** to the corresponding zone in `packages/api/seeds/products/catalog.json`:
   ```json
   "overlayImageUrl": "/products/<slug>/overlays/<variant>-overlay.png"
   ```
6. **Re-run the product seed:**
   ```bash
   pnpm --filter @openmerch/api db:seed
   ```

Alternatively, a merchant who already has the platform running can upload overlays via **Admin → Products → Edit → Zone → Upload Overlay Image** without touching the seed. That path stores the overlay against the running database only and is the right choice for store-specific products that won't ship with the open-source project.

### Current coverage

21 overlays across 7 product types are versioned and load automatically with `db:seed:products`. T-shirts, hoodies, and caps don't ship with overlays — they have no cutouts that warrant one. The iPhone Case ships with the iPhone 17 Pro Max overlay only as a reference; the pending models (30/31) are listed in `overlays-products-base/case iphone/TODO.txt` with the full step-by-step process.

---

## Contributing

Contributions are welcome. Please read [CONTRIBUTING.md](CONTRIBUTING.md) before submitting a pull request.

Areas where help is especially needed:

- **Embroidery validation** — if you have access to embroidery machines (Tajima, Brother, Barudan), testing DST/PES output is critical
- **Product assets** — displacement maps, lighting overlays, and print zone masks for new products
- **WooCommerce plugin** — PHP developers welcome
- **Translations** — the editor UI should support multiple languages

---

## License

MIT License — see [LICENSE](LICENSE) for details.

You can use OpenMerch Engine in commercial projects, modify it, and distribute it freely.

---

## Self-Hosting

OpenMerch Engine is designed to run entirely on your infrastructure. No telemetry, no external dependencies, no vendor lock-in. All customer designs and production files stay on your server.
