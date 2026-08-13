# plugin-woocommerce

The WordPress/WooCommerce integration for OpenMerch Engine lives in [`openmerch-woocommerce/`](openmerch-woocommerce/) as a self-contained, installable WordPress plugin.

## What it does

A WooCommerce PHP plugin that embeds the OpenMerch editor on the WooCommerce product page via an iframe + `postMessage` bridge (see the "WooCommerce Integration" section of the [root README](../../README.md#woocommerce-integration), and [docs/integrations/shopify.md](../../docs/integrations/shopify.md) for the platform-agnostic version of the same pattern). The merchant installs the plugin, points it at their OpenMerch Engine URLs (editor + API), and maps individual WooCommerce products to OpenMerch products. The customer designs the product in the embedded editor, and on export the design is added to the WooCommerce cart and carried through to the order's line item meta; a WooCommerce webhook (registered automatically on activation) notifies OpenMerch when the order is paid, so production files can be generated. Per the project's own principle, the plugin is a "dumb bridge" — all logic stays in the OpenMerch API.

See [`openmerch-woocommerce/readme.txt`](openmerch-woocommerce/readme.txt) for the WordPress.org-style plugin readme (installation, FAQ, changelog).

## Structure

```
openmerch-woocommerce/
  openmerch-woocommerce.php          # Plugin bootstrap (header, activation/deactivation)
  includes/
    class-openmerch-settings.php     # wp-admin > WooCommerce > OpenMerch settings page
    class-openmerch-product-meta.php # Per-product OpenMerch ID mapping meta box
    class-openmerch-editor-embed.php # Front-end iframe injection
    class-openmerch-cart.php         # postMessage -> cart -> order line item meta bridge
    class-openmerch-webhook.php      # WooCommerce webhook registration (order.updated)
  assets/
    js/openmerch-embed.js            # postMessage listener + add-to-cart AJAX call
    css/openmerch-embed.css          # Iframe styling
  readme.txt                         # WordPress.org-style plugin readme
```

## Status / what's been verified

A local WordPress + WooCommerce environment (`docker compose --profile woocommerce-dev`, see `scripts/wordpress-dev-setup.sh`) exercised this plugin for real, not just against its source:

- **Verified**: automated install of WordPress + WooCommerce + this plugin via WP-CLI; activation correctly creates the WooCommerce webhook (`WC_Webhook`, topic `order.updated`); the product meta box's `_openmerch_product_id` correctly drives the front-end override; the product page correctly swaps the default Add to Cart button for the iframe (**on a classic/non-block theme** — see the block-theme caveat below); the iframe's `src` carries the exact `product`/`embed`/`parentOrigin` contract the embed page (`apps/demo`) expects, and that page loads successfully with those params; the order webhook's HMAC-SHA256 signature verification and order-creation logic were exercised end-to-end with a realistic WooCommerce order payload (including a `_design_key` line item) against the real `packages/api` route, correctly creating the `orders` row and linking `designId`.
- **Known limitation, not yet fixed**: on a **block theme** (WordPress's own modern default, e.g. Twenty Twenty-Four/Twenty-Five), the classic-hook-based Add to Cart override has no effect on the WooCommerce Blocks "Add to Cart Form" block, so both the iframe and the native button can appear together. Storefront (WooCommerce's official theme, classic hooks) or another classic theme is the workaround today — see the FAQ in `openmerch-woocommerce/readme.txt`.
- **Not yet verified** (needs an actual browser, not just HTTP requests): designing something inside the live iframe and confirming/exporting it, the resulting `postMessage` being received and turned into a real AJAX add-to-cart call, the cart/checkout UI showing the design data, and a real (not simulated) WooCommerce-triggered webhook delivery from an actual paid order.

## How to contribute

PHP contributors are especially welcome here. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the general process.
