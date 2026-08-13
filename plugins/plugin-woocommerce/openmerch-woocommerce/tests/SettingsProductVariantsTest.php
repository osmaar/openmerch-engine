<?php

namespace OpenMerch\Tests;

use Brain\Monkey\Functions;

/**
 * Openmerch_Settings::get_product_variants() is what powers the "OpenMerch Variant" dropdown
 * on each WooCommerce variation row - it must find the right product's variant list by id and
 * return an empty list (never null, never an error) for anything else, since the caller
 * (Openmerch_Product_Meta::render_variation_fields()) uses emptiness to decide whether to
 * render that dropdown at all.
 *
 * Stubs get_transient() directly with a ready-made product list, which is exactly the
 * short-circuit get_products() takes when the cache is warm - so these tests don't need to
 * also stub wp_remote_get()/the HTTP round-trip to the OpenMerch API.
 */
final class SettingsProductVariantsTest extends TestCase {

	private function stub_cached_products( array $products ): void {
		Functions\when( 'get_transient' )->justReturn( $products );
	}

	public function test_returns_the_variants_for_a_matching_product_id(): void {
		$this->stub_cached_products( array(
			array(
				'id'       => 'iphone-case-id',
				'name'     => 'iPhone Case',
				'slug'     => 'iphone-case',
				'active'   => true,
				'variants' => array( array( 'id' => 'iphone-se', 'name' => 'iPhone SE' ) ),
			),
			array(
				'id'       => 'tshirt-id',
				'name'     => 'Classic T-Shirt',
				'slug'     => 'classic-tshirt',
				'active'   => true,
				'variants' => array(),
			),
		) );

		$this->assertSame(
			array( array( 'id' => 'iphone-se', 'name' => 'iPhone SE' ) ),
			\Openmerch_Settings::get_product_variants( 'iphone-case-id' )
		);
	}

	public function test_returns_empty_array_for_a_product_with_no_variants(): void {
		$this->stub_cached_products( array(
			array( 'id' => 'tshirt-id', 'name' => 'Classic T-Shirt', 'slug' => 'classic-tshirt', 'active' => true, 'variants' => array() ),
		) );

		$this->assertSame( array(), \Openmerch_Settings::get_product_variants( 'tshirt-id' ) );
	}

	public function test_returns_empty_array_for_an_unknown_product_id(): void {
		$this->stub_cached_products( array(
			array( 'id' => 'tshirt-id', 'name' => 'Classic T-Shirt', 'slug' => 'classic-tshirt', 'active' => true, 'variants' => array() ),
		) );

		$this->assertSame( array(), \Openmerch_Settings::get_product_variants( 'does-not-exist' ) );
	}

	public function test_returns_empty_array_when_the_catalog_cache_is_empty(): void {
		$this->stub_cached_products( array() );

		$this->assertSame( array(), \Openmerch_Settings::get_product_variants( 'anything' ) );
	}
}
