<?php
/**
 * Real-database integration tests for per-variation OpenMerch meta
 * (Openmerch_Product_Meta) and the native WooCommerce webhook registration
 * (Openmerch_Webhook::activate()). Runs against a real WordPress install,
 * real WooCommerce, and a real (throwaway) database - see
 * tests-integration/install.sh for setup and tests-integration/bootstrap.php
 * for how WordPress/WooCommerce/this plugin get loaded.
 *
 * These specifically cover what the Brain Monkey suite (tests/) cannot,
 * since that suite mocks every WP/WC function and never touches a real
 * database:
 *   - post meta actually surviving a save -> reload round-trip
 *   - render_variation_fields() actual HTML output, gated on real transient
 *     state and a real parent/variation post relationship
 *   - Openmerch_Webhook::activate() creating (and later updating in place,
 *     not duplicating) a real WC_Webhook row
 *
 * @package OpenMerch_WooCommerce
 */

class VariationAndWebhookTest extends WP_UnitTestCase {

	public function test_variation_fields_persist_across_save_and_load() {
		$product_id = self::factory()->post->create( array( 'post_type' => 'product' ) );
		update_post_meta( $product_id, Openmerch_Product_Meta::META_PRODUCT_ID, 'classic-tshirt' );

		$variation_id = self::factory()->post->create(
			array(
				'post_type'   => 'product_variation',
				'post_parent' => $product_id,
			)
		);

		wp_set_current_user( self::factory()->user->create( array( 'role' => 'administrator' ) ) );

		$_POST['openmerch_variant_id']    = array( 0 => 'variant-m' );
		$_POST['openmerch_color_enabled'] = array( 0 => '1' );
		$_POST['openmerch_color']         = array( 0 => '#ff0000' );

		$meta = Openmerch_Product_Meta::instance();
		$meta->save_variation_fields( $variation_id, 0 );

		$this->assertSame( 'variant-m', Openmerch_Product_Meta::get_variant_id( $variation_id ) );
		$this->assertSame( '#ff0000', Openmerch_Product_Meta::get_color( $variation_id ) );

		// Unchecking the "preselect a color" checkbox must clear the stored color, not
		// leave the last saved value behind (see the docblock on save_variation_fields()
		// explaining why the checkbox, not the <input type="color"> value, is authoritative).
		$_POST['openmerch_color_enabled'] = array();
		$meta->save_variation_fields( $variation_id, 0 );
		$this->assertSame( '', Openmerch_Product_Meta::get_color( $variation_id ) );

		unset( $_POST['openmerch_variant_id'], $_POST['openmerch_color_enabled'], $_POST['openmerch_color'] );
	}

	public function test_render_variation_fields_outputs_variant_dropdown_when_parent_has_variants() {
		$product_id = self::factory()->post->create( array( 'post_type' => 'product' ) );
		update_post_meta( $product_id, Openmerch_Product_Meta::META_PRODUCT_ID, 'iphone-case' );

		$variation = get_post(
			self::factory()->post->create(
				array(
					'post_type'   => 'product_variation',
					'post_parent' => $product_id,
				)
			)
		);

		// Stub the OpenMerch product catalog via the same transient
		// Openmerch_Settings::get_product_variants() reads, instead of hitting a real API.
		set_transient(
			'openmerch_products',
			array(
				array(
					'id'       => 'iphone-case',
					'name'     => 'iPhone Case',
					'slug'     => 'iphone-case',
					'active'   => true,
					'variants' => array( array( 'id' => 'iphone-15', 'name' => 'iPhone 15' ) ),
				),
			),
			60
		);

		$meta = Openmerch_Product_Meta::instance();
		ob_start();
		$meta->render_variation_fields( 0, array(), $variation );
		$html = ob_get_clean();

		$this->assertStringContainsString( 'openmerch_variant_id[0]', $html );
		$this->assertStringContainsString( 'iPhone 15', $html );
		$this->assertStringContainsString( 'openmerch_color[0]', $html );

		delete_transient( 'openmerch_products' );
	}

	public function test_render_variation_fields_omits_variant_dropdown_when_parent_unmapped() {
		$product_id = self::factory()->post->create( array( 'post_type' => 'product' ) );
		// Deliberately no META_PRODUCT_ID set - an unmapped WooCommerce product.
		$variation = get_post(
			self::factory()->post->create(
				array(
					'post_type'   => 'product_variation',
					'post_parent' => $product_id,
				)
			)
		);

		$meta = Openmerch_Product_Meta::instance();
		ob_start();
		$meta->render_variation_fields( 0, array(), $variation );
		$html = ob_get_clean();

		$this->assertSame( '', $html );
	}

	public function test_activate_creates_a_real_active_wc_webhook_pointed_at_configured_api_url() {
		Openmerch_Settings::update_options( array( 'api_url' => 'http://api:3001' ) );
		delete_option( Openmerch_Webhook::OPTION_WEBHOOK_ID );

		Openmerch_Webhook::activate();

		$webhook_id = (int) get_option( Openmerch_Webhook::OPTION_WEBHOOK_ID, 0 );
		$this->assertGreaterThan( 0, $webhook_id );

		$webhook = wc_get_webhook( $webhook_id );
		$this->assertInstanceOf( 'WC_Webhook', $webhook );
		$this->assertSame( 'active', $webhook->get_status() );
		$this->assertSame( 'order.updated', $webhook->get_topic() );
		$this->assertSame( 'http://api:3001/api/v1/orders/webhook/woocommerce', $webhook->get_delivery_url() );
		$this->assertNotEmpty( $webhook->get_secret() );

		// Calling activate() again with the same api_url must update the SAME webhook,
		// never create a second one - this is the idempotency the docblock promises.
		$secret_before = $webhook->get_secret();
		Openmerch_Webhook::activate();
		$this->assertSame( $webhook_id, (int) get_option( Openmerch_Webhook::OPTION_WEBHOOK_ID, 0 ) );
		$webhook_after = wc_get_webhook( $webhook_id );
		$this->assertSame( $secret_before, $webhook_after->get_secret() );
	}
}
