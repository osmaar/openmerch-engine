# @openmerch/demo

Standalone demo app for `@openmerch/editor`. It exists for two purposes at once:

1. **A manual test bed for the editor package** — a place to run `@openmerch/editor` against real products from the API without needing the full admin panel or a storefront.
2. **The minimal reference integration** — the smallest possible example of how any storefront (WooCommerce, a Shopify Hydrogen route, or a fully custom React app) would embed `<ProductEditor />` as a component. If you're building a new integration, start by reading `src/App.tsx` in this app before anything else.

It is a plain Vite + React 19 app with no build tooling beyond what's needed to run the editor package.

## Running it

```bash
pnpm --filter @openmerch/demo dev
```

Starts on **`http://localhost:3000`** (configured in `vite.config.ts`; also the port referenced in the root [README](../../README.md#quick-start)). Requires the API to be running (see root README `pnpm dev` / Docker Compose setup) — the app fetches product data from it on load.

```bash
pnpm --filter @openmerch/demo build   # tsc + vite build, output to dist/
pnpm --filter @openmerch/demo preview # serve the production build
```

## How product loading works

On mount (`src/App.tsx`), the app:

1. Reads `?product=<id-or-slug>` from the URL, falling back to whatever was last saved in `localStorage` (`openmerch-product-slug`).
2. Calls `GET {VITE_API_URL}/api/v1/products` to fetch the full product list.
3. Filters that list down to products that are **active** and have **at least one zone** (`p.active && p.zones.length > 0`) — i.e. products that are actually ready to be edited.
4. If the URL/localStorage id or slug matches one of those, it loads that product. Otherwise it falls back to the **first** active product with zones.
5. If the fetch fails entirely (API down), it falls back to a hardcoded local product, `tshirtProduct` (`src/products/tshirt.ts`), so the demo still renders something.

Once the editor itself changes the active product (via its built-in product-selector modal), `App.tsx` subscribes to `useEditorStore` and mirrors that choice back into the URL (`window.history.replaceState`) and `localStorage`, so reloading or sharing the URL keeps the same product selected. This is why the URL updates to `?product=<slug>` as you switch products inside the editor — that's the app syncing outward from the store, not a router.

## The integration pattern this app demonstrates

This is the whole integration surface, reduced to its essentials:

```tsx
import { ProductEditor, useEditorStore } from '@openmerch/editor';
import type { Product } from '@openmerch/core';

// 1. Get a Product object (zones, variants, categories) from wherever
//    your catalog lives — here, the OpenMerch API; in your own store,
//    your own product/catalog data mapped into the same shape.

// 2. Optionally push API keys for optional editor features into the
//    editor's own Zustand store before rendering:
const { setUnsplashKey, setPollinationsKey } = useEditorStore();
setUnsplashKey(unsplashKey);
setPollinationsKey(pollinationsKey);

// 3. Mount the editor, keyed by product id so it fully remounts
//    (and resets internal state) when the product changes:
<ErrorBoundary>
  <ProductEditor key={product.id} product={product} />
</ErrorBoundary>
```

Key points a real integration should take from this:

- **`<ProductEditor product={product} />` is the entire embed surface.** It's a self-contained React component — no iframe, no postMessage, because the host here is already a React app (same reasoning documented for Shopify Hydrogen in `docs/integrations/shopify.md`).
- **`key={product.id}`** forces React to unmount/remount the editor when the product changes, instead of trying to reconcile internal Konva/canvas state across unrelated products.
- **Wrapping in `<ErrorBoundary />`** (`src/components/ErrorBoundary.tsx`) is recommended but not required by the package itself — it's host-app responsibility. It catches render errors anywhere in the editor's subtree and shows a "Something went wrong / Reload Page" fallback instead of a blank white screen. Any host embedding the editor should consider doing the same, since a canvas/rendering library is exactly the kind of dependency you want isolated from the rest of the page.
- **Optional third-party keys** (Unsplash photos, Pollinations AI image generation) are pushed into the editor's own store via `useEditorStore` hooks (`setUnsplashKey`, `setPollinationsKey`) rather than passed as props — they're genuinely optional editor features, not part of the required contract.
- **Connecting to the API is just a base URL.** `API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001'` — there's no runtime port detection; it's a Vite env var with a hardcoded local-dev default. A real deployment sets `VITE_API_URL` at build time to point at its actual API origin.

What this demo does **not** show, because it's out of scope for a same-origin React embed: exporting the design and adding it to a cart. That contract (`onExport(pngBlob, meta)`, cart line-item attributes, production-job triggering) is documented separately in [`docs/integrations/shopify.md`](../../docs/integrations/shopify.md) — read that once you've understood the mounting pattern here. Think of this app as the "no cart, no checkout, no Shopify" version of the same embedding pattern: same `<ProductEditor product={product} />` call, same reasoning for skipping an iframe when the host is React, just without the e-commerce plumbing around it.

## Files

- `src/App.tsx` — product loading/selection and the `<ProductEditor>` mount point described above.
- `src/main.tsx` — standard React 19 `createRoot` bootstrap.
- `src/components/ErrorBoundary.tsx` — render-error fallback wrapped around the editor.
- `src/products/tshirt.ts` — hardcoded fallback `Product` used only if the API is unreachable.
