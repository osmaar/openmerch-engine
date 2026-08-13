<?php

namespace OpenMerch\Tests;

use Brain\Monkey\Functions;

/**
 * Openmerch_Product_Meta's getters are thin wrappers around get_post_meta() - these confirm
 * each one reads the meta key it claims to (and only that key), since a copy-paste mistake
 * between the four near-identical getters would otherwise silently read the wrong value.
 */
final class ProductMetaGettersTest extends TestCase {

	public function test_get_product_id_reads_the_product_id_meta_key(): void {
		Functions\expect( 'get_post_meta' )
			->once()
			->with( 42, '_openmerch_product_id', true )
			->andReturn( 'classic-tshirt' );

		$this->assertSame( 'classic-tshirt', \Openmerch_Product_Meta::get_product_id( 42 ) );
	}

	public function test_get_variant_id_reads_the_variant_id_meta_key(): void {
		Functions\expect( 'get_post_meta' )
			->once()
			->with( 101, '_openmerch_variant_id', true )
			->andReturn( 'iphone-se' );

		$this->assertSame( 'iphone-se', \Openmerch_Product_Meta::get_variant_id( 101 ) );
	}

	public function test_get_color_reads_the_color_meta_key(): void {
		Functions\expect( 'get_post_meta' )
			->once()
			->with( 101, '_openmerch_color', true )
			->andReturn( '#FFFFFF' );

		$this->assertSame( '#FFFFFF', \Openmerch_Product_Meta::get_color( 101 ) );
	}

	public function test_get_zone_id_reads_the_zone_id_meta_key(): void {
		Functions\expect( 'get_post_meta' )
			->once()
			->with( 42, '_openmerch_zone_id', true )
			->andReturn( 'front' );

		$this->assertSame( 'front', \Openmerch_Product_Meta::get_zone_id( 42 ) );
	}

	public function test_unset_meta_returns_empty_string_not_false(): void {
		// get_post_meta() with $single=true returns '' (not false) when nothing is stored -
		// every caller in this plugin (e.g. Openmerch_Editor_Embed's map builders) relies on
		// that exact "empty string means unset" contract to decide whether to include a
		// variation in variantMap/colorMap.
		Functions\expect( 'get_post_meta' )->once()->andReturn( '' );

		$this->assertSame( '', \Openmerch_Product_Meta::get_variant_id( 999 ) );
	}
}
