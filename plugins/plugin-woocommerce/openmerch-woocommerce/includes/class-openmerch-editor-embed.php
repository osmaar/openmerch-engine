<?php
/**
 * Front-end product page: renders a "Customize" button next to WooCommerce's
 * default Add to Cart form (not in place of it — a customer can still buy the
 * base product as-is) when a product has an OpenMerch product mapping
 * configured. The button opens the OpenMerch editor in a new tab rather than
 * an embedded iframe, since the editor's own UI (canvas + sidebar + property
 * panels) needs far more width than the narrow product-summary column most
 * WooCommerce themes give the Add to Cart area.
 *
 * @package OpenMerch_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Openmerch_Editor_Embed
 */
class Openmerch_Editor_Embed {

	/** @var Openmerch_Editor_Embed|null */
	private static $instance = null;

	/**
	 * @return Openmerch_Editor_Embed
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
		// Fires inside the native `<form class="cart">`, right after the Add to
		// Cart `<button>` and before `</form>` (see WooCommerce's own
		// templates/single-product/add-to-cart/simple.php) - this is what puts
		// the Customize button on the same row as Add to Cart instead of below
		// it, since that form's own layout (theme-dependent flex/inline-block
		// styling for qty + button) applies to our button too.
		add_action( 'woocommerce_after_add_to_cart_button', array( $this, 'maybe_render_customize_button' ) );
	}

	/**
	 * Renders the "Customize" button (and status container) right after the
	 * native Add to Cart form, if the current global $product has an
	 * OpenMerch mapping configured.
	 */
	public function maybe_render_customize_button() {
		global $product;

		if ( ! $product instanceof WC_Product ) {
			return;
		}

		$openmerch_product_id = Openmerch_Product_Meta::get_product_id( $product->get_id() );
		if ( '' === $openmerch_product_id ) {
			return;
		}

		$this->render_embed( $product, $openmerch_product_id );
	}

	/**
	 * Renders the button + status container, and enqueues the supporting
	 * assets. Clicking the button opens the OpenMerch editor
	 * (`assets/js/openmerch-embed.js`'s click handler) in a new tab via
	 * `window.open()`, pre-loaded with this product and locked to it (the
	 * editor hides its own product switcher whenever it detects it's been
	 * handed an `onExport` callback - see `ProductTab.tsx`). That tab posts
	 * the finished design back to this one via `window.opener.postMessage()`
	 * (same listener as the old iframe pattern - it never cared whether the
	 * sender was a nested frame or an opener tab).
	 *
	 * @param WC_Product $product               Current product.
	 * @param string     $openmerch_product_id  Mapped OpenMerch product id/slug.
	 */
	private function render_embed( $product, $openmerch_product_id ) {
		$demo_url = Openmerch_Settings::get_option( 'demo_url' );

		if ( '' === $demo_url ) {
			echo '<p class="openmerch-embed-error">'
				. esc_html__( 'The OpenMerch editor URL is not configured yet. Set it under WooCommerce > OpenMerch.', 'openmerch-woocommerce' )
				. '</p>';
			return;
		}

		$this->enqueue_assets( $product, $demo_url );

		$src = add_query_arg(
			array(
				'product'      => rawurlencode( $openmerch_product_id ),
				'embed'        => '1',
				'parentOrigin' => rawurlencode( $this->get_site_origin() ),
				// Lets the OpenMerch admin panel tell designs/orders from this storefront
				// apart from any other integration (Shopify, another WooCommerce site)
				// pointed at the same OpenMerch instance.
				'source'       => 'woocommerce',
			),
			trailingslashit( $demo_url )
		);

		$button_styles = Openmerch_Settings::get_embed_button_styles();
		$is_outline    = 'outline' === $button_styles['style'];
		$button_style  = sprintf(
			// 3px to match WooCommerce's native "Add to cart" button border width in most
			// themes (Storefront included) - at 2px this button rendered slightly shorter,
			// making it sit visibly lower than "Add to cart" on the same row.
			'background-color:%s;color:%s;border:3px solid %s;',
			$is_outline ? 'transparent' : esc_attr( $button_styles['color'] ),
			$is_outline ? esc_attr( $button_styles['color'] ) : esc_attr( $button_styles['text_color'] ),
			esc_attr( $button_styles['color'] )
		);
		if ( 'full' === $button_styles['width'] ) {
			$button_style .= 'display:block;width:100%;';
		}
		?>
		<div id="openmerch-embed-wrapper" class="openmerch-embed-wrapper">
			<button
				type="button"
				id="openmerch-customize-button"
				class="openmerch-customize-button"
				style="<?php echo esc_attr( $button_style ); ?>"
				data-editor-url="<?php echo esc_url( $src ); ?>"
			>
				<?php esc_html_e( 'Customize', 'openmerch-woocommerce' ); ?>
			</button>
			<div id="openmerch-embed-message" class="openmerch-embed-message" role="status" aria-live="polite"></div>
		</div>
		<?php
	}

	/**
	 * Origin (scheme://host[:port]) of the current WordPress site - the
	 * value the embedded editor is told to target with postMessage
	 * (`parentOrigin`), and which the storefront's own listener trusts as
	 * "us" when it receives the resulting message back.
	 *
	 * @return string
	 */
	private function get_site_origin() {
		return $this->origin_from_url( home_url() );
	}

