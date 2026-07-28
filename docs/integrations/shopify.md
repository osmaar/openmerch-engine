# Integrating the OpenMerch Editor with Shopify

> **Status:** Reference pattern — no scaffolded plugin package yet (there is no
> `plugins/plugin-shopify` in this repo today). This document describes the
> integration pattern validated in a real production deployment, generalized
> so any merchant or theme developer can implement it. Contributions that turn
> this into a proper `plugins/plugin-shopify` package are welcome.

This guide explains how to embed the OpenMerch product editor
(`@openmerch/editor`, built with React 19 and Konva) inside a Shopify store so
customers can personalize a product and have that personalization carried
through checkout, order processing, and production.

It does **not** assume any specific store, theme, or product catalog — the
patterns below are storefront-agnostic and apply to any merchant running
Shopify.

## 1. Overview: Headless vs. Classic

Shopify storefronts fall into two integration shapes, and the recommended
approach differs for each:

| Storefront type | Example stack | Recommended pattern |
|---|---|---|
| **Headless** | Hydrogen (React Router based), or any custom storefront built on the Storefront API | **Pattern A — Embedded React Component** |
| **Classic / themed** | Liquid themes (Online Store 2.0, Dawn-based or custom themes) | **Pattern B — iframe + postMessage** |

The key driver is simple: if the storefront is already a React application
(as Hydrogen is), there is no reason to introduce an iframe boundary. The
editor can be imported and rendered as a first-class component, sharing the
page's layout, styles, and state. If the storefront is server-rendered Liquid
with no React runtime, an iframe is the pragmatic, framework-independent
choice — the same conceptual pattern documented for the WooCommerce
integration (see `plugins/plugin-woocommerce`, currently a scaffold).

## 2. Pattern A — Embedded React Component (Headless / Hydrogen)

This is the **preferred pattern for any React-capable storefront**, including
Shopify Hydrogen.

### 2.1 Install the editor package

```bash
npm install @openmerch/editor
```

(Package name and distribution channel depend on how OpenMerch is published
for your workspace — this document assumes it is available as an npm
workspace/package dependency.)

### 2.2 Render the editor and handle export

The storefront owns the surrounding page (product info, add-to-cart button,
pricing) and mounts `ProductEditor` for the customization step. The contract
between the storefront and the editor is a single callback: `onExport`.

```tsx
// app/routes/products.$handle.customize.tsx (Hydrogen / React Router route)
import { ProductEditor } from '@openmerch/editor';
import { useFetcher } from 'react-router';

export default function CustomizeProduct({ product }: { product: EditorProduct }) {
  const cartFetcher = useFetcher();

  async function handleExport(pngBlob: Blob, meta: DesignExportMeta) {
    // 1. Upload the rendered design to your own storage (Shopify Files API,
    //    S3, R2, etc.) and obtain a publicly reachable URL.
    const designUrl = await uploadDesignToStorage(pngBlob, meta);

    // 2. Add the product to the cart via the Storefront API, attaching the
    //    design as line item custom attributes (see section 5).
    cartFetcher.submit(
      {
        action: 'LinesAdd',
        lines: JSON.stringify([
          {
            merchandiseId: product.variantId,
            quantity: 1,
            attributes: [
              { key: '_design_url', value: designUrl },
              { key: '_design_key', value: meta.designKey },
              { key: '_design_filename', value: meta.filename },
              { key: '_design_dimensions', value: `${meta.widthMm}x${meta.heightMm}mm` },
            ],
          },
        ]),
      },
      { method: 'post', action: '/cart' } // CartForm-backed route
    );
  }

  return (
    <ProductEditor
      product={product}
      onExport={handleExport}
    />
  );
}
```

### 2.3 Why not iframe here?

Wrapping a React component in an iframe when the host is already React adds:

- A cross-origin (or same-origin-but-isolated) message bus for no benefit.
- Duplicate bundling of React/React-DOM inside the iframe.
- Loss of natural prop/callback flow, CSS variable inheritance, and shared
  design tokens with the rest of the storefront.

Since Hydrogen storefronts are React applications end to end, importing
`@openmerch/editor` directly and wiring `onExport` to the Storefront API is
strictly simpler and keeps the customization step inside the same React tree
as the rest of the checkout funnel.

## 3. Pattern B — iframe + postMessage (Classic / Liquid Themes)

For themes without a React runtime, embed the editor as a standalone hosted
page inside an `<iframe>` and communicate with `window.postMessage`.

### 3.1 Theme section (Liquid)

```html
<!-- sections/openmerch-editor.liquid -->
<div id="openmerch-editor-container">
  <iframe
    id="openmerch-editor-frame"
    src="https://editor.example.com/embed?product={{ product.id }}&variant={{ product.selected_or_first_available_variant.id }}"
    style="width: 100%; height: 720px; border: 0;"
    allow="clipboard-write"
  ></iframe>
</div>

<script>
  (function () {
    var ALLOWED_ORIGIN = 'https://editor.example.com';
    var frame = document.getElementById('openmerch-editor-frame');

    window.addEventListener('message', function (event) {
      if (event.origin !== ALLOWED_ORIGIN) return;
      if (event.data?.type !== 'openmerch:export') return;

      var meta = event.data.meta;
      var designUrl = event.data.designUrl; // hosted editor already uploaded it

      // Add to cart via Shopify AJAX Cart API, attaching design metadata
      // as line item properties (Shopify's classic-theme equivalent of
      // Hydrogen's custom attributes).
      fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            {
              id: meta.variantId,
              quantity: 1,
              properties: {
                _design_url: designUrl,
                _design_key: meta.designKey,
                _design_filename: meta.filename,
                _design_dimensions: meta.widthMm + 'x' + meta.heightMm + 'mm',
              },
            },
          ],
        }),
      }).then(function () {
        window.location.href = '/cart';
      });
    });
  })();
</script>
```

