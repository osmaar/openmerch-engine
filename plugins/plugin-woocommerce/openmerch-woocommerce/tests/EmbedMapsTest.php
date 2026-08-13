<?php

namespace OpenMerch\Tests;

use Brain\Monkey\Functions;
use ReflectionClass;
use ReflectionMethod;

/**
 * A minimal stand-in for WC_Product (which doesn't exist without WooCommerce loaded) - only
 * implements the two methods Openmerch_Editor_Embed::build_variant_map()/build_color_map()
 * actually call.
 */
final class FakeWcProduct {
	private bool $is_variable;
	/** @var int[] */
	private array $children;

	public function __construct( bool $is_variable, array $children = array() ) {
		$this->is_variable = $is_variable;
		$this->children    = $children;
	}

	public function is_type( string $type ) {
		return 'variable' === $type && $this->is_variable;
	}

	public function get_children() {
		return $this->children;
	}
}

/**
 * build_variant_map()/build_color_map() are private, so these use Reflection to call them
 * directly - the alternative (testing only through the public render_embed() HTML output)
 * would couple the test to markup instead of the actual mapping logic.
 */
final class EmbedMapsTest extends TestCase {

	private function invoke_private( string $method, $product ) {
		$embed = ( new ReflectionClass( \Openmerch_Editor_Embed::class ) )->newInstanceWithoutConstructor();
		$ref   = new ReflectionMethod( \Openmerch_Editor_Embed::class, $method );
		$ref->setAccessible( true );
		return $ref->invoke( $embed, $product );
	}

	/** @var array<int, array{variant: string, color: string}> */
	private const META = array(
		101 => array( 'variant' => 'iphone-se', 'color' => '#FFFFFF' ),
		102 => array( 'variant' => '', 'color' => '' ), // left on "use the product's default"
		103 => array( 'variant' => '', 'color' => '#222222' ), // color only, no OpenMerch variant
	);

	private function stub_post_meta(): void {
		Functions\when( 'get_post_meta' )->alias( function ( $post_id, $key, $single ) {
			unset( $single );
			$row = self::META[ $post_id ] ?? array();
			if ( '_openmerch_variant_id' === $key ) {
				return $row['variant'] ?? '';
			}
			if ( '_openmerch_color' === $key ) {
				return $row['color'] ?? '';
			}
			return '';
		} );
	}

	public function test_build_variant_map_includes_only_variations_with_a_configured_variant(): void {
		$this->stub_post_meta();
		$product = new FakeWcProduct( true, array( 101, 102, 103 ) );

		$map = $this->invoke_private( 'build_variant_map', $product );

		$this->assertSame( array( 101 => 'iphone-se' ), $map );
	}

	public function test_build_color_map_includes_only_variations_with_a_configured_color(): void {
		$this->stub_post_meta();
		$product = new FakeWcProduct( true, array( 101, 102, 103 ) );

		$map = $this->invoke_private( 'build_color_map', $product );

		$this->assertSame( array( 101 => '#FFFFFF', 103 => '#222222' ), $map );
	}

	public function test_build_variant_map_is_empty_for_a_simple_product(): void {
		// A simple product has no is_type('variable') = true, so build_variant_map() must
		// short-circuit before ever calling get_children()/get_post_meta() at all.
		Functions\expect( 'get_post_meta' )->never();
		$product = new FakeWcProduct( false );

		$this->assertSame( array(), $this->invoke_private( 'build_variant_map', $product ) );
	}

	public function test_build_color_map_is_empty_for_a_simple_product(): void {
		Functions\expect( 'get_post_meta' )->never();
		$product = new FakeWcProduct( false );

		$this->assertSame( array(), $this->invoke_private( 'build_color_map', $product ) );
	}

	public function test_build_variant_map_is_empty_when_the_variable_product_has_no_children(): void {
		$this->stub_post_meta();
		$product = new FakeWcProduct( true, array() );

		$this->assertSame( array(), $this->invoke_private( 'build_variant_map', $product ) );
	}
}
