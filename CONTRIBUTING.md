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

4. Start the development server:

```bash
pnpm dev
```

## Project Structure

This is a monorepo managed with pnpm workspaces and Turborepo.

- `packages/core` — shared TypeScript types and utilities
- `packages/editor` — React + Konva.js canvas editor
- `packages/api` — Fastify REST API
- `packages/renderer` — 2D compositing engine with Sharp
- `packages/embroidery` — Python microservice for DST/PES generation
- `apps/demo` — standalone demo app

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

- Unit tests use **Vitest**
- Name test files: `functionName.test.ts`
- At least one test per business logic function

## Areas Where Help is Needed

- **Embroidery validation** — testing DST/PES output on physical machines (Tajima, Brother, Barudan)
- **Product assets** — lighting overlays, print zone masks for new products
- **WooCommerce plugin** — PHP development
- **Translations** — multilingual editor UI

## Reporting Issues

Open an issue on GitHub with:

- Steps to reproduce
- Expected vs actual behavior
- Browser/OS/Node version

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
