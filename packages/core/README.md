# @openmerch/core

Shared types and framework-agnostic utilities used by `packages/editor` (browser),
`packages/api` (Node/server) and `packages/renderer` (Node, print output). It exists
so that the design/product domain model and the math around it — mm↔px conversion,
text-effect layout, product-image tinting — are defined exactly once instead of being
duplicated (and drifting) between the browser editor and the server-side renderer.

This package has no DOM or React dependency and no Konva dependency. Everything in it
must run in both a browser and plain Node.

## What it exports

### Domain types (`src/types`)

| Type | What it is |
| --- | --- |
| `Design` | A saved design: product id, active zone, and a map of `DesignZone`s. |
| `DesignZone` | One printable zone of a design — canvas size in mm plus its `DesignLayer[]`. |
| `DesignLayer` | Union of `ImageLayer \| TextLayer \| ShapeLayer`. |
| `BaseLayer` | Transform (position/rotation/scale/skew), opacity, lock/visibility fields shared by every layer. |
| `ImageLayer` | A placed raster image layer, including its original (pre-crop) size in mm. |
| `TextLayer` | A placed text layer; `fontSize` is in **mm**, plus an optional `TextEffect`. |
| `TextEffect` | Curved / bridge / wave text-effect parameters (radius, spacing, curve, height, offset). |
| `ShapeLayer` | A placed vector shape (rect, circle, star, etc.), sized in mm. |
| `Product` | Catalog entry: zones, optional variants, categories. |
| `ProductZone` | A print area on a product (or variant), positioned in mm on the base mockup image. |
| `ProductVariant` | A variant (phone model, garment size) that can override a product's zones. |
| `DecorationTechnique` | `'sublimation' \| 'screenPrinting' \| 'embroidery'`. |
| `TechniqueConstraints` / `TECHNIQUE_CONSTRAINTS` | Per-technique production constraints (min DPI, color limit, etc.) used to validate a design is producible. |

### Utilities (`src/utils`)

| Export | What it does |
| --- | --- |
| `mmToPx`, `pxToMm`, `MM_PER_INCH` | Convert between millimeters (the unit all design/product dimensions are stored in) and pixels at a given DPI. |
| `MAX_RENDER_DIMENSION_PX` | Sanity ceiling on a rendered zone's pixel width/height, used by the renderer to reject misconfigured products (e.g. mm values entered as px) before allocating a canvas. |
| `curvedPositions`, `bridgePositions`, `obliquePositions` | Per-effect character layout math for the curved/bridge/wave text effects. |
| `computeEffectPositions` | Dispatches to the right layout function based on `TextEffect.type`; returns `null` when there's nothing to lay out. |
| `EffectCharPosition` | Per-character `{ char, x, y, rotation }` result of the above. |
| `tintImagePixels` | Recolors a product mockup image in place to a customer-chosen color, preserving garment shading. |
| `isWhiteTintColor` | True for the "no tint" (white) product color, so callers can skip the tint pass. |
| `TintableImage` | Minimal `{ data, width, height }` shape accepted by `tintImagePixels`. |

## Design decisions worth knowing

- **Units are mm, not px.** Designs and products are stored in millimeters so that a
  print size is invariant regardless of screen DPI or which side (editor vs. renderer)
  is looking at it. `mmToPx`/`pxToMm` always take an explicit `dpi` argument — the
  editor converts using the screen's reference DPI, the renderer using the print DPI —
  because "pixels" only have a physical size once a resolution is fixed.
- **No DOM/Konva dependency, deliberately.** `tintImagePixels` takes a duck-typed
  `TintableImage` (`{ data, width, height }`) instead of the DOM `ImageData` type, and
  `computeEffectPositions` takes plain `charWidths: number[]` instead of a Konva/Canvas
  text-measurement object. This lets the exact same algorithm run against a browser
  `<canvas>` in the editor and a `node-canvas` buffer in the renderer, guaranteeing the
  server-generated production file matches what the customer saw while designing.
- **`computeEffectPositions` is unit-agnostic on purpose.** It doesn't know or care
  whether `charWidths` are raw px or mm-derived px — that stays the caller's
  responsibility, since the editor and renderer measure glyphs differently.
- **`TECHNIQUE_CONSTRAINTS` is data, not logic.** Validation rules for a decoration
  technique (min DPI, color limits, vector-text requirement...) live as a plain
  constant table here so both the editor (pre-flight warnings) and the API
  (production-file generation) check the same numbers.

## Usage

```ts
import { mmToPx, computeEffectPositions } from '@openmerch/core';
import type { TextLayer, TextEffect } from '@openmerch/core';

const pxPerMM = mmToPx(1, 300); // px per mm at 300 DPI

const positions = computeEffectPositions(
  layer.text,
  layer.textEffect,
  charWidths, // measured by the caller (browser Canvas or node-canvas)
  layer.letterSpacing,
);
// positions is null if textEffect.type === 'none' — fall back to plain text.
```

## Tests

```sh
pnpm --filter @openmerch/core test
```
