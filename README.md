# OpenMerch Engine

> Open-source, self-hosted product customization platform for ecommerce stores.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-20%2B-green)](https://nodejs.org)

OpenMerch Engine lets any ecommerce store offer visual product customization directly on their website — no third-party SaaS required. Customers design products before buying; merchants get print-ready production files automatically.

> **Status:** Early development — not ready for production use yet.

---

## Features (Planned)

- **Visual canvas editor** — upload images, add text, move, scale, rotate elements
- **Multi-zone support** — design front, back, and sleeves independently
- **Realistic 2D previews** — composited mockups with lighting overlays
- **Print-ready file generation** — PNG at 300 DPI, SVG vector, DST/PES embroidery files
- **Per-technique validation** — DPI checks, color limits, embroidery constraints
- **WooCommerce plugin** — embed the editor in any product page via iframe
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
│   └── demo/         # Standalone demo app
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
  - [ ] Cliparts tab (Lucide icons as basic cliparts)
  - [ ] Shapes tab (rect, circle, triangle, star)
  - [ ] Undo/redo full support
  - [ ] PNG/SVG export
- [ ] 2D preview and PNG export (Phase 2)
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