### 3.2 Editor side (hosted embed page)

The hosted editor page (an internally-served page that renders
`ProductEditor` with `onExport` wired to `postMessage` back to the parent)
posts the result once the export/upload completes:

```ts
function handleExport(pngBlob: Blob, meta: DesignExportMeta) {
  uploadDesignToStorage(pngBlob, meta).then((designUrl) => {
    window.parent.postMessage(
      { type: 'openmerch:export', designUrl, meta },
      'https://storefront.example.com' // exact parent origin, never '*'
    );
  });
}
```

**Security note:** always validate `event.origin` on the receiving end (both
directions) and never use `'*'` as the target origin in production. Treat the
iframe embed URL and the parent storefront origin as a fixed, explicitly
allow-listed pair.

This is the same conceptual pattern intended for non-React e-commerce
platforms in general — e.g. the WooCommerce integration
(`plugins/plugin-woocommerce`) is expected to follow this same iframe +
postMessage contract once implemented, since a classic WordPress/WooCommerce
page has no React runtime either.

## 4. Contract: What the Editor Exports

Regardless of pattern (A or B), the editor's output contract is the same two
values passed to `onExport(pngBlob, meta)`:

- **`pngBlob: Blob`** — the rendered design as a PNG (from the Konva stage),
  at production-ready resolution.
- **`meta: DesignExportMeta`** — a metadata object describing the export:

```ts
interface DesignExportMeta {
  designKey: string;       // opaque identifier for this design (used to re-fetch
                            // the full design document / layers later if needed)
  filename: string;        // suggested filename, e.g. "design-<designKey>.png"
  widthMm: number;         // physical print width in millimeters
  heightMm: number;        // physical print height in millimeters
  productId: string;       // the product this design was created for
  variantId?: string;      // the selected variant, if applicable
}
```

The storefront (or hosted embed page, in Pattern B) is responsible for:

1. Persisting the PNG somewhere publicly fetchable (own storage, CDN, or a
   files endpoint you control).
2. Obtaining a stable public URL for that PNG.
3. Attaching that URL — plus the rest of `meta` — to the cart line as
   line-item properties / custom attributes.

The editor itself never talks to Shopify's API directly. This keeps
`@openmerch/editor` platform-agnostic: the same component works behind
Hydrogen, WooCommerce, or any other cart system, because the cart integration
lives entirely in the `onExport` callback.

## 5. Cart Attribute Mapping

Whether added via Storefront API `CartForm` (Hydrogen) or the classic
`/cart/add.js` AJAX endpoint, the recommended attribute keys are:

| Attribute key | Value | Purpose |
|---|---|---|
| `_design_url` | Public URL of the exported PNG | Source file for production and order review |
| `_design_key` | Opaque design identifier | Correlates the cart line back to the design record for re-generation or audit |
| `_design_filename` | Suggested filename | Used when generating production files or customer-facing order summaries |
| `_design_dimensions` | `"<width>x<height>mm"` | Physical print dimensions for the production pipeline |

Prefixing keys with an underscore (`_design_url`, etc.) follows Shopify's
convention for line item properties that should be hidden from the customer
in cart/checkout UI but remain readable via the Admin API and webhooks —
appropriate here since these are internal production references rather than
customer-facing options.

These attributes are readable later from:

- The Admin API, on `order.line_items[].properties` (classic) or
  `order.lineItems[].customAttributes` (GraphQL Admin API / Storefront API
  shape), and
- Webhook payloads such as `orders/paid`, which include the same line item
  properties/custom attributes.

## 6. Triggering Production (Optional)

Once an order is paid, a webhook handler for `orders/paid` can read the
`_design_url` / `_design_key` attributes off each line item and enqueue a
production job. This repository already includes a BullMQ-based worker for
generating production-ready files from a design record — see
`packages/api/src/jobs/workers/production-files.worker.ts` and the
surrounding queue setup in `packages/api/src/jobs/`.

A typical flow:

1. Shopify sends `orders/paid` to a webhook endpoint you host.
2. The handler extracts `_design_key` (and/or `_design_url`) from each
   relevant line item.
3. The handler enqueues a production-file job (e.g. via the existing BullMQ
   queue) referencing that design key.
4. The worker generates print-ready output (vector/high-res raster, per your
   production pipeline) and stores it for fulfillment.

This step is entirely optional and decoupled from the editor/cart
integration above — a merchant can adopt Pattern A or B for the editor and
cart step without wiring up automated production file generation, and add it
later.

## 7. Status

This document describes a **reference pattern**, validated against a real
Shopify Hydrogen production integration and generalized here with no
merchant-specific names, domains, or data. There is currently no scaffolded
`plugins/plugin-shopify` package in this monorepo — the WooCommerce plugin
directory (`plugins/plugin-woocommerce`) is likewise still an empty scaffold.

Contributions that turn this pattern into a maintained, installable plugin
package (Shopify or WooCommerce) are welcome.
