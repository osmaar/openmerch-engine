# OpenMerch Engine

> Open-source, self-hosted product customization platform for ecommerce stores.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

OpenMerch Engine lets any ecommerce store offer visual product customization directly on their website — no third-party SaaS required. Customers design products before buying; merchants get print-ready production files automatically.

> **Status:** Phase 1 (Canvas Editor) complete. Phase 2 (Backend API + Admin Panel + Editor Integration) in progress — Editor saves designs to DB, MinIO organized, ProductEdit functional. Next: cart flow + CMS integration.

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
- **Self-hosted** — your data, your server, Docker Compose in one command

---

## Supported Products (MVP)

- T-shirts

> More products (hoodies, mugs, caps, phone cases, posters, mousepads) coming in future releases.

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
pnpm dev
```

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
└── products/
    └── tshirt/       # Product assets and zone definitions
```

**Stack:** React 19 · TypeScript · Konva.js · Zustand · Fastify · BullMQ · Sharp · PostgreSQL · Redis · MinIO · Python + pyembroidery

---

## WooCommerce Integration

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
  - [ ] Cart flow (Add to Cart → save design → checkout → production files)
  - [ ] BullMQ production job queue
  - [ ] Settings API (API keys management)
  - [ ] rembg AI-powered background removal (Python)
- [ ] 2D preview with displacement maps (Phase 2)
- [ ] Per-technique validation and embroidery files (Phase 3)
- [ ] WooCommerce integration (Phase 4)
- [ ] Shopify integration (Post-MVP)
- [ ] 3D preview (Post-MVP)

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
