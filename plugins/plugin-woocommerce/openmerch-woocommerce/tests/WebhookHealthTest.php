<?php

namespace OpenMerch\Tests;

use Brain\Monkey\Functions;

/**
 * Openmerch_Webhook::get_health() is the source the settings page notice (see
 * Openmerch_Settings::render_webhook_health_notice()) relies on to warn about deliveries that
 * NEVER reach the OpenMerch API - a blocked host/port, DNS failure, or the API being down.
 * WC_Webhook::deliver() always calls its own log_delivery() even when wp_safe_remote_request()
 * never reached the network, which increments a consecutive-failure counter on the WC_Webhook
 * object itself and auto-disables it after 5 in a row - that counter/status, read straight off
 * WooCommerce's own webhook object, is the only reliable signal for this case (WooCommerce logs
 * deliveries to its own file logger, source "webhooks-delivery", not to wp_comments).
 */
final class WebhookHealthTest extends TestCase {

	private function stub_webhook( int $id, string $status, int $failure_count ): void {
		Functions\when( 'get_option' )->justReturn( $id );

		$webhook = new class( $status, $failure_count ) {
			private string $status;
			private int $failure_count;

			public function __construct( string $status, int $failure_count ) {
				$this->status        = $status;
				$this->failure_count = $failure_count;
			}

			public function get_status() {
				return $this->status;
			}

			public function get_failure_count() {
				return $this->failure_count;
			}
		};

		Functions\when( 'wc_get_webhook' )->justReturn( $webhook );
	}

	public function test_get_health_reports_not_registered_when_no_webhook_id_is_stored(): void {
		Functions\when( 'get_option' )->justReturn( 0 );

		$health = \Openmerch_Webhook::get_health();

		$this->assertFalse( $health['registered'] );
		$this->assertSame( 0, $health['failure_count'] );
	}

	public function test_get_health_reports_not_registered_when_wc_get_webhook_returns_nothing(): void {
		Functions\when( 'get_option' )->justReturn( 42 );
		Functions\when( 'wc_get_webhook' )->justReturn( false );

		$health = \Openmerch_Webhook::get_health();

		$this->assertFalse( $health['registered'] );
	}

	public function test_get_health_reports_active_status_and_zero_failures_for_a_healthy_webhook(): void {
		$this->stub_webhook( 42, 'active', 0 );

		$health = \Openmerch_Webhook::get_health();

		$this->assertTrue( $health['registered'] );
		$this->assertSame( 'active', $health['status'] );
		$this->assertSame( 0, $health['failure_count'] );
	}

	public function test_get_health_surfaces_consecutive_failures_before_the_webhook_is_disabled(): void {
		$this->stub_webhook( 42, 'active', 3 );

		$health = \Openmerch_Webhook::get_health();

		$this->assertSame( 'active', $health['status'] );
		$this->assertSame( 3, $health['failure_count'] );
	}

	public function test_get_health_reports_disabled_status_after_woocommerce_auto_disables_it(): void {
		$this->stub_webhook( 42, 'disabled', 6 );

		$health = \Openmerch_Webhook::get_health();

		$this->assertSame( 'disabled', $health['status'] );
		$this->assertSame( 6, $health['failure_count'] );
	}
}
