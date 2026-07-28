# Contributing to OpenMerch Engine

Thanks for your interest in contributing! This guide will help you get started.

## Development Setup

1. Fork and clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Start infrastructure (PostgreSQL, Redis, MinIO):

```bash
docker compose up -d
```

4. Seed the database (translations + starter product catalog — skip this and you'll have an empty DB):

```bash
pnpm --filter @openmerch/api db:seed
```

5. Start the development server:

```bash
pnpm dev
```

See each package's own `README.md` for module-specific details (what it does, why it's built that way, how to consume it).

## Project Structure

This is a monorepo managed with pnpm workspaces and Turborepo.

- `packages/core` — shared TypeScript types and utilities, consumed by editor/api/renderer
- `packages/editor` — React + Konva.js canvas editor, published as a consumable library
- `packages/api` — Fastify REST API + BullMQ production worker
- `packages/renderer` — 2D compositing engine (Sharp + server-side Konva) used by the production worker
- `packages/embroidery` — placeholder for a future Python DST/PES microservice (not implemented — see [docs/ROADMAP.md](docs/ROADMAP.md#post-mvp--explicitly-out-of-scope-for-now))
- `apps/admin` — merchant admin panel (React + Mantine)
- `apps/demo` — standalone demo app embedding the editor
- `plugins/plugin-woocommerce` — placeholder for a future WooCommerce bridge (not implemented — same Post-MVP status as embroidery)
- `products/` — product mockups + overlays consumed by the worker; `overlays-products-base/` holds the PSD sources
- `docs/` — public documentation (architecture, API reference, roadmap, integration patterns), each shipped in English + Spanish

## Branching Strategy

```
main            ← always stable, production-ready
develop         ← integration branch, features merge here first
feature/xxx     ← one branch per feature, created from develop
fix/xxx         ← bug fixes, created from develop
```

- **Never push directly to `main` or `develop`**
- All changes go through pull requests
- PRs require maintainer approval before merging
- CI must pass before a PR can be merged

## Making Changes

1. Create a branch from `develop`:

```bash
git checkout develop
git pull origin develop
git checkout -b feature/my-feature
```

2. Make your changes
3. Run checks before submitting:

```bash
pnpm build
pnpm test
pnpm lint
```

4. Push your branch and open a pull request **toward `develop`** (not `main`)
5. Wait for CI checks to pass and maintainer review

## Code Style

- TypeScript strict mode — no `any` types
- All internal measurements in **millimeters (mm)**, never pixels
- Prettier handles formatting automatically
- ESLint enforces code quality rules

## Testing

- Unit tests use **Vitest**; coverage thresholds are enforced at the root (`vitest.config.ts`, currently 20% as a floor, not a target — raise it as coverage grows)
- Name test files: `functionName.test.ts`
- At least one test per business logic function

## API Documentation

`packages/api` is schema-first (every route declares a Fastify JSON schema) and ships interactive docs generated from those schemas: run the API and open `http://localhost:3001/api/v1/docs` (Swagger UI). Adding a route without a `schema` block will be flagged in review — the schema *is* the documentation, don't duplicate it in comments.

## Areas Where Help is Needed

### In active scope — just needs hands

- **iPhone Case overlays — 30 of 31 models missing.** Only the iPhone 17 Pro Max ships with an overlay today; the other 30 models (iPhone 7 through 17 Pro, non-Max sizes, etc.) render without one. The full step-by-step process (Photoshop template, export, file placement, catalog entry) is documented in `overlays-products-base/case iphone/TODO.txt` — no code changes needed, just design work per model. Good first contribution if you have Photoshop and patience.
- **Product assets, general** — lighting overlays and print zone masks for any new product added to the catalog.
- **Translations** — the editor and admin panel both support multi-language import via the admin UI; official languages beyond English/Spanish/French are welcome as PRs to `packages/api/seeds/translations/`.

### Post-MVP — not being built in-house right now

Explicitly **not** on the maintainer's active roadmap (see [docs/ROADMAP.md](docs/ROADMAP.md#post-mvp--explicitly-out-of-scope-for-now) for why) — contributions welcome on any of these, they're just not planned internally:

- **Embroidery microservice + validation** — `packages/embroidery` is an empty placeholder; testing DST/PES output requires physical machines (Tajima, Brother, Barudan)
- **WooCommerce plugin** — `plugins/plugin-woocommerce` is an empty placeholder; PHP development, iframe + postMessage bridge
- **Shopify integration** — a generic embedding pattern is documented ([docs/integrations/shopify.md](docs/integrations/shopify.md)), but no plugin package exists yet

## Reporting Issues

Open an issue on GitHub with:

- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Node version

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
