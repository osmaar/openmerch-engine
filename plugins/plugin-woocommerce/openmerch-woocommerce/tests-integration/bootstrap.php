<?php
/**
 * Bootstrap for the WP core PHPUnit integration suite - see install.sh for
 * what this depends on and why (curl-fetched WP core test library +
 * phpunit.phar + phpunit-polyfills, not composer/svn).
 *
 * Unlike tests/bootstrap.php (Brain Monkey - no real WordPress, no real
 * database), this file boots the *actual* WordPress install running in this
 * container, with the *actual* WooCommerce plugin, against a throwaway test
 * database. Tests here exercise real hooks, real post meta persistence, and
 * real WC_Webhook objects - things Brain Monkey's function mocks cannot
 * verify (e.g. "does this actually survive a database round-trip").
 *
 * @package OpenMerch_WooCommerce
 */

define( 'WP_TESTS_CONFIG_FILE_PATH', __DIR__ . '/.wp-tests/wp-tests-config.php' );

$polyfills_autoload = null;
foreach ( glob( __DIR__ . '/.wp-tests/PHPUnit-Polyfills-*/phpunitpolyfills-autoload.php' ) as $candidate ) {
	$polyfills_autoload = $candidate;
	break;
}
if ( ! $polyfills_autoload ) {
	fwrite( STDERR, "phpunit-polyfills not found under tests-integration/.wp-tests/ - run install.sh first.\n" );
	exit( 1 );
}
require $polyfills_autoload;

$wp_tests_lib = null;
foreach ( glob( __DIR__ . '/.wp-tests/wordpress-develop-*/tests/phpunit' ) as $candidate ) {
	$wp_tests_lib = $candidate;
	break;
}
if ( ! $wp_tests_lib ) {
	fwrite( STDERR, "WordPress core test library not found under tests-integration/.wp-tests/ - run install.sh first.\n" );
	exit( 1 );
}

require $wp_tests_lib . '/includes/functions.php';

/**
 * Loads WooCommerce and this plugin the same way a real WordPress request
 * would (as active plugins), then - once WordPress itself has finished
 * booting (`init`, not `muplugins_loaded` - pluggable.php isn't available
 * yet at that point) - runs WooCommerce's own installer so its custom
 * tables (wc_webhooks, woocommerce_attribute_taxonomies, etc.) exist in the
 * test database. Without this, any test touching a WC_Webhook or product
 * attribute would fail with "table doesn't exist", not because of a bug in
 * this plugin.
 */
function _openmerch_manually_load_plugins() {
	require WP_PLUGIN_DIR . '/woocommerce/woocommerce.php';
	require WP_PLUGIN_DIR . '/openmerch-woocommerce/openmerch-woocommerce.php';

	add_action(
		'init',
		function () {
			if ( class_exists( 'WC_Install' ) ) {
				WC_Install::install();
			}
		},
		999
	);
}
tests_add_filter( 'muplugins_loaded', '_openmerch_manually_load_plugins' );

require $wp_tests_lib . '/includes/bootstrap.php';
