<?php
/**
 * Plugin Name:          OpenMerch for WooCommerce
 * Plugin URI:           https://github.com/openmerch/openmerch-engine
 * Description:          Adds a "Customize" button next to Add to Cart on WooCommerce product pages, opening the OpenMerch editor in a new tab via a postMessage bridge, and syncs paid orders back to your self-hosted OpenMerch Engine instance.
 * Version:              1.0.5
 * Requires at least:    6.0
 * Requires PHP:         7.4
 * WC requires at least: 7.0
 * WC tested up to:      11.0
 * Author:               OpenMerch Engine contributors
 * Author URI:           https://github.com/openmerch/openmerch-engine
 * License:              GPL v2 or later
 * License URI:          https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:          openmerch-woocommerce
 * Domain Path:          /languages
 *
 * This plugin is deliberately a "dumb bridge": all business logic (design
 * storage, production file generation, pricing) lives in the OpenMerch
 * Engine backend (packages/api). This plugin only:
 *
 *   1. Renders a "Customize" button next to the native Add to Cart form on
 *      the WooCommerce product page, opening the hosted OpenMerch editor
 *      (apps/demo) in a new tab.
 *   2. Relays the `openmerch:export` postMessage payload sent by that
 *      tab (via `window.opener`) into the WooCommerce cart, and carries it
 *      through to the order's line item meta_data at checkout.
 *   3. Registers a native WooCommerce webhook (topic `order.updated`) so
 *      OpenMerch finds out when an order carrying a design is paid.
 *
 * None of the design rendering, file storage, or production pipeline logic
 * is duplicated here - see docs/integrations/shopify.md in the OpenMerch
 * Engine monorepo for the platform-agnostic version of this same pattern.
 *
 * @package OpenMerch_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // No direct access.
}

define( 'OPENMERCH_WC_VERSION', '1.0.5' );
define( 'OPENMERCH_WC_PLUGIN_FILE', __FILE__ );
define( 'OPENMERCH_WC_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'OPENMERCH_WC_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'OPENMERCH_WC_PLUGIN_BASENAME', plugin_basename( __FILE__ ) );

/**
 * Whether WooCommerce is active on this site. Checking class_exists()
 * (rather than the active_plugins option) is the check WooCommerce itself
 * recommends for third-party plugins: it also works when WooCommerce is
 * network-activated or loaded as an mu-plugin.
 *
 * @return bool
 */
function openmerch_wc_is_woocommerce_active() {
	return class_exists( 'WooCommerce' );
}

/**
 * Admin notice shown when WooCommerce is missing/inactive, so the site gets
 * a clear message instead of a fatal error from referencing undefined
 * WC_* classes.
 */
function openmerch_wc_missing_woocommerce_notice() {
	?>
	<div class="notice notice-error">
		<p>
			<?php
			echo wp_kses_post(
				sprintf(
					/* translators: %s: WooCommerce plugin link */
					__( '<strong>OpenMerch for WooCommerce</strong> requires %s to be installed and active. The plugin is loaded but stays inactive until WooCommerce is available.', 'openmerch-woocommerce' ),
					'<a href="https://wordpress.org/plugins/woocommerce/" target="_blank" rel="noopener noreferrer">WooCommerce</a>'
				)
			);
			?>
		</p>
	</div>
	<?php
}

/**
 * Boots the plugin once all plugins have loaded, so WooCommerce (and its
 * classes) can be reliably detected regardless of plugin load order.
 */
function openmerch_wc_bootstrap() {
	// WordPress's "just in time" translation loading (since 4.6) only auto-loads .mo files
	// from wp-content/languages/plugins/ - a plugin's own `languages/` subdirectory
	// (declared via the `Domain Path` header above) is never picked up automatically unless
	// something explicitly calls load_plugin_textdomain(). Called before the WooCommerce
	// check below so even the "WooCommerce is missing" admin notice translates correctly.
	load_plugin_textdomain( 'openmerch-woocommerce', false, dirname( OPENMERCH_WC_PLUGIN_BASENAME ) . '/languages' );

	if ( ! openmerch_wc_is_woocommerce_active() ) {
		add_action( 'admin_notices', 'openmerch_wc_missing_woocommerce_notice' );
		return;
	}

	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-settings.php';
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-product-meta.php';
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-editor-embed.php';
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-cart.php';
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-webhook.php';

	Openmerch_Settings::instance();
	Openmerch_Product_Meta::instance();
	Openmerch_Editor_Embed::instance();
	Openmerch_Cart::instance();
	Openmerch_Webhook::instance();
}
add_action( 'plugins_loaded', 'openmerch_wc_bootstrap' );

/**
 * Activation: generates a webhook secret (if none exists yet) and
 * registers/repairs the WooCommerce webhook pointing at OpenMerch's
 * order-sync endpoint.
 *
 * Guarded by openmerch_wc_is_woocommerce_active(): by the time an
 * activation hook callback runs, every other currently-active plugin
 * (including WooCommerce, if active) has already loaded on that request, so
 * WC_* classes are safe to use here if the check passes - but a site could
 * still activate this plugin before ever installing WooCommerce, hence the
 * guard.
 */
function openmerch_wc_activate() {
	if ( ! openmerch_wc_is_woocommerce_active() ) {
		return;
	}
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-settings.php';
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-webhook.php';
	Openmerch_Webhook::activate();
}
register_activation_hook( __FILE__, 'openmerch_wc_activate' );

/**
 * Deactivation: disables (but does not delete) the webhook this plugin
 * created, so reactivating re-enables the same webhook instead of creating
 * a duplicate. Plugin options are intentionally left in place -
 * deactivation is not uninstallation.
 */
function openmerch_wc_deactivate() {
	if ( ! openmerch_wc_is_woocommerce_active() ) {
		return;
	}
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-settings.php';
	require_once OPENMERCH_WC_PLUGIN_DIR . 'includes/class-openmerch-webhook.php';
	Openmerch_Webhook::deactivate();
}
register_deactivation_hook( __FILE__, 'openmerch_wc_deactivate' );
