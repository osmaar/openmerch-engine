<?php
/**
 * Registers and maintains the native WooCommerce webhook that notifies
 * OpenMerch when an order is created/paid.
 *
 * @package OpenMerch_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Openmerch_Webhook
 */
class Openmerch_Webhook {

	const OPTION_WEBHOOK_ID = 'openmerch_wc_webhook_id';

	/**
	 * WooCommerce webhook topic. `order.updated` fires on order saves in
	 * general - including status transitions (pending -> processing/
	 * completed) - which is how the OpenMerch API route
	 * (`POST /api/v1/orders/webhook/woocommerce`, see its own docblock)
	 * expects to be notified of "order paid". WooCommerce does not expose a
	 * narrower "order paid" topic out of the box, so the API route itself is
	 * responsible for filtering on `status` (see PAID_STATUSES there) -
	 * this plugin just needs to make sure the webhook fires on every order
	 * update.
	 */
	const TOPIC = 'order.updated';

	/** @var Openmerch_Webhook|null */
	private static $instance = null;

	/**
	 * @return Openmerch_Webhook
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	/**
	 * Constructor.
	 */
	private function __construct() {
		add_filter( 'http_request_host_is_external', array( __CLASS__, 'allow_api_host' ), 10, 2 );
		add_filter( 'http_allowed_safe_ports', array( __CLASS__, 'allow_api_port' ), 10, 2 );
	}

	/**
	 * WC_Webhook::deliver() sends via wp_safe_remote_request(), which normally only
	 * connects to hosts WordPress considers "external" - a private-network hostname like
	 * this plugin's own configured API host (e.g. `api` on a Docker Compose network, or any
	 * other internal address) does not qualify by default, so deliveries to it are refused
	 * with no exception and no delivery log entry (WC_Webhook::deliver() never surfaces the
	 * resulting WP_Error anywhere). This filter is WordPress's documented mechanism for
	 * telling it a specific additional host is fine to contact - scoped to exactly the
	 * configured API host, not a blanket allowance for every request.
	 *
	 * @param bool   $is_external Whether the host is already considered external.
	 * @param string $host        Host being requested.
	 * @return bool
	 */
	public static function allow_api_host( $is_external, $host ) {
		if ( $is_external ) {
			return $is_external;
		}
		$api_host = wp_parse_url( self::delivery_url(), PHP_URL_HOST );
		return ( $api_host && $host === $api_host ) ? true : $is_external;
	}

	/**
	 * wp_http_validate_url() rejects a request even after allow_api_host() above passes it,
	 * if the URL's port isn't in this separate allow-list (default: 80, 443, 8080 only) -
	 * OpenMerch's API commonly runs on its own port (3001 in the default Docker Compose
	 * setup, but merchants can point this at any host:port). Only adds the configured API
	 * port, for the same reason allow_api_host() is scoped to the configured API host rather
	 * than allowing every request through.
	 *
	 * @param int[]  $allowed_ports Ports WordPress already considers safe.
	 * @param string $host          Host being requested.
	 * @return int[]
	 */
	public static function allow_api_port( $allowed_ports, $host ) {
		$delivery = wp_parse_url( self::delivery_url() );
		if ( ! empty( $delivery['host'] ) && $host === $delivery['host'] && ! empty( $delivery['port'] ) ) {
			$allowed_ports[] = (int) $delivery['port'];
		}
		return $allowed_ports;
	}

	/**
	 * @return string Full delivery URL for the OpenMerch order webhook route.
	 */
	private static function delivery_url() {
		$api_url = untrailingslashit( Openmerch_Settings::get_option( 'api_url' ) );
		return $api_url . '/api/v1/orders/webhook/woocommerce';
	}

	/**
	 * Generates a webhook secret if none exists yet.
	 *
	 * @return string The (possibly newly generated) secret.
	 */
	private static function ensure_secret() {
		$secret = Openmerch_Settings::get_option( 'webhook_secret' );
		if ( '' === $secret ) {
			$secret = wp_generate_password( 40, false, false );
			Openmerch_Settings::update_options( array( 'webhook_secret' => $secret ) );
		}
		return $secret;
	}

	/**
	 * WooCommerce webhooks require a user id (used to build the REST-shaped
	 * payload with that user's permissions). Prefers the current admin
	 * (activation/settings actions always run in an admin context); falls
	 * back to the first administrator for the rare case activation happens
	 * without a logged-in user (e.g. WP-CLI).
	 *
	 * @return int
	 */
	private static function resolve_user_id() {
		$current = get_current_user_id();
		if ( $current ) {
			return $current;
		}
		$admins = get_users(
			array(
				'role'    => 'administrator',
				'number'  => 1,
				'fields'  => 'ID',
				'orderby' => 'ID',
				'order'   => 'ASC',
			)
		);
		return ! empty( $admins ) ? (int) $admins[0] : 0;
	}

