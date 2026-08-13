<?php
/**
 * PHPUnit bootstrap for this plugin's own unit tests.
 *
 * There is no WordPress/WooCommerce test suite wired into this repo (that would need a real
 * WP install + test database — a much bigger lift). These tests use Brain Monkey instead,
 * which patches WordPress core functions (get_post_meta, get_option, wp_remote_get, ...) at
 * runtime so the plugin's own classes can be exercised in isolation, without WordPress itself
 * ever being loaded. See each test file's own docblock for exactly what is/isn't covered by
 * this approach.
 */

require_once __DIR__ . '/../vendor/autoload.php';

// The plugin's own files all start with `if ( ! defined( 'ABSPATH' ) ) { exit; }` as a
// direct-access guard - defining it here is what lets `require` load them at all outside WP.
if ( ! defined( 'ABSPATH' ) ) {
	define( 'ABSPATH', __DIR__ . '/' );
}

require_once __DIR__ . '/../includes/class-openmerch-settings.php';
require_once __DIR__ . '/../includes/class-openmerch-product-meta.php';
require_once __DIR__ . '/../includes/class-openmerch-editor-embed.php';
require_once __DIR__ . '/../includes/class-openmerch-webhook.php';
