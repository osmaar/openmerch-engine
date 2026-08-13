<?php
/**
 * Bridges the design data delivered by the embedded editor's postMessage
 * into the WooCommerce cart, and carries it through to the order's line
 * item meta_data at checkout.
 *
 * @package OpenMerch_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Openmerch_Cart
 */
class Openmerch_Cart {

	const NONCE_ACTION = 'openmerch_add_to_cart';

	/** @var Openmerch_Cart|null */
	private static $instance = null;

	/**
	 * Design data for the item currently being added, set just before
	 * WC()->cart->add_to_cart() is called and read back by
	 * attach_design_data() (the woocommerce_add_cart_item_data filter)
	 * during that same call. Cleared immediately after.
	 *
	 * @var array|null
	 */
	private $pending_design_data = null;

	/**
	 * @return Openmerch_Cart
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
		add_action( 'wp_ajax_openmerch_add_to_cart', array( $this, 'ajax_add_to_cart' ) );
		add_action( 'wp_ajax_nopriv_openmerch_add_to_cart', array( $this, 'ajax_add_to_cart' ) );

		add_filter( 'woocommerce_add_cart_item_data', array( $this, 'attach_design_data' ), 10, 3 );
		add_filter( 'woocommerce_get_item_data', array( $this, 'display_item_data' ), 10, 2 );
		add_action( 'woocommerce_checkout_create_order_line_item', array( $this, 'copy_to_order_item_meta' ), 10, 4 );
	}

	/**
	 * AJAX handler (admin-ajax.php, action=openmerch_add_to_cart): receives
	 * the design data the front-end JS extracted from the editor's
	 * `openmerch:export` postMessage, and adds the product to the cart with
	 * that data attached.
	 */
	public function ajax_add_to_cart() {
		check_ajax_referer( self::NONCE_ACTION, 'nonce' );

		$wc_product_id   = isset( $_POST['wc_product_id'] ) ? absint( wp_unslash( $_POST['wc_product_id'] ) ) : 0;
		// The specific WooCommerce variation the customer had selected (size/color/etc.) when
		// they clicked "Customize" - see openmerch-embed.js's `currentWcVariationId`. Omitted
		// (0) for simple products, which have none. Required for variable products: without
		// it, add_to_cart() below is only given the parent product id, which WooCommerce
		// always rejects with "Please choose product options..." since the parent itself
		// isn't purchasable - this was a real bug (the parent-only call silently failed for
		// every variable product, e.g. the t-shirts and the iPhone case, until this was added).
		$wc_variation_id = isset( $_POST['wc_variation_id'] ) ? absint( wp_unslash( $_POST['wc_variation_id'] ) ) : 0;
		$design_key      = isset( $_POST['design_key'] ) ? sanitize_text_field( wp_unslash( $_POST['design_key'] ) ) : '';

		if ( ! $wc_product_id || '' === $design_key ) {
			wp_send_json_error( array( 'message' => __( 'Missing product or design information.', 'openmerch-woocommerce' ) ) );
		}

		$product = wc_get_product( $wc_product_id );
		if ( ! $product ) {
			wp_send_json_error( array( 'message' => __( 'Unknown product.', 'openmerch-woocommerce' ) ) );
		}

		$design_url      = isset( $_POST['design_url'] ) ? esc_url_raw( wp_unslash( $_POST['design_url'] ) ) : '';
		$design_filename = isset( $_POST['design_filename'] ) ? sanitize_file_name( wp_unslash( $_POST['design_filename'] ) ) : '';
		$width_mm        = isset( $_POST['width_mm'] ) ? sanitize_text_field( wp_unslash( $_POST['width_mm'] ) ) : '';
		$height_mm       = isset( $_POST['height_mm'] ) ? sanitize_text_field( wp_unslash( $_POST['height_mm'] ) ) : '';
		$dimensions      = ( '' !== $width_mm && '' !== $height_mm ) ? sprintf( '%sx%smm', $width_mm, $height_mm ) : '';

		// Only non-empty values are kept: _design_key is the sole
		// requirement on the OpenMerch side (see the API route's docblock -
		// orders with no _design_key on any line item are ignored as
		// non-customized), the rest are "optional but recommended".
		$this->pending_design_data = array_filter(
			array(
				'_design_key'        => $design_key,
				'_design_url'        => $design_url,
				'_design_filename'   => $design_filename,
				'_design_dimensions' => $dimensions,
			),
			static function ( $value ) {
				return '' !== $value;
			}
		);

		$cart_item_key              = WC()->cart->add_to_cart( $wc_product_id, 1, $wc_variation_id );
		$this->pending_design_data = null;

		if ( ! $cart_item_key ) {
			$notices = wc_get_notices( 'error' );
			wc_clear_notices();
			$message = ! empty( $notices[0]['notice'] )
				? wp_strip_all_tags( $notices[0]['notice'] )
				: __( 'Could not add this product to the cart.', 'openmerch-woocommerce' );
			wp_send_json_error( array( 'message' => $message ) );
		}

		wp_send_json_success(
			array(
				'cart_item_key' => $cart_item_key,
				'cart_url'      => wc_get_cart_url(),
			)
		);
	}

