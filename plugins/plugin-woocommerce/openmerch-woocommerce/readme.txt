=== OpenMerch for WooCommerce ===
Contributors: openmerch
Tags: woocommerce, product customization, personalization, print on demand, product editor
Requires at least: 6.0
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Embed the OpenMerch product customization editor on your WooCommerce product pages, and sync paid orders back to your self-hosted OpenMerch Engine instance.

== Description ==

OpenMerch Engine is a self-hosted, open-source platform for visual product personalization (print-on-demand style customization: t-shirts, mugs, posters, and similar products). This plugin is the WordPress/WooCommerce integration for it.

It is deliberately a **dumb bridge**: all the interesting logic (rendering the design, storing it, generating production-ready files) lives in your own OpenMerch Engine deployment (the `apps/demo` editor app and the `packages/api` backend). This plugin only:

1. **Embeds the editor.** On the product page of any WooCommerce product you've mapped to an OpenMerch product, it replaces the default "Add to Cart" form with an iframe pointing at your OpenMerch editor, passing the product id/slug and the store's origin.
2. **Bridges the export back into WooCommerce.** When the customer finishes designing and exports/prints inside the editor, the editor posts the resulting design (a hosted PNG URL plus metadata) back to the page via `postMessage`. This plugin validates the message's origin, then adds the product to the WooCommerce cart with the design data attached as hidden (`_`-prefixed) cart/line item meta, so it survives all the way through checkout into the order.
3. **Registers a WooCommerce webhook.** On activation (and whenever you save the API URL), it creates/repairs a native WooCommerce webhook (topic `order.updated`) pointing at your OpenMerch API's order-sync endpoint, signed with a secret you configure once on both sides. When a mapped order is paid, OpenMerch is notified and can generate production files automatically.

= Requirements =

* WordPress 6.0+
* WooCommerce 7.0+ (the plugin checks for it and shows an admin notice instead of a fatal error if it's missing/inactive)
* A running OpenMerch Engine deployment (editor + API) that you control the URLs for

= Security =

* All admin forms and the AJAX add-to-cart endpoint are nonce-protected.
* All user input is sanitized (`sanitize_text_field`, `esc_url_raw`, `absint`, etc.) and all output is escaped (`esc_html`, `esc_attr`, `esc_url`).
* The `postMessage` listener strictly checks `event.origin` against the configured OpenMerch editor origin before processing anything - it never accepts messages from an unexpected origin, and the editor is never told to target `'*'`.
* The order webhook is verified with an HMAC-SHA256 signature (`X-WC-Webhook-Signature`) over the raw request body, matching what OpenMerch's API expects.

== Installation ==

1. Upload the `openmerch-woocommerce` folder to `/wp-content/plugins/`, or install the zip via **Plugins > Add New > Upload Plugin**.
2. Activate the plugin through the **Plugins** menu in WordPress. WooCommerce must already be active.
3. Go to **WooCommerce > OpenMerch** and set:
   * **Editor URL** - the base URL where your OpenMerch editor (`apps/demo`) is hosted.
   * **API URL** - the base URL of your OpenMerch API (`packages/api`).
   Saving this automatically generates a webhook secret and registers the WooCommerce webhook.
4. On each product you want customizable through OpenMerch, open the product editor and fill in **OpenMerch Product ID** (in the "OpenMerch Customization" box) with the matching product's id or slug in OpenMerch.
5. Use **Test connection** on the settings page to confirm the webhook signature round-trips correctly against your API.

== Frequently Asked Questions ==

= Does this plugin store or process customer designs itself? =

No. The design is uploaded and stored by your OpenMerch API deployment. This plugin only stores a reference to it (a URL and a few metadata fields) on the WooCommerce cart item / order line item.

= What happens to products without an OpenMerch Product ID set? =

Nothing - they keep WooCommerce's normal Add to Cart button and behave exactly as before installing this plugin.

= The settings page shows the webhook secret is set, but "Test connection" fails with a 503. What does that mean? =

That means your OpenMerch API doesn't have a webhook secret configured on its side (`WOOCOMMERCE_WEBHOOK_SECRET`), regardless of what's set here. This is not something the plugin can fix - configure that environment variable on your OpenMerch API deployment, then test again.

= Can I use variable products / product variations? =

The current version links to a WooCommerce product (not a specific variation) and does not yet map an OpenMerch variant back to a WooCommerce variation ID. The design's own metadata (`meta.variantId`, if present) is available to the front-end script but isn't currently mapped further. Contributions welcome.

= Does this work with block themes (Full Site Editing), like Twenty Twenty-Four/Twenty-Five? =

Not yet, reliably. The editor embed replaces WooCommerce's default Add to Cart button by removing the classic `woocommerce_single_product_summary` hook (`woocommerce_template_single_add_to_cart`). Classic/PHP-template themes (including WooCommerce's own **Storefront**, Astra, OceanWP, and most themes still in wide use) render Add to Cart through that hook, so this works as expected. Block themes instead render Add to Cart via the WooCommerce Blocks "Add to Cart Form" block, which does not go through that hook — on a block theme you may see both the iframe and the default button on the same page. Supporting block themes properly (filtering the block's own render output, or shipping a dedicated block variation) is real additional scope, tracked as a known limitation rather than silently broken. If your store uses a block theme, Storefront (free, official, one-click install from Appearance > Themes) is the straightforward workaround today.

== Changelog ==

= 1.0.0 =
* Initial release: editor embed (iframe + postMessage), cart/checkout bridge, and WooCommerce order webhook registration.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
