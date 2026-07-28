# @openmerch/admin

Merchant admin panel for OpenMerch Engine — a self-hosted back office where a store
owner manages the product catalog, design assets, printing rules, orders, and
storefront settings that the editor (`packages/editor`) and API (`packages/api`)
consume.

React 19 + Mantine UI 9 + React Router 7, built with Vite. Talks to `packages/api`
(Fastify) over REST; runs on port `3002` in dev.

## No authentication (intentional)

The admin panel ships with **no login, no sessions, no RBAC**. This is a deliberate
scope decision, not a missing feature:

- OpenMerch Engine is self-hosted, single-tenant software — one installation belongs
  to one merchant. There is no multi-tenant SaaS concept to guard against.
- The API (`packages/api`) has no authentication/authorization layer either — every
  route is an open REST endpoint (CORS via `CORS_ORIGIN`, default `*`). The admin
  panel simply reflects that: it doesn't gate a boundary the backend doesn't enforce.
- The trust model matches self-hosted tools like a Strapi dev instance, n8n, or
  Plausible: whoever has network access to the box is assumed to be authorized.
  Adding a fake login screen on top of an unauthenticated API would be theater, not
  security.
- Consequence: there used to be a hardcoded `UserButton` ("Merchant / admin@openmerch.com")
  in the sidebar footer. It was removed — without real sessions it was permanent
  placeholder noise, not a real feature — and replaced with a plain copyright line.

**Operational implication:** if you expose this admin panel beyond localhost/LAN, put
it behind a reverse proxy that does authentication (Basic Auth, OAuth2 Proxy,
Cloudflare Access, a VPN, etc.). Do not expose `apps/admin` directly to the public
internet. Proper multi-user auth (accounts, roles, permissions) is tracked as a
post-MVP item, not something this app currently does on its own.

## Modules

One page per catalog/back-office concern, all under `src/pages/`:

| Module | Route | What it manages |
|---|---|---|
| Dashboard | `/` | Stats overview (products, designs, orders, API health) |
| Products | `/products`, `/products/:id/edit` | Product catalog: base info, print zones (`ZoneEditor`), variants, attributes |
| Designs | `/designs` | Customer-created designs (saved from the editor), production file generation |
| Templates | `/templates` (hidden from nav) | Reusable starter designs — incomplete feature, needs a real design editor, not just file upload |
| Cliparts | `/cliparts` | SVG clipart library available in the editor |
| Shapes | `/shapes` | SVG clip-shape library available in the editor |
| Fonts | `/fonts` | Custom font uploads + Google Fonts registration |
| PrintingTypes | `/printing` | Printing techniques (Sublimation, DTG, DTF, Embroidery, …) and their pricing calc methods |
| Orders | `/orders` | Order list, linked designs, production status |
| Languages | `/settings/languages` | Active storefront/editor languages + translation strings editor |
| Settings | `/settings` | Store name, favicon, branding toggle, API keys (Unsplash/Pollinations), design storage mode |

## Non-obvious decisions

- **Mantine UI over shadcn/ui + Tailwind.** Chosen for the admin specifically (the
  editor and demo app are plain CSS/Konva) — Mantine gives a complete, consistent
  component set (Table, Modal, Notifications, Dropzone, Form) out of the box, which
  matters more for a data-heavy CRUD back office than for the canvas-focused editor.
- **Two separate i18n systems, on purpose.** The admin has its own runtime i18n store
  (`src/i18n/useTranslation.ts`, Zustand-based `useI18nStore` + `useT()` hook) that is
  completely independent from the editor's i18n. Same pattern (English key = source of
  truth, fallback to English if a translation is missing, translations fetched from
  `GET /api/v1/languages/active`), but:
  - Admin persists its language in `localStorage['openmerch-admin-lang']`.
  - The editor persists its own in a different key (`openmerch-lang`).
  - This means an admin user and a storefront customer can browse in different
    languages independently, and the two apps can be deployed/updated separately
    without one's i18n state leaking into the other.
- **Backend stays English-only.** Error strings from `packages/api` (`Product not
  found`, `No file uploaded`, etc.) are returned in English and translated client-side
  through the same `t()` pipeline as UI copy (see `services/api.ts`'s `ApiError`).
  There is no `Accept-Language` handling server-side — deemed unnecessary complexity
  for the MVP.
- **Route-level code-splitting via `React.lazy` + `Suspense`.** `App.tsx` eagerly
  imports only `Dashboard` (the index route); every other page (`Products`, `Designs`,
  `Templates`, `Cliparts`, `Shapes`, `Fonts`, `PrintingTypes`, `Orders`, `Languages`,
  `SettingsPage`, `ProductEdit`) is `lazy()`-loaded per route, with a shared
  `RouteFallback` (`Loader` inside `Center`) as the `Suspense` fallback, and the whole
  router tree wrapped in an `ErrorBoundary` (`src/components/ErrorBoundary.tsx`) so a
  chunk failure or render error in one page doesn't blank the whole app.
- **`ZoneEditor` (Konva) for print-zone editing.** `ProductEdit` uses an interactive
  Konva `Stage` (`src/components/ZoneEditor.tsx`) — draggable/resizable rect with a
  `Transformer` — instead of plain numeric inputs, so merchants can visually place the
  printable area over the product mockup (with MM↔px conversion handled for them).
  `konva` + `react-konva` are admin dependencies for this reason alone.

## Development

```bash
pnpm --filter @openmerch/admin dev
```

Runs on `http://localhost:3002` (see `vite.config.ts`). Expects the API
(`packages/api`) reachable at `http://localhost:3001` (override with `VITE_API_URL`).

## Build

```bash
pnpm --filter @openmerch/admin build
```

Runs `tsc` (type-check) followed by `vite build`, output in `dist/`.