	/**
	 * Origin of the configured OpenMerch editor - the only origin our own
	 * `message` event listener accepts postMessage payloads from.
	 *
	 * @param string $demo_url Configured editor base URL.
	 * @return string
	 */
	private function get_editor_origin( $demo_url ) {
		return $this->origin_from_url( $demo_url );
	}

	/**
	 * @param string $url Any absolute URL.
	 * @return string scheme://host[:port]
	 */
	private function origin_from_url( $url ) {
		$parts  = wp_parse_url( $url );
		$scheme = isset( $parts['scheme'] ) ? $parts['scheme'] : 'https';
		$host   = isset( $parts['host'] ) ? $parts['host'] : '';
		$port   = isset( $parts['port'] ) ? ':' . $parts['port'] : '';
		return $scheme . '://' . $host . $port;
	}

	/**
	 * Maps each of this product's WooCommerce variation ids to the OpenMerch variant id
	 * configured for it (see Openmerch_Product_Meta::render_variation_fields()). Empty for
	 * a simple product, or for any variation left on "use the product's default". The
	 * front-end script uses this to know which OpenMerch variant to open the editor with
	 * once the customer picks a specific size/model - baking the WC variation id straight
	 * into the Customize URL would mean nothing to OpenMerch, which has no concept of
	 * WooCommerce's variation ids.
	 *
	 * @param WC_Product $product Current product.
	 * @return array<int, string> WC variation id => OpenMerch variant id.
	 */
	private function build_variant_map( $product ) {
		$map = array();
		if ( ! $product->is_type( 'variable' ) ) {
			return $map;
		}
		foreach ( $product->get_children() as $variation_id ) {
			$variant_id = Openmerch_Product_Meta::get_variant_id( $variation_id );
			if ( '' !== $variant_id ) {
				$map[ $variation_id ] = $variant_id;
			}
		}
		return $map;
	}

	/**
	 * Maps each of this product's WooCommerce variation ids to the hex color configured
	 * for it (see Openmerch_Product_Meta::render_variation_fields()). Independent of
	 * build_variant_map() above - a simple product with no OpenMerch-side variants (e.g. a
	 * t-shirt) can still have a per-variation color to preselect, since color is purely a
	 * visual tint in the editor, not tied to print zones at all.
	 *
	 * @param WC_Product $product Current product.
	 * @return array<int, string> WC variation id => hex color.
	 */
	private function build_color_map( $product ) {
		$map = array();
		if ( ! $product->is_type( 'variable' ) ) {
			return $map;
		}
		foreach ( $product->get_children() as $variation_id ) {
			$color = Openmerch_Product_Meta::get_color( $variation_id );
			if ( '' !== $color ) {
				$map[ $variation_id ] = $color;
			}
		}
		return $map;
	}

	/**
	 * Enqueues the embed JS/CSS and localizes the JS with everything it
	 * needs. All dynamic data reaches the script exclusively through
	 * wp_localize_script (which JSON-encodes it) - never as raw inline
	 * <script> markup built from string concatenation.
	 *
	 * @param WC_Product $product  Current product.
	 * @param string     $demo_url Configured editor base URL.
	 */
	private function enqueue_assets( $product, $demo_url ) {
		wp_enqueue_style(
			'openmerch-embed',
			OPENMERCH_WC_PLUGIN_URL . 'assets/css/openmerch-embed.css',
			array(),
			OPENMERCH_WC_VERSION
		);

		wp_enqueue_script(
			'openmerch-embed',
			OPENMERCH_WC_PLUGIN_URL . 'assets/js/openmerch-embed.js',
			// jquery: needed to listen for WooCommerce's own `found_variation` event on
			// variable products (see openmerch-embed.js) - WC's variation-form script fires
			// it as a jQuery custom event, not a native DOM event.
			array( 'jquery' ),
			OPENMERCH_WC_VERSION,
			true
		);

		wp_localize_script(
			'openmerch-embed',
			'OpenMerchEmbed',
			array(
				'ajaxUrl'       => admin_url( 'admin-ajax.php' ),
				'nonce'         => wp_create_nonce( 'openmerch_add_to_cart' ),
				'allowedOrigin' => $this->get_editor_origin( $demo_url ),
				'wcProductId'   => $product->get_id(),
				'cartUrl'       => wc_get_cart_url(),
				'variantMap'    => $this->build_variant_map( $product ),
				'colorMap'      => $this->build_color_map( $product ),
				// Whether the customer must complete a full attribute selection (size,
				// color, model...) before anything downstream is even valid - see the
				// click handler in openmerch-embed.js. A simple product has no such
				// concept, so it's always fine to open the editor immediately.
				'isVariable'    => $product->is_type( 'variable' ),
				'i18n'          => array(
					'adding'             => __( 'Adding your design to the cart...', 'openmerch-woocommerce' ),
					'error'              => __( 'Something went wrong adding your design to the cart. Please try again.', 'openmerch-woocommerce' ),
					'popupBlocked'       => __( 'Your browser blocked the customizer popup. Please allow popups for this site and try again.', 'openmerch-woocommerce' ),
					'selectOptionsFirst' => __( 'Please select all product options above before customizing.', 'openmerch-woocommerce' ),
				),
			)
		);
	}
}
