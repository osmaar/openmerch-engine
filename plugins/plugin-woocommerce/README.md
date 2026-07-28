# plugin-woocommerce (placeholder)

**Status: not built.** This folder is an empty placeholder (`.gitkeep` only) — no code exists here yet.

## What this would be

A WooCommerce PHP plugin that embeds the OpenMerch editor on the WooCommerce product page via an iframe + `postMessage` bridge. The intended flow (see the "WooCommerce Integration" section of the [root README](../../README.md#woocommerce-integration)): the merchant installs the plugin, points it at their OpenMerch Engine URL, and enables the customizer on a product; the customer designs the product in the embedded editor, and on "Add to Cart" the design is saved and linked to the WooCommerce order, with production files generated automatically once the order is confirmed. Per the project's own principle, the plugin would be a "dumb bridge" — all logic stays in the OpenMerch API.

## Why it's not being built right now

It's explicitly marked **Post-MVP** in [docs/ROADMAP.md](../../docs/ROADMAP.md#post-mvp--explicitly-out-of-scope-for-now) — deprioritized for the v1 push, not because it's a bad idea, but because it's not on the maintainer's active roadmap right now.

## How to contribute

PHP contributors are especially welcome here. See [CONTRIBUTING.md](../../CONTRIBUTING.md) for the general process, and the WooCommerce entry in [docs/ROADMAP.md](../../docs/ROADMAP.md#post-mvp--explicitly-out-of-scope-for-now) for current context on scope and status.
