# @openmerch/renderer

Server-side 2D compositing engine for OpenMerch Engine. It takes a design's
saved `designData` (shape/image/text layers per product zone) and rasterizes
it to PNG, using [Konva](https://konvajs.org/) running on Node.js via
[`canvas`](https://www.npmjs.com/package/canvas) (node-canvas / Cairo)
instead of a browser.

It is consumed by the BullMQ worker in `packages/api`
(`production-files.worker.ts`) to produce, per product zone, on every
production-file render job:

- **Print file** — `renderDesignZone`: the bare design at 300 DPI on a
  transparent background. This is the contractual output that goes to the
  printer.
- **Mockup** — `renderDesignZoneMockup`: the design composited over the
  product's base image (with optional color tint) and under its overlay
  image, at 96 DPI. This is a low-res visual reference for the merchant, not
  a print artifact — its failure doesn't fail the job.

## Why Konva runs on the server ("zero-divergence rendering")

The editor lets the customer position text, apply curved/wave/bridge text
effects, and tint product images — all rendered live in the browser with
Konva. The production file has to match that preview *exactly*: same text
curvature, same tint color math, same pixel layout, just at print resolution
instead of screen resolution.

Reimplementing that layout math a second time for the server would
eventually drift from the client (a fixed bug or tweak in one place but not
the other), so instead the pure, environment-agnostic math lives once in
`@openmerch/core` and both sides call it:

- `computeEffectPositions` — per-character placement for curved/bridge/wave
  text effects (`packages/core/src/utils/text-effects.ts`).
- `tintImagePixels` — the luminance-preserving color tint applied to product
  base images and to tinted image layers.

This package only supplies the pieces that are genuinely Node-specific:
constructing the Konva scene graph, measuring glyph widths with node-canvas's
`measureText` (see `layers/text-effects.ts`), rasterizing the result to a
canvas, and registering font files with `canvas.registerFont()`. Everything
that affects *where things land* is shared; everything that's *how to draw
on this particular platform* lives here.

## Konva server-side interop

Konva ships one full set of TypeScript typings, modeled on its browser build
(`konva/lib/index.d.ts`). This package doesn't import that build — it
dynamically imports `konva/lib/index-node.js`, the CJS entry that swaps in
node-canvas instead of the DOM `<canvas>`. That entry has no dedicated
`.d.ts`, and its runtime shape isn't contractually guaranteed to line up with
the browser typings.

Rather than lying to the type checker by casting the node import to the
browser types, `konva-types.ts` hand-rolls a minimal `KonvaModule` interface
covering only the constructors/methods this package actually calls (`Stage`,
`Layer`, `Group`, the shape primitives, `Image`, `Text`). `konva-node.ts`
dynamically imports the node entry once (cached) and asserts it against that
narrower, honest contract. Extend `konva-types.ts` if the renderer starts
using more of Konva's API.

## Dimension clamp

Both render functions compute the target pixel size from the zone's
millimeter dimensions and DPI, then reject anything over
`MAX_RENDER_DIMENSION_PX` (from `@openmerch/core`, ~4961px — A3's long edge
at 300 DPI). This exists so a misconfigured product (e.g. print-area
dimensions accidentally entered in pixels instead of millimeters) fails fast
with a clear error instead of the worker trying to allocate a huge
Konva `Stage`/canvas and running out of memory.

## Usage

```ts
import { renderDesignZone, renderDesignZoneMockup } from '@openmerch/renderer';

const printResult = await renderDesignZone({
  zone: renderZone,
  layers,
  dpi: 300,
  resolveImage: (src) => imageResolver.resolve(src),
  resolveFont: (family) => fontResolver.resolve(family),
  resolveFontById: (id) => fontResolver.resolveById(id),
});

const mockupResult = await renderDesignZoneMockup({
  zone: renderZone,
  layers,
  dpi: 96,
  resolveImage: (src) => imageResolver.resolve(src),
  resolveFont: (family) => fontResolver.resolve(family),
  resolveFontById: (id) => fontResolver.resolveById(id),
  productColor: design.productColor ?? undefined,
});
```

(See `packages/api/src/jobs/workers/production-files.worker.ts` for the full
call site, including per-zone error isolation and MinIO uploads.)

The package never imports MinIO, HTTP clients, or the DB directly — resolving
a layer's `src` to image bytes and a font family to a local file path is
always delegated to caller-supplied `resolveImage`/`resolveFont`/
`resolveFontById` callbacks.

## Tests

```sh
pnpm --filter @openmerch/renderer test
```
