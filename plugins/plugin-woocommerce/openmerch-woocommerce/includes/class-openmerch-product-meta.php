<?php
/**
 * Product-edit-screen meta box: maps a WooCommerce product to an OpenMerch
 * product.
 *
 * @package OpenMerch_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Openmerch_Product_Meta
 */
class Openmerch_Product_Meta {

	const META_PRODUCT_ID = '_openmerch_product_id';
	const META_ZONE_ID    = '_openmerch_zone_id';
	const META_VARIANT_ID = '_openmerch_variant_id';
	const META_COLOR      = '_openmerch_color';
	const NONCE_ACTION    = 'openmerch_save_product_meta';
	const NONCE_FIELD     = 'openmerch_product_meta_nonce';

	/** @var Openmerch_Product_Meta|null */
	private static $instance = null;

	/**
	 * @return Openmerch_Product_Meta
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
		add_action( 'add_meta_boxes', array( $this, 'add_meta_box' ) );
		add_action( 'save_post_product', array( $this, 'save_meta_box' ), 10, 2 );
		// Per-variation OpenMerch mapping - only relevant for variable products whose
		// parent is already mapped to an OpenMerch product that has size/model variants
		// (e.g. iPhone Case, Mug). render_variation_fields() no-ops otherwise.
		add_action( 'woocommerce_product_after_variable_attributes', array( $this, 'render_variation_fields' ), 10, 3 );
		add_action( 'woocommerce_save_product_variation', array( $this, 'save_variation_fields' ), 10, 2 );
	}

	/**
	 * Registers the meta box on the product edit screen.
	 */
	public function add_meta_box() {
		add_meta_box(
			'openmerch_product_meta',
			__( 'OpenMerch Customization', 'openmerch-woocommerce' ),
			array( $this, 'render_meta_box' ),
			'product',
			'side',
			'default'
		);
	}

	/**
	 * Renders the meta box fields.
	 *
	 * @param WP_Post $post Current product post.
	 */
	public function render_meta_box( $post ) {
		wp_nonce_field( self::NONCE_ACTION, self::NONCE_FIELD );

		$product_id = get_post_meta( $post->ID, self::META_PRODUCT_ID, true );
		$zone_id    = get_post_meta( $post->ID, self::META_ZONE_ID, true );
		$products   = Openmerch_Settings::get_products();
		?>
		<p>
			<label for="openmerch_product_id"><strong><?php esc_html_e( 'OpenMerch Product ID', 'openmerch-woocommerce' ); ?></strong></label><br />
			<?php if ( ! empty( $products ) ) : ?>
				<select id="openmerch_product_id" name="openmerch_product_id" class="widefat">
					<option value=""><?php esc_html_e( '— None (default Add to Cart) —', 'openmerch-woocommerce' ); ?></option>
					<?php
					$matched = false;
					foreach ( $products as $product ) :
						$is_selected = ( $product['id'] === $product_id || $product['slug'] === $product_id );
						if ( $is_selected ) {
							$matched = true;
						}
						?>
						<option value="<?php echo esc_attr( $product['id'] ); ?>" <?php selected( $is_selected ); ?>>
							<?php echo esc_html( $product['name'] ); ?><?php echo $product['active'] ? '' : ' (' . esc_html__( 'inactive', 'openmerch-woocommerce' ) . ')'; ?>
						</option>
					<?php endforeach; ?>
					<?php if ( '' !== $product_id && ! $matched ) : ?>
						<option value="<?php echo esc_attr( $product_id ); ?>" selected>
							<?php echo esc_html( $product_id ); ?> (<?php esc_html_e( 'not found in OpenMerch', 'openmerch-woocommerce' ); ?>)
						</option>
					<?php endif; ?>
				</select>
				<span class="description">
					<?php esc_html_e( 'Product from your OpenMerch catalog to customize on this WooCommerce product page. Leave on "None" to keep the default WooCommerce Add to Cart button only.', 'openmerch-woocommerce' ); ?>
				</span>
			<?php else : ?>
				<input
					type="text"
					id="openmerch_product_id"
					name="openmerch_product_id"
					class="widefat"
					value="<?php echo esc_attr( $product_id ); ?>"
					placeholder="<?php esc_attr_e( 'UUID or slug, e.g. classic-tshirt', 'openmerch-woocommerce' ); ?>"
				/>
				<span class="description">
					<?php esc_html_e( "Couldn't load the OpenMerch product catalog (check the API URL under WooCommerce > OpenMerch) — enter the ID or slug manually. Leave empty to keep the default WooCommerce Add to Cart button for this product.", 'openmerch-woocommerce' ); ?>
				</span>
			<?php endif; ?>
		</p>
		<p>
			<label for="openmerch_zone_id"><strong><?php esc_html_e( 'Zone ID (optional)', 'openmerch-woocommerce' ); ?></strong></label><br />
			<input
				type="text"
				id="openmerch_zone_id"
				name="openmerch_zone_id"
				class="widefat"
				value="<?php echo esc_attr( $zone_id ); ?>"
			/>
			<span class="description">
				<?php esc_html_e( 'Reserved for pre-selecting a specific print zone in a future editor version. Stored, but not sent to the embed URL yet.', 'openmerch-woocommerce' ); ?>
			</span>
		</p>
		<?php
	}