	/**
	 * woocommerce_add_cart_item_data filter: attaches the pending design
	 * data (set just above, immediately before add_to_cart()) to the new
	 * cart item. This is the standard WooCommerce extension point for
	 * custom per-cart-item data.
	 *
	 * @param array $cart_item_data Cart item data being built.
	 * @param int   $product_id     Product id being added.
	 * @param int   $variation_id   Variation id being added (0 if none).
	 * @return array
	 */
	public function attach_design_data( $cart_item_data, $product_id, $variation_id ) {
		if ( null !== $this->pending_design_data ) {
			$cart_item_data['openmerch_design'] = $this->pending_design_data;
			// Forces WooCommerce to treat this as a distinct line item
			// rather than bumping the quantity of an existing one - every
			// design is unique even for the same product/variation, so
			// merging quantities would silently lose which design belongs
			// to which unit.
			$cart_item_data['unique_key'] = md5( wp_json_encode( $this->pending_design_data ) . microtime() );
		}
		return $cart_item_data;
	}

	/**
	 * woocommerce_get_item_data filter: surfaces the design filename/
	 * dimensions in the cart and order-review tables so the customer can
	 * see what they're buying.
	 *
	 * @param array $item_data Existing display rows for this cart item.
	 * @param array $cart_item Cart item, including our 'openmerch_design' key.
	 * @return array
	 */
	public function display_item_data( $item_data, $cart_item ) {
		if ( empty( $cart_item['openmerch_design'] ) || ! is_array( $cart_item['openmerch_design'] ) ) {
			return $item_data;
		}

		$design = $cart_item['openmerch_design'];

		if ( ! empty( $design['_design_filename'] ) ) {
			$item_data[] = array(
				'key'   => __( 'Custom design', 'openmerch-woocommerce' ),
				'value' => esc_html( $design['_design_filename'] ),
			);
		}

		if ( ! empty( $design['_design_dimensions'] ) ) {
			$item_data[] = array(
				'key'   => __( 'Print size', 'openmerch-woocommerce' ),
				'value' => esc_html( $design['_design_dimensions'] ),
			);
		}

		return $item_data;
	}

	/**
	 * woocommerce_checkout_create_order_line_item action: this is the step
	 * that makes the design data survive past the cart and into the order -
	 * WooCommerce does NOT automatically copy arbitrary cart_item_data keys
	 * onto the order line item, so without this hook everything attached in
	 * attach_design_data() above would be lost the moment checkout runs.
	 * Firing on every checkout (block-based or classic - both go through
	 * WC_Checkout::create_order(), which fires this action per line) copies
	 * our 'openmerch_design' cart item values onto the new WC_Order_Item's
	 * meta_data.
	 *
	 * Keys are already prefixed with an underscore (_design_key, etc. - see
	 * attach_design_data()), which is also what makes WooCommerce treat them
	 * as "protected"/hidden order item meta: invisible on the customer-facing
	 * order view and My Account order details, but present in wp-admin's
	 * order edit screen and in the REST API / webhook payload - exactly the
	 * visibility the OpenMerch webhook contract expects.
	 *
	 * @param WC_Order_Item_Product $item          New order line item.
	 * @param string                $cart_item_key Cart item key.
	 * @param array                 $values        Cart item values (includes 'openmerch_design').
	 * @param WC_Order              $order         Order being created.
	 */
	public function copy_to_order_item_meta( $item, $cart_item_key, $values, $order ) {
		if ( empty( $values['openmerch_design'] ) || ! is_array( $values['openmerch_design'] ) ) {
			return;
		}

		foreach ( $values['openmerch_design'] as $meta_key => $meta_value ) {
			if ( '' === $meta_value || null === $meta_value ) {
				continue;
			}
			$item->add_meta_data( $meta_key, $meta_value, true );
		}
	}
}
