# Roadmap

> Public roadmap for OpenMerch Engine — open-source, self-hosted product customization platform.

This document tracks where the project stands and what's coming next, organized by the same phases used in [README.md](../README.md). It's updated as work lands — no fixed dates are promised except where explicitly noted.

**Current status:** Phase 1 (Canvas Editor Core) is complete. Phase 2 (Backend & Admin Panel) is functionally complete; a few closing items remain before the project is ready for a wider public release. Per-technique/embroidery validation, WooCommerce/Shopify plugins, native checkout, and 3D preview are explicitly **out of scope for the v1 push** — see [Post-MVP](#post-mvp--explicitly-out-of-scope-for-now) below for why.

---

## Phase 1 — Canvas Editor Core

**Status: Complete**

- [x] Visual canvas editor (Konva.js) — images, text, shapes, cliparts; move, scale, rotate with snap guides
- [x] Multi-zone support (design front and back independently)
- [x] Image tools — upload, crop, filters, fill/tint, background removal (threshold-based)
- [x] Text tools — fonts, effects (curved, oblique), full styling toolbar
- [x] 9 geometric shapes with contextual toolbar
- [x] Cliparts (200,000+ via Iconify), Photos & Backgrounds (Unsplash), 120+ Google Fonts
- [x] AI image generation (Pollinations.ai — 5 models, 8 styles)
- [x] QR code generator
- [x] Product color tinting (real-time, auto-detects background type)
- [x] Layers panel (reorder, show/hide, lock, rename)
- [x] Full keyboard shortcuts (20+) and complete undo/redo
- [x] PNG/SVG export at 600 DPI, with or without mockup base

---

## Phase 2 — Backend & Admin Panel

**Status: Near complete — final items in progress**

- [x] Fastify REST API + PostgreSQL (Drizzle ORM) + MinIO storage, Docker Compose infrastructure
- [x] Full admin panel — products, templates, cliparts, fonts, printing types, orders, languages, settings
- [x] Editor ↔ API integration (load/save designs, merchant resource sync)
- [x] Cart flow (add to cart, manage quantities, persist to database)
- [x] BullMQ production job queue (300 DPI print files + 96 DPI mockups, custom fonts + Google Fonts)
- [x] Settings API with encrypted storage for third-party API keys
- [x] Product overlay/mask system (21 overlays across 7 product types)
- [x] Interactive zone editor (Konva) for calibrating print areas visually in the admin
- [x] Full i18n across editor and admin (English, Spanish, French shipped; more languages importable)
- [ ] AI-powered background removal upgrade (see [Future — Advanced AI](#future--advanced-ai))
- [ ] Displacement maps / texture blending — fabric-realistic mockups (design follows garment wrinkles/folds). **Confirmed in scope** — this is what makes the preview look like real fabric instead of a flat print, directly for the v1 push.
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

- [ ] **AI-powered background removal** — replace/augment the current threshold-based tool with a proper AI model (e.g. rembg), matching the quality bar set by commercial editors.
- [ ] **Generative fill / AI image completion** — let merchants extend or complete a design intelligently, similar to tools like Kittl.
- [ ] **High-resolution AI upscaling** — improve output quality for AI-generated and low-resolution uploaded images beyond what's produced today.

---

## Contributing

See [CONTRIBUTING.md](../CONTRIBUTING.md) for how to get involved. Areas where help is especially valuable right now: embroidery validation (machine access), product assets (displacement maps, print zone masks for new products), the WooCommerce plugin (PHP), and translations.