	/**
	 * Creates (or repairs/re-enables) the WooCommerce webhook that notifies
	 * OpenMerch of order changes.
	 *
	 * Uses the modern WC_Webhook CRUD object (WooCommerce 3.0+) - the same
	 * mechanism WooCommerce > Settings > Advanced > Webhooks uses under the
	 * hood - rather than inserting a `shop_webhook` post directly. This is
	 * the documented, forward-compatible way to manage webhooks from code.
	 *
	 * Idempotent: if we already created a webhook (its id is stored in the
	 * `openmerch_wc_webhook_id` option) and it still exists, it is updated
	 * in place rather than duplicated - safe to call on every plugin
	 * activation and every settings save.
	 */
	public static function activate() {
		if ( ! class_exists( 'WC_Webhook' ) || ! function_exists( 'wc_get_webhook' ) ) {
			return;
		}

		if ( '' === Openmerch_Settings::get_option( 'api_url' ) ) {
			// Nothing to point the webhook at yet - the merchant hasn't
			// configured the API URL. Openmerch_Settings re-calls this the
			// moment api_url is saved, and the settings page also exposes a
			// manual "Recreate / repair webhook" button.
			return;
		}

		$secret      = self::ensure_secret();
		$existing_id = (int) get_option( self::OPTION_WEBHOOK_ID, 0 );
		$webhook     = $existing_id ? wc_get_webhook( $existing_id ) : false;

		if ( ! $webhook ) {
			$webhook = new WC_Webhook();
		}

		$webhook->set_name( 'OpenMerch order sync' );
		$webhook->set_user_id( self::resolve_user_id() );
		$webhook->set_topic( self::TOPIC );
		$webhook->set_delivery_url( self::delivery_url() );
		$webhook->set_secret( $secret );
		$webhook->set_status( 'active' );
		$webhook->save();

		update_option( self::OPTION_WEBHOOK_ID, $webhook->get_id() );
	}

	/**
	 * Disables (does not delete) the webhook on plugin deactivation, so
	 * reactivation can find and re-enable the same webhook row.
	 */
	public static function deactivate() {
		if ( ! function_exists( 'wc_get_webhook' ) ) {
			return;
		}
		$existing_id = (int) get_option( self::OPTION_WEBHOOK_ID, 0 );
		if ( ! $existing_id ) {
			return;
		}
		$webhook = wc_get_webhook( $existing_id );
		if ( $webhook ) {
			$webhook->set_status( 'disabled' );
			$webhook->save();
		}
	}

	/**
	 * Pushes a freshly-regenerated secret to the already-registered
	 * webhook, if any, so WooCommerce and OpenMerch stay in sync without
	 * requiring a full "recreate".
	 *
	 * @param string $secret New secret value.
	 */
	public static function sync_secret( $secret ) {
		$existing_id = (int) get_option( self::OPTION_WEBHOOK_ID, 0 );
		if ( ! $existing_id || ! function_exists( 'wc_get_webhook' ) ) {
			return;
		}
		$webhook = wc_get_webhook( $existing_id );
		if ( $webhook ) {
			$webhook->set_secret( $secret );
			$webhook->save();
		}
	}

	/**
	 * @return string Human-readable webhook status for the settings page.
	 */
	public static function get_status_label() {
		$existing_id = (int) get_option( self::OPTION_WEBHOOK_ID, 0 );
		if ( ! $existing_id || ! function_exists( 'wc_get_webhook' ) ) {
			return __( 'Not created yet', 'openmerch-woocommerce' );
		}
		$webhook = wc_get_webhook( $existing_id );
		if ( ! $webhook ) {
			return __( 'Not created yet', 'openmerch-woocommerce' );
		}
		return sprintf(
			/* translators: 1: webhook id, 2: webhook status (active/disabled) */
			__( '#%1$d (%2$s)', 'openmerch-woocommerce' ),
			$webhook->get_id(),
			$webhook->get_status()
		);
	}

	/**
	 * Delivery failures/health for the registered webhook, straight from WooCommerce's own
	 * bookkeeping - this is the ONE reliable source of "did recent deliveries fail" for cases
	 * the OpenMerch API's own delivery log can never see (a blocked host/port, the API being
	 * down, DNS failure, etc.): WC_Webhook::deliver() always calls log_delivery() even when
	 * wp_safe_remote_request() itself never reached the network, and log_delivery() increments
	 * a consecutive-failure counter and auto-disables the webhook after
	 * `woocommerce_max_webhook_delivery_failures` (default 5) failures in a row. WooCommerce
	 * does NOT write these to wp_comments in current versions (that's a legacy path) - the
	 * failure count/status on the WC_Webhook object itself, and its own log at
	 * WooCommerce > Status > Logs (source "webhooks-delivery"), are the only reliable traces.
	 *
	 * @return array{registered: bool, status: string, failure_count: int}
	 */
	public static function get_health() {
		$existing_id = (int) get_option( self::OPTION_WEBHOOK_ID, 0 );
		$webhook     = ( $existing_id && function_exists( 'wc_get_webhook' ) ) ? wc_get_webhook( $existing_id ) : false;

		if ( ! $webhook ) {
			return array( 'registered' => false, 'status' => '', 'failure_count' => 0 );
		}

		return array(
			'registered'    => true,
			'status'        => $webhook->get_status(),
			'failure_count' => (int) $webhook->get_failure_count(),
		);
	}
}
