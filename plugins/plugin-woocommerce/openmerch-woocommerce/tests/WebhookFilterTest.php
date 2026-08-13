<?php

namespace OpenMerch\Tests;

use Brain\Monkey\Functions;

/**
 * Openmerch_Webhook::allow_api_host()/allow_api_port() are the fix for a real bug found this
 * session: WC_Webhook::deliver() uses wp_safe_remote_request(), which WordPress silently
 * refuses to send to a private-network host/non-standard port (its built-in SSRF guard) unless
 * something explicitly allow-lists them via these two filters - without this, every webhook
 * delivery to a self-hosted OpenMerch instance (e.g. `api` on a Docker network, port 3001)
 * fails with no exception and no delivery log entry. These tests pin that fix in place.
 */
final class WebhookFilterTest extends TestCase {

	/** Stubs the chain allow_api_host()/allow_api_port() both go through: Openmerch_Settings::get_option('api_url') -> delivery_url(). */
	private function stub_api_url( string $api_url ): void {
		Functions\when( 'get_option' )->justReturn( array( 'api_url' => $api_url ) );
		Functions\when( 'wp_parse_args' )->alias( static function ( $args, $defaults ) {
			return array_merge( $defaults, (array) $args );
		} );
		Functions\when( 'untrailingslashit' )->alias( static function ( $s ) {
			return rtrim( $s, '/' );
		} );
		Functions\when( 'wp_parse_url' )->alias( 'parse_url' );
	}

	public function test_allow_api_host_allows_exactly_the_configured_api_host(): void {
		$this->stub_api_url( 'http://api:3001' );

		$this->assertTrue( \Openmerch_Webhook::allow_api_host( false, 'api' ) );
	}

	public function test_allow_api_host_does_not_allow_an_unrelated_host(): void {
		$this->stub_api_url( 'http://api:3001' );

		$this->assertFalse( \Openmerch_Webhook::allow_api_host( false, 'evil.example.com' ) );
	}

	public function test_allow_api_host_passes_through_an_already_external_host_unchanged(): void {
		$this->stub_api_url( 'http://api:3001' );

		// $is_external already true means some earlier filter already decided - must not be
		// second-guessed into false by this one.
		$this->assertTrue( \Openmerch_Webhook::allow_api_host( true, 'anything' ) );
	}

	public function test_allow_api_port_adds_only_the_configured_api_port(): void {
		$this->stub_api_url( 'http://api:3001' );

		$result = \Openmerch_Webhook::allow_api_port( array( 80, 443, 8080 ), 'api' );

		$this->assertContains( 3001, $result );
		$this->assertContains( 80, $result ); // original defaults preserved
	}

	public function test_allow_api_port_does_not_add_the_api_port_for_a_different_host(): void {
		$this->stub_api_url( 'http://api:3001' );

		$result = \Openmerch_Webhook::allow_api_port( array( 80, 443, 8080 ), 'some-other-host' );

		$this->assertSame( array( 80, 443, 8080 ), $result );
	}

	public function test_allow_api_port_is_a_noop_when_the_configured_url_has_no_explicit_port(): void {
		// e.g. a production deployment on the standard https port with no :port in api_url.
		$this->stub_api_url( 'https://api.example.com' );

		$result = \Openmerch_Webhook::allow_api_port( array( 80, 443, 8080 ), 'api.example.com' );

		$this->assertSame( array( 80, 443, 8080 ), $result );
	}
}