	/**
	 * Saves the meta box fields.
	 *
	 * @param int     $post_id Product post ID.
	 * @param WP_Post $post    Product post object.
	 */
	public function save_meta_box( $post_id, $post ) {
		if ( ! isset( $_POST[ self::NONCE_FIELD ] )
			|| ! wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST[ self::NONCE_FIELD ] ) ), self::NONCE_ACTION ) ) {
			return;
		}

		if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
			return;
		}

		if ( ! current_user_can( 'edit_product', $post_id ) ) {
			return;
		}

		if ( isset( $_POST['openmerch_product_id'] ) ) {
			update_post_meta(
				$post_id,
				self::META_PRODUCT_ID,
				sanitize_text_field( wp_unslash( $_POST['openmerch_product_id'] ) )
			);
		}

		if ( isset( $_POST['openmerch_zone_id'] ) ) {
			update_post_meta(
				$post_id,
				self::META_ZONE_ID,
				sanitize_text_field( wp_unslash( $_POST['openmerch_zone_id'] ) )
			);
		}
	}

	/**
	 * Renders the per-variation OpenMerch fields:
	 *  - "OpenMerch Variant" dropdown, only if the parent is mapped to an OpenMerch
	 *    product that has size/model variants (e.g. iPhone Case's per-model print zones,
	 *    a mug's size options). Without this, every variation would render with the SAME
	 *    print zone dimensions regardless of which one the customer actually picked.
	 *  - "Product Color" picker - independent of variants (a t-shirt has no OpenMerch-side
	 *    variants at all, just a color tint), so shown whenever the parent has any
	 *    OpenMerch mapping, not gated on $variants like the field above.
	 *
	 * @param int     $loop           Variation position (used to build unique field names).
	 * @param array   $variation_data Variation data (unused - kept to match the hook signature).
	 * @param WP_Post $variation      The variation's own post object.
	 */
	public function render_variation_fields( $loop, $variation_data, $variation ) {
		unset( $variation_data );

		$product_post_id = wp_get_post_parent_id( $variation->ID );
		$openmerch_product_id = self::get_product_id( $product_post_id );
		if ( '' === $openmerch_product_id ) {
			return;
		}

		$variants = Openmerch_Settings::get_product_variants( $openmerch_product_id );
		if ( ! empty( $variants ) ) {
			$current_variant = get_post_meta( $variation->ID, self::META_VARIANT_ID, true );
			?>
			<div class="form-row form-row-full">
				<label>
					<?php esc_html_e( 'OpenMerch Variant', 'openmerch-woocommerce' ); ?>
					<select name="openmerch_variant_id[<?php echo esc_attr( $loop ); ?>]" class="widefat">
						<option value=""><?php esc_html_e( '— Use the product\'s default —', 'openmerch-woocommerce' ); ?></option>
						<?php foreach ( $variants as $variant ) : ?>
							<option value="<?php echo esc_attr( $variant['id'] ); ?>" <?php selected( $current_variant, $variant['id'] ); ?>>
								<?php echo esc_html( $variant['name'] ); ?>
							</option>
						<?php endforeach; ?>
					</select>
				</label>
				<span class="description">
					<?php esc_html_e( 'Which OpenMerch size/model this specific variation prints as (e.g. the matching iPhone model or mug size). Determines the print zone dimensions used when a customer picks this variation and clicks Customize.', 'openmerch-woocommerce' ); ?>
				</span>
			</div>
			<?php
		}

		$current_color = get_post_meta( $variation->ID, self::META_COLOR, true );
		?>
		<div class="form-row form-row-full">
			<label>
				<input
					type="checkbox"
					name="openmerch_color_enabled[<?php echo esc_attr( $loop ); ?>]"
					value="1"
					<?php checked( '' !== $current_color ); ?>
				/>
				<?php esc_html_e( 'Preselect a product color for this variation', 'openmerch-woocommerce' ); ?>
			</label>
			<input
				type="color"
				name="openmerch_color[<?php echo esc_attr( $loop ); ?>]"
				value="<?php echo esc_attr( '' !== $current_color ? $current_color : '#ffffff' ); ?>"
			/>
			<span class="description">
				<?php esc_html_e( "Tints the product in the editor to match this variation's color (e.g. WooCommerce's own Color attribute) - purely visual, doesn't affect the print file. Leave unchecked to let the customer pick a color inside the editor themselves.", 'openmerch-woocommerce' ); ?>
			</span>
		</div>
		<?php
	}

	/**
	 * Saves the per-variation OpenMerch fields.
	 *
	 * @param int $variation_id Variation post ID.
	 * @param int $loop         Variation position (matches the field names from render_variation_fields()).
	 */
	public function save_variation_fields( $variation_id, $loop ) {
		if ( ! current_user_can( 'edit_product', $variation_id ) ) {
			return;
		}
		if ( isset( $_POST['openmerch_variant_id'][ $loop ] ) ) {
			update_post_meta(
				$variation_id,
				self::META_VARIANT_ID,
				sanitize_text_field( wp_unslash( $_POST['openmerch_variant_id'][ $loop ] ) )
			);
		}

		// The color <input type="color"> always submits a value (browsers default it to
		// #000000 when never touched) - the checkbox is what decides whether that value
		// means anything, so a variation nobody configured doesn't silently end up tinted
		// black the first time the product is ever saved.
		$color_enabled = ! empty( $_POST['openmerch_color_enabled'][ $loop ] );
		if ( $color_enabled && isset( $_POST['openmerch_color'][ $loop ] ) ) {
			update_post_meta(
				$variation_id,
				self::META_COLOR,
				sanitize_text_field( wp_unslash( $_POST['openmerch_color'][ $loop ] ) )
			);
		} else {
			delete_post_meta( $variation_id, self::META_COLOR );
		}
	}

	/**
	 * @param int $post_id WooCommerce product post ID.
	 * @return string OpenMerch product id/slug, or '' if unset.
	 */
	public static function get_product_id( $post_id ) {
		return get_post_meta( $post_id, self::META_PRODUCT_ID, true );
	}

	/**
	 * @param int $variation_id WooCommerce variation post ID.
	 * @return string OpenMerch variant id, or '' if this variation uses the product's default.
	 */
	public static function get_variant_id( $variation_id ) {
		return get_post_meta( $variation_id, self::META_VARIANT_ID, true );
	}

	/**
	 * @param int $variation_id WooCommerce variation post ID.
	 * @return string Hex color to preselect in the editor, or '' if unset.
	 */
	public static function get_color( $variation_id ) {
		return get_post_meta( $variation_id, self::META_COLOR, true );
	}

	/**
	 * @param int $post_id WooCommerce product post ID.
	 * @return string OpenMerch zone id, or '' if unset.
	 */
	public static function get_zone_id( $post_id ) {
		return get_post_meta( $post_id, self::META_ZONE_ID, true );
	}
}
