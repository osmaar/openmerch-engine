# Roadmap

> Public roadmap for OpenMerch Engine — open-source, self-hosted product customization platform.

This document tracks where the project stands and what's coming next, organized by the same phases used in [README.md](../README.md). It's updated as work lands — no fixed dates are promised except where explicitly noted.

**Current status:** Phase 1 (Canvas Editor Core) and Phase 2 (Backend & Admin Panel) are both complete. Per-technique/embroidery validation, WooCommerce/Shopify plugins, native checkout, and 3D preview are explicitly **out of scope for the v1 push** — see [Post-MVP](#post-mvp--explicitly-out-of-scope-for-now) below for why.

---

## Phase 1 — Canvas Editor Core

**Status: Complete**

- [x] Visual canvas editor (Konva.js) — images, text, shapes, cliparts; move, scale, rotate with snap guides
- [x] Multi-zone support (design front and back independently)
- [x] Image tools — upload, crop, filters, fill/tint, background removal (threshold-based)
- [x] Text tools — fonts, effects (curved, oblique), full styling toolbar
- [x] 9 geometric shapes with contextual toolbar
- [x] Cliparts (200,000+ via Iconify), Photos & Backgrounds (Unsplash), 120+ Google Fonts
- [x] AI image generation (Hugging Face Inference Providers — Stable Diffusion 3 Medium, 8 styles). Switched from Pollinations.ai after its free tier proved unreliable under real use (Inference Providers' third-party routes require billing; `hf-inference`, the free provider, only reliably serves this one model right now).
- [x] QR code generator
- [x] Product color tinting (real-time, auto-detects background type)
- [x] Layers panel (reorder, show/hide, lock, rename)
- [x] Full keyboard shortcuts (20+) and complete undo/redo
- [x] PNG/SVG export at 600 DPI, with or without mockup base

---

## Phase 2 — Backend & Admin Panel

**Status: Complete**

- [x] Fastify REST API + PostgreSQL (Drizzle ORM) + MinIO storage, Docker Compose infrastructure
- [x] Full admin panel — products, templates, cliparts, fonts, printing types, orders, languages, settings
- [x] Editor ↔ API integration (load/save designs, merchant resource sync)
- [x] Cart flow (add to cart, manage quantities, persist to database)
- [x] BullMQ production job queue (300 DPI print files, automatically lowered per-zone when the physical size would otherwise exceed the safe canvas limit — e.g. desk mats, mousepads, posters — with an optional `printDPI` override in the admin for exact vendor requirements; + 96 DPI mockups, custom fonts + Google Fonts)
- [x] Settings API with encrypted storage for third-party API keys
- [x] Product overlay/mask system (21 overlays across 7 product types)
- [x] Interactive zone editor (Konva) for calibrating print areas visually in the admin
- [x] Full i18n across editor and admin (English, Spanish, French shipped; more languages importable)
- [x] AI-powered background removal — `services/rembg`, an optional self-hosted Python microservice wrapping `rembg`/u2net (CPU-only), gated behind Docker Compose's `ai` profile so it never becomes a required dependency for a minimal self-host. The editor's Remove Background tool gained an "AI" mode alongside the existing "Basic" threshold mode, which keeps working with no network call. If the microservice isn't running, the API responds with a clean 503 rather than breaking anything. rembg's PNG output is premultiplied-alpha (non-standard — every normal PNG consumer renders a dark/muddy fringe on soft edges like fur unless it's corrected), fixed once server-side (`unpremultiplyAlpha` in `@openmerch/core`) so every consumer of the resulting asset gets a clean cutout.
- [x] Displacement maps / texture blending — fabric-realistic mockups (design follows garment wrinkles/folds), applied to every real fabric product in the catalog (t-shirt, oversized tee, box tee, hoodie, desk mat, throw pillow), each tuned with its own texture/strength rather than one global setting.
- [x] Security hardening pass — full internal audit closed (security, frontend, backend, test coverage, code quality — 54 findings across P0/P1/P2), verified via build/lint/test + live smoke tests. Per-package documentation (README + JSDoc for every module) and CONTRIBUTING/local-setup docs closed alongside it.

---

## Post-MVP — Explicitly Out of Scope for Now

These were on earlier drafts of this roadmap as active phases. They're now explicitly deprioritized for the v1 push — not because they're bad ideas, but because each one is a large, open-ended scope that would delay shipping a polished, self-hostable v1. Contributions are welcome on any of these; they're just not being built by the maintainer right now.

- [ ] **Per-technique validation & embroidery microservice** (previously "Phase 3") — enforcing sublimation/screen-printing/embroidery rules automatically in the production pipeline, plus the Python DST/PES microservice (`packages/embroidery`, still a placeholder). Too extensive to bundle into this push; embroidery output validation also needs real hardware access (Tajima, Brother, Barudan) that the maintainer doesn't have. Contributors with that access are especially welcome — see [CONTRIBUTING.md](../CONTRIBUTING.md).
- [ ] **WooCommerce plugin** (`plugins/plugin-woocommerce`) — not being built for v1. The iframe + postMessage bridge pattern is still the intended approach if someone picks this up, but it's no longer on the maintainer's active roadmap.
- [ ] **Shopify integration** — same status as WooCommerce: a generic embedding *pattern* is documented at [docs/integrations/shopify.md](integrations/shopify.md) (embed `@openmerch/editor` as a React component, `onExport` contract, `customAttributes` cart mapping), but no scaffolded plugin package is planned right now.
- [ ] **Native checkout / payment flow** — deliberately **not** building payment processing into OpenMerch itself. The project's own principle (editor + API first, "plugins are dumb bridges, all logic lives in the API") argues against reimplementing what Shopify/WooCommerce already do well. The production-file generation endpoint (`POST /api/v1/designs/:id/generate-files`) already exists and works standalone — any external integration (a CMS webhook, a custom storefront, a manual admin action) can call it directly once an order is confirmed, without OpenMerch needing to own the payment flow.
- [ ] **3D preview** — not planned. 2D compositing (including the displacement-maps work above) covers the realism bar this project is aiming for; 3D adds a large rendering-engine scope (Three.js/WebGL) for a use case most merchants don't need.

---

## Future — Advanced AI

**Post-v1 — exploratory, no committed dates.** These are directions we want to explore once the core product and integrations above are stable, not commitments for the next release.

- [ ] **Generative fill / AI image completion** — let merchants extend or complete a design intelligently, similar to tools like Kittl.
- [ ] **High-resolution AI upscaling** — improve output quality for AI-generated and low-resolution uploaded images beyond what's produced today.

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to get involved. Areas where help is especially valuable right now: embroidery validation (machine access), product assets (displacement maps, print zone masks for new products), the WooCommerce plugin (PHP), and translations.
