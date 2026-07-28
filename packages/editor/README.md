# @openmerch/editor

The visual product design editor for OpenMerch Engine — a React + [Konva.js](https://konvajs.org/) canvas where customers upload images, add text/shapes/cliparts, and arrange them onto a product's print area (t-shirt, mug, phone case, poster, ...).

This package is built to be **embedded as a library** in any storefront, not just run standalone. `apps/demo` is a thin host app (fetches a product, renders `<ProductEditor product={...}/>`) — it exists to prove the package works outside its own build, the same way a real storefront integration would consume it.

The public API is `packages/editor/src/index.ts`; its exports are documented there with JSDoc. This README covers the architecture and the non-obvious design decisions behind it — read the source file for the exact export list and per-export contracts.

## Architecture

```
ProductEditor (mounts the whole editor as a page)
├── NavBar, SidebarPanel, TopToolbar, contextual popovers   → pure UI, read/write the store
├── CanvasView (Konva Stage)                                → renders `design.zones[activeZoneId].layers`
│   └── DesignLayer (image | text | shape)                  → one Konva node per layer, mm → px at render time
└── useEditorStore (Zustand)                                → single source of truth for product, design, history, cart
```

There's no component-level state for the design itself. Every component that needs to know what's on the canvas reads from `useEditorStore`, and every mutation (move a layer, add text, undo) goes through a store action. Components subscribe with selectors (`useEditorStore((s) => s.selectedLayerId)`) rather than destructuring the whole store, since the store also holds things like cart items and gallery state that don't need to trigger a canvas re-render.

`packages/core` supplies the shared types (`Product`, `ProductZone`, `Design`, `DesignLayer`, ...) and the mm/px conversion helpers — both the editor and the server-side renderer (`packages/renderer`) depend on it, which is what lets a design saved in the browser be re-rendered pixel-for-pixel by a headless worker for production output.

## Key concepts

### Everything is stored in millimeters, converted to pixels only at render time

`DesignLayer.x/y`, `fontSize`, `widthMM`/`heightMM`, etc. are all physical units (mm), not screen pixels. `CanvasView` computes a single `pxPerMM` for the current viewport (`layout.imgW / zone.baseImageWidthMM`, see `ProductEditor.tsx`) and every `DesignLayer` view multiplies by it just before handing coordinates to Konva (`x={layer.x * pxPerMM}`); every drag/transform handler divides by it on the way back out (`x: e.target.x() / pxPerMM`).

The reason: a design has to mean the same physical thing regardless of browser window size, zoom level, or DPI. If layers were stored in screen pixels, resizing the window or exporting at 600 DPI instead of the on-screen ~2-3 DPI-equivalent would require rewriting every layer's coordinates. Storing mm makes the saved `Design` JSON screen-independent and directly reusable by `packages/renderer`, which uses the exact same `mmToPx`/`pxToMm` (`packages/core/src/utils/units.ts`) to composite the final production file at 300-600 DPI. `MAX_RENDER_DIMENSION_PX` in that same file exists specifically to catch a common failure mode of this convention: a zone misconfigured with px values where mm were expected, which would otherwise blow up canvas allocation.

Text is the one place this gets subtle: `fontSize` is mm, so on transform-end (`DesignLayer.tsx`, `TextLayerView.handleTransformEnd`) the resize handle's scale is baked into `fontSize` immediately (`layer.fontSize * scale`) rather than left as a Konva `scaleX/scaleY`, so the stored value is always the true visual size and nothing downstream needs to multiply scale × fontSize separately.

### Layers live inside a Group clipped to the print area

In `ProductEditor.tsx`'s `CanvasView`, all design layers render inside a Konva `<Group>` anchored at `(layout.printX, layout.printY)` with `clipWidth/clipHeight` set to the print area size. Because Konva positions children relative to their parent, this has two effects at once: `layer.x/y === 0` is exactly the top-left of the print area (not the canvas), and anything a customer drags past the print area edge is clipped visually instead of needing per-layer bounds math.

The **overlay** (`zone.overlayImageUrl`) is a separate PNG rendered in a layer *above* the Group, non-listening, so it always draws on top of both the mockup and the design — it represents parts of the physical product that must stay visible over the artwork (a phone's camera cutout, a mug's handle/rim, a poster's frame). `exportDesign.ts` reproduces this same layering as a 3-pass composite (mockup → clipped design → overlay) so the exported PNG matches what the canvas showed, and `computePrintZoneCropRect` re-derives the clip rectangle in the export's own cropped pixel space so it isn't offset by whatever crop the mockup capture used.

### Undo/redo: snapshots, not diffs

`editorStore.ts` implements undo/redo as full snapshots of `zone.layers`, not a command/diff log. Every mutating action (`addImageLayer`, `updateLayer`, `removeLayer`, ...) calls `pushHistory(state)` before applying its change, which `structuredClone`s the *current* (pre-change) layers array into a `HistoryEntry { zoneId, layers }` and appends it to `history`, trimming anything past the current `historyIndex` (so redoing after a fresh edit correctly discards the abandoned future) and capping the array at `MAX_HISTORY = 50` entries.

`undo()` doesn't just move `historyIndex` back — it also snapshots the *current* state into the slot right after the undo point before restoring, so a redo has something concrete to return to even for the very first undo. History is per-zone (`HistoryEntry.zoneId`): undo/redo only applies if the entry's zone matches the currently active zone, so switching from "front" to "back" and hitting Ctrl+Z doesn't silently undo a "front" edit.

### Variant selection swaps the mockup and print zone without losing the design

`setVariant(variantId)` in `editorStore.ts` handles products where variants change more than color (e.g. phone case models, poster sizes) — when `variant.zones` is set, it swaps `product.zones` to the variant's own zones (different `baseImageUrl`/print area dimensions) but explicitly carries over `currentDesign?.zones[zone.id]?.layers` for any zone ID that already existed, so a customer who designed onto "back" and then picks a different iPhone model keeps their layers even though the mockup image and print area geometry just changed underneath them. Variants that don't carry their own zones (plain size/color variants) just update `selectedVariantId` and leave the design untouched.

### i18n: runtime translation with English as the implicit fallback

`useI18nStore` (`src/i18n/useTranslation.ts`) loads all active languages' key→string maps from the backend once (`loadLanguages(apiBase)`, called from `ProductEditor`'s mount effect) and persists the chosen language code to `localStorage` (`openmerch-lang`). Translation itself isn't a lookup table keyed by an abstract ID — the **English string is the key** (`t('Add to Cart')`), which is why `useT()` short-circuits to return the key unchanged whenever `currentLang === 'en'` or a translation is simply missing: the UI degrades to readable English text instead of showing a missing-key placeholder. This means every component just calls `t('Some English Sentence')` inline; there's no separate keys file to keep in sync with the JSX.

## Using it as a library

```tsx
import { ProductEditor, useEditorStore, ErrorBoundary } from '@openmerch/editor';
import type { Product } from '@openmerch/core';

const product: Product = await fetch('/api/v1/products/classic-tee').then((r) => r.json());

function StorefrontCustomizer() {
  return (
    <ErrorBoundary>
      <ProductEditor product={product} />
    </ErrorBoundary>
  );
}
```

`ErrorBoundary` is exported separately and is **optional** — `ProductEditor` doesn't wrap itself in one internally, so the consuming app decides whether a render error inside the editor should show a reload fallback (`ErrorBoundary`'s behavior) or bubble up to the host application's own error handling. `apps/demo` wraps with it; a storefront with its own error-boundary conventions is free not to.

`useEditorStore` and `useT`/`useI18nStore` are also exported for advanced integrations that need to read editor state or trigger actions (e.g. a custom "Add to Cart" button outside the editor's own footer) from the host app.

## Development

Run the standalone demo (a real Vite app that imports this package like any other consumer would):

```bash
pnpm install
docker compose up -d          # Postgres/Redis/MinIO, from the repo root
pnpm --filter @openmerch/api db:seed
pnpm dev                      # turbo run dev — starts the API (3001) and the demo (3000)
```

The demo will be at `http://localhost:3000`. It fetches the product catalog from the API; if the API is unreachable it falls back to a built-in sample t-shirt (`apps/demo/src/products/tshirt.ts`).

To iterate on the package itself without the full stack, `pnpm --filter @openmerch/editor dev` runs `vite build --watch`, which the demo's own dev server picks up via the workspace link.

### Tests

```bash
pnpm --filter @openmerch/editor test
```

Runs Vitest against `src/store/editorStore.test.ts` and `src/utils/exportDesign.test.ts` — the store's mutation/undo/redo logic and the export module's pure geometry helpers (`computePrintZoneCropRect`) are unit-tested directly; the Konva canvas rendering itself is exercised through the demo app rather than component tests.
