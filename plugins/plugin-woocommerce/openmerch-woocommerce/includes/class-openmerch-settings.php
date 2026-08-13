<?php
/**
 * Settings page (wp-admin > WooCommerce > OpenMerch) using the native
 * Settings API.
 *
 * @package OpenMerch_WooCommerce
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class Openmerch_Settings
 */
class Openmerch_Settings {

	const OPTION_NAME  = 'openmerch_wc_options';
	const OPTION_GROUP = 'openmerch_wc_settings_group';
	const PAGE_SLUG    = 'openmerch-woocommerce';

	/** @var Openmerch_Settings|null */
	private static $instance = null;

	/**
	 * @return Openmerch_Settings
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
		add_action( 'admin_menu', array( $this, 'add_settings_page' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_post_openmerch_regenerate_secret', array( $this, 'handle_regenerate_secret' ) );
		add_action( 'admin_post_openmerch_recreate_webhook', array( $this, 'handle_recreate_webhook' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_assets' ) );
		add_action( 'wp_ajax_openmerch_test_webhook', array( $this, 'ajax_test_webhook' ) );

		// Whenever demo_url/api_url are (re)saved, make sure the WooCommerce
		// webhook exists and points at the current api_url - covers both the
		// very first save (webhook didn't exist yet) and later URL changes.
		add_action( 'add_option_' . self::OPTION_NAME, array( $this, 'maybe_sync_webhook' ) );
		add_action( 'update_option_' . self::OPTION_NAME, array( $this, 'maybe_sync_webhook' ) );
	}

	/**
	 * @return array{demo_url:string,api_url:string,webhook_secret:string}
	 */
	public static function get_options() {
		$defaults = array(
			'demo_url'       => '',
			'api_url'        => '',
			'webhook_secret' => '',
		);
		$stored = get_option( self::OPTION_NAME, array() );
		if ( ! is_array( $stored ) ) {
			$stored = array();
		}
		return wp_parse_args( $stored, $defaults );
	}

	/**
	 * @param string $key     One of demo_url/api_url/webhook_secret.
	 * @param string $default Fallback if unset/empty.
	 * @return string
	 */
	public static function get_option( $key, $default = '' ) {
		$options = self::get_options();
		return isset( $options[ $key ] ) && '' !== $options[ $key ] ? $options[ $key ] : $default;
	}

	/**
	 * How long a fetched embed-button style stays cached before the next product page
	 * load re-checks the OpenMerch API. There's no way for the OpenMerch admin panel
	 * (a separate app) to reach into WordPress and clear this transient the moment a
	 * merchant saves a color change there, so this TTL is the only thing bounding how
	 * long a just-saved change takes to show up on the storefront. Kept short (30s)
	 * because the cost of a shorter TTL is small - this transient is one shared value for
	 * the whole site, not per-visitor, so worst case is one extra outbound request every
	 * 30s regardless of traffic - while the upside (a merchant tweaking colors doesn't
	 * have to wait minutes, or wonder if their change "didn't save") is worth it.
	 */
	const EMBED_BUTTON_STYLES_CACHE_SECONDS = 30;

	/**
	 * Styling for the "Customize" button (see Openmerch_Editor_Embed::render_embed()),
	 * configured on the OpenMerch side (wp-admin has no UI for this - it's a merchant-wide
	 * setting on the OpenMerch backend, shared across every storefront plugin/integration
	 * that embeds the same button, not a per-WordPress-site preference). Fetched from
	 * GET /api/v1/settings/public and cached in a transient (see
	 * EMBED_BUTTON_STYLES_CACHE_SECONDS) so a product page load never waits on the
	 * OpenMerch API - falls back to defaults if that API is slow, down, or the merchant
	 * never configured these.
	 *
	 * @return array{color:string,text_color:string,width:string,style:string}
	 */
	public static function get_embed_button_styles() {
		$defaults = array(
			'color'      => '#e65100',
			'text_color' => '#ffffff',
			'width'      => 'auto',
			'style'      => 'solid',
		);

		$cached = get_transient( 'openmerch_embed_button_styles' );
		if ( is_array( $cached ) ) {
			return wp_parse_args( $cached, $defaults );
		}

		$api_url = self::get_option( 'api_url' );
		if ( '' === $api_url ) {
			return $defaults;
		}

		$response = wp_remote_get(
			trailingslashit( $api_url ) . 'api/v1/settings/public',
			array( 'timeout' => 3 )
		);
		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return $defaults;
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) ) {
			return $defaults;
		}

		$styles = array(
			'color'      => ! empty( $body['embed_button_color'] ) ? $body['embed_button_color'] : $defaults['color'],
			'text_color' => ! empty( $body['embed_button_text_color'] ) ? $body['embed_button_text_color'] : $defaults['text_color'],
			'width'      => ! empty( $body['embed_button_width'] ) ? $body['embed_button_width'] : $defaults['width'],
			'style'      => ! empty( $body['embed_button_style'] ) ? $body['embed_button_style'] : $defaults['style'],
		);

		set_transient( 'openmerch_embed_button_styles', $styles, self::EMBED_BUTTON_STYLES_CACHE_SECONDS );

		return $styles;
	}

	/** How long the OpenMerch product catalog stays cached for the product-edit-screen dropdown. */
	const PRODUCTS_CACHE_SECONDS = 60;

	/**
	 * Fetches the OpenMerch product catalog (id, name, slug, active) for the "OpenMerch
	 * Product ID" dropdown on the product edit screen (see
	 * Openmerch_Product_Meta::render_meta_box()) - picking from a real list instead of
	 * typing an id/slug from memory is what makes that mapping impossible to typo.
	 * Cached briefly since this only loads on an admin screen, not on every storefront
	 * page view. Returns an empty array (never a WP_Error) if the API is unreachable or
	 * unconfigured - the caller falls back to a plain text field in that case.
	 *
	 * @return array<int, array{id: string, name: string, slug: string, active: bool}>
	 */
	public static function get_products() {
		$cached = get_transient( 'openmerch_products' );
		if ( is_array( $cached ) ) {
			return $cached;
		}

		$api_url = self::get_option( 'api_url' );
		if ( '' === $api_url ) {
			return array();
		}

		$response = wp_remote_get(
			trailingslashit( $api_url ) . 'api/v1/products',
			array( 'timeout' => 3 )
		);
		if ( is_wp_error( $response ) || 200 !== wp_remote_retrieve_response_code( $response ) ) {
			return array();
		}

		$body = json_decode( wp_remote_retrieve_body( $response ), true );
		if ( ! is_array( $body ) ) {
			return array();
		}

		$products = array();
		foreach ( $body as $product ) {
			if ( ! is_array( $product ) || empty( $product['id'] ) ) {
				continue;
			}
			$variants = array();
			if ( ! empty( $product['variants'] ) && is_array( $product['variants'] ) ) {
				foreach ( $product['variants'] as $variant ) {
					if ( is_array( $variant ) && ! empty( $variant['id'] ) ) {
						$variants[] = array(
							'id'   => $variant['id'],
							'name' => isset( $variant['name'] ) ? $variant['name'] : $variant['id'],
						);
					}
				}
			}
			$products[] = array(
				'id'       => $product['id'],
				'name'     => isset( $product['name'] ) ? $product['name'] : $product['id'],
				'slug'     => isset( $product['slug'] ) ? $product['slug'] : '',
				'active'   => ! empty( $product['active'] ),
				// Different physical sizes/models of the same OpenMerch product (e.g. iPhone
				// models, mug sizes) - each has its own print zone dimensions. Empty for
				// products with no size/model variants (e.g. a t-shirt, where size/color are
				// WooCommerce-only concepts that don't change the print area).
				'variants' => $variants,
			);
		}

		set_transient( 'openmerch_products', $products, self::PRODUCTS_CACHE_SECONDS );

		return $products;
	}

	/**
	 * @param string $openmerch_product_id Id of a product returned by get_products().
	 * @return array<int, array{id: string, name: string}> That product's size/model
	 *   variants, or an empty array if it has none (or isn't found).
	 */
	public static function get_product_variants( $openmerch_product_id ) {
		foreach ( self::get_products() as $product ) {
			if ( $product['id'] === $openmerch_product_id ) {
				return $product['variants'];
			}
		}
		return array();
	}

	/**
	 * Merges $partial into the stored options and saves.
	 *
	 * @param array $partial Keys to overwrite.
	 * @return array Resulting full options array.
	 */
	public static function update_options( array $partial ) {
		$options = array_merge( self::get_options(), $partial );
		update_option( self::OPTION_NAME, $options );
		return $options;
	}

	/**
	 * Registers the settings page under WooCommerce's own admin menu.
	 */
	public function add_settings_page() {
		add_submenu_page(
			'woocommerce',
			__( 'OpenMerch', 'openmerch-woocommerce' ),
			__( 'OpenMerch', 'openmerch-woocommerce' ),
			'manage_woocommerce',
			self::PAGE_SLUG,
			array( $this, 'render_settings_page' )
		);
	}

	/**
	 * Registers the Settings API group/section/fields. Only demo_url and
	 * api_url are user-editable through this form - webhook_secret is
	 * generated/regenerated separately (see render_settings_page()) so a
	 * plain settings-form save can never accidentally blank it out.
	 */
	public function register_settings() {
		register_setting(
			self::OPTION_GROUP,
			self::OPTION_NAME,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( $this, 'sanitize_options' ),
				'default'           => array(),
			)
		);

		add_settings_section(
			'openmerch_wc_main_section',
			__( 'OpenMerch Engine connection', 'openmerch-woocommerce' ),
			array( $this, 'render_section_intro' ),
			self::PAGE_SLUG
		);

		add_settings_field(
			'demo_url',
			__( 'Editor URL', 'openmerch-woocommerce' ),
			array( $this, 'render_demo_url_field' ),
			self::PAGE_SLUG,
			'openmerch_wc_main_section'
		);

		add_settings_field(
			'api_url',
			__( 'API URL', 'openmerch-woocommerce' ),
			array( $this, 'render_api_url_field' ),
			self::PAGE_SLUG,
			'openmerch_wc_main_section'
		);
	}

	/**
	 * Sanitizes the settings-form submission. Preserves webhook_secret from
	 * the existing stored value, since it is not part of this form.
	 *
	 * @param array $input Raw $_POST-derived value for the option.
	 * @return array Sanitized full options array.
	 */
	public function sanitize_options( $input ) {
		$output = self::get_options();

		$output['demo_url'] = isset( $input['demo_url'] )
			? esc_url_raw( trim( sanitize_text_field( $input['demo_url'] ) ) )
			: '';

		$output['api_url'] = isset( $input['api_url'] )
			? esc_url_raw( trim( sanitize_text_field( $input['api_url'] ) ) )
			: '';

		return $output;
	}

	/**
	 * Fires after the options are saved (add or update) - ensures the
	 * WooCommerce webhook exists/points at the current api_url.
	 */
	public function maybe_sync_webhook() {
		if ( class_exists( 'Openmerch_Webhook' ) ) {
			Openmerch_Webhook::activate();
		}
		// api_url may have just changed - drop the cached button styles/product list so
		// the next page load re-fetches from the (possibly new) OpenMerch instance
		// instead of waiting out the rest of the old transient's TTL.
		delete_transient( 'openmerch_embed_button_styles' );
		delete_transient( 'openmerch_products' );
	}

	/**
	 * admin-post.php handler: regenerates the webhook secret and pushes it
	 * to the already-registered WooCommerce webhook.
	 */
	public function handle_regenerate_secret() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'openmerch-woocommerce' ) );
		}
		check_admin_referer( 'openmerch_regenerate_secret' );

		$secret = wp_generate_password( 40, false, false );
		self::update_options( array( 'webhook_secret' => $secret ) );

		if ( class_exists( 'Openmerch_Webhook' ) ) {
			Openmerch_Webhook::sync_secret( $secret );
		}

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'             => self::PAGE_SLUG,
					'openmerch_notice' => 'secret_regenerated',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * admin-post.php handler: forces a webhook create/repair pass.
	 */
	public function handle_recreate_webhook() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_die( esc_html__( 'You do not have permission to do this.', 'openmerch-woocommerce' ) );
		}
		check_admin_referer( 'openmerch_recreate_webhook' );

		if ( class_exists( 'Openmerch_Webhook' ) ) {
			Openmerch_Webhook::activate();
		}

		wp_safe_redirect(
			add_query_arg(
				array(
					'page'             => self::PAGE_SLUG,
					'openmerch_notice' => 'webhook_recreated',
				),
				admin_url( 'admin.php' )
			)
		);
		exit;
	}

	/**
	 * AJAX handler backing the "Test connection" button: sends a
	 * correctly-signed empty test payload to the OpenMerch webhook route and
	 * surfaces what came back, including the 503 "OpenMerch has no secret
	 * configured" case the plugin itself cannot fix.
	 */
	public function ajax_test_webhook() {
		check_ajax_referer( 'openmerch_test_webhook', 'nonce' );

		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			wp_send_json_error( array( 'message' => __( 'Permission denied.', 'openmerch-woocommerce' ) ) );
		}

		$api_url = self::get_option( 'api_url' );
		$secret  = self::get_option( 'webhook_secret' );

		if ( '' === $api_url ) {
			wp_send_json_error( array( 'message' => __( 'Set the API URL and save your settings first.', 'openmerch-woocommerce' ) ) );
		}
		if ( '' === $secret ) {
			wp_send_json_error( array( 'message' => __( 'No webhook secret yet - save your settings once to generate one.', 'openmerch-woocommerce' ) ) );
		}

		$body      = '{}';
		$signature = base64_encode( hash_hmac( 'sha256', $body, $secret, true ) );

		$response = wp_remote_post(
			untrailingslashit( $api_url ) . '/api/v1/orders/webhook/woocommerce',
			array(
				'headers' => array(
					'Content-Type'           => 'application/json',
					'X-WC-Webhook-Signature' => $signature,
				),
				'body'    => $body,
				'timeout' => 15,
			)
		);

		if ( is_wp_error( $response ) ) {
			wp_send_json_error( array( 'message' => $response->get_error_message() ) );
		}

		$code = wp_remote_retrieve_response_code( $response );

		if ( 200 === $code ) {
			wp_send_json_success( array( 'message' => __( 'Connected - OpenMerch accepted the test webhook.', 'openmerch-woocommerce' ) ) );
		} elseif ( 401 === $code ) {
			wp_send_json_error( array( 'message' => __( 'OpenMerch rejected the signature. Make sure this secret matches WOOCOMMERCE_WEBHOOK_SECRET on the OpenMerch API.', 'openmerch-woocommerce' ) ) );
		} elseif ( 503 === $code ) {
			wp_send_json_error( array( 'message' => __( 'OpenMerch has no webhook secret configured on its side (WOOCOMMERCE_WEBHOOK_SECRET is unset in the API). Ask whoever runs the OpenMerch API to set it - the plugin cannot fix this from here.', 'openmerch-woocommerce' ) ) );
		} else {
			wp_send_json_error(
				array(
					/* translators: %d: HTTP status code */
					'message' => sprintf( __( 'Unexpected response (HTTP %d).', 'openmerch-woocommerce' ), $code ),
				)
			);
		}
	}

	/**
	 * Enqueues the tiny bit of admin JS backing the "Test connection"
	 * button, only on our own settings page. Uses wp_add_inline_script
	 * (the WP-sanctioned mechanism) rather than an inline <script> echoed
	 * with concatenated PHP - the config values are passed through
	 * wp_json_encode(), never string-concatenated into the script body.
	 *
	 * @param string $hook Current admin page hook suffix.
	 */
	public function enqueue_admin_assets( $hook ) {
		if ( 'woocommerce_page_' . self::PAGE_SLUG !== $hook ) {
			return;
		}

		wp_enqueue_script( 'jquery' );

		$config = array(
			'ajaxUrl' => admin_url( 'admin-ajax.php' ),
			'nonce'   => wp_create_nonce( 'openmerch_test_webhook' ),
		);

		wp_add_inline_script( 'jquery', 'window.OpenMerchAdmin = ' . wp_json_encode( $config ) . ';', 'before' );
		wp_add_inline_script( 'jquery', $this->admin_test_button_script(), 'after' );

		// Minimal color-coding for the "Test connection" result - registered
		// against wp-admin's own baseline stylesheet so we don't need a
		// dedicated admin CSS file for two rules.
		wp_add_inline_style(
			'common',
			'#openmerch-test-webhook-result{margin-left:8px;font-style:italic;}'
			. '#openmerch-test-webhook-result.openmerch-ok{color:#1a7f37;font-style:normal;}'
			. '#openmerch-test-webhook-result.openmerch-fail{color:#b32d2e;font-style:normal;}'
		);
	}

	/**
	 * @return string Static JS (no interpolated request data) for the
	 *                "Test connection" button.
	 */
	private function admin_test_button_script() {
		return "jQuery(function($){"
			. "var \$btn=$('#openmerch-test-webhook');"
			. "var \$result=$('#openmerch-test-webhook-result');"
			. "\$btn.on('click', function(e){"
			. "e.preventDefault();"
			. "\$btn.prop('disabled', true);"
			. "\$result.text('...').removeClass('openmerch-ok openmerch-fail');"
			. "$.post(OpenMerchAdmin.ajaxUrl, {action:'openmerch_test_webhook', nonce:OpenMerchAdmin.nonce})"
			. ".done(function(res){"
			. "\$result.text((res && res.data && res.data.message) ? res.data.message : '');"
			. "\$result.toggleClass('openmerch-ok', !!(res && res.success));"
			. "\$result.toggleClass('openmerch-fail', !(res && res.success));"
			. "})"
			. ".fail(function(){ \$result.text('Request failed.').addClass('openmerch-fail'); })"
			. ".always(function(){ \$btn.prop('disabled', false); });"
			. "});"
			. "});";
	}

	/**
	 * Warns the merchant when WooCommerce's own webhook delivery bookkeeping shows recent
	 * failures - the case the OpenMerch API's delivery log (visible in its Admin Panel) can
	 * never see by definition, because these deliveries never reached the API at all (blocked
	 * host/port, DNS failure, the API being down). See Openmerch_Webhook::get_health().
	 */
	private function render_webhook_health_notice() {
		if ( ! class_exists( 'Openmerch_Webhook' ) ) {
			return;
		}
		$health = Openmerch_Webhook::get_health();
		if ( ! $health['registered'] ) {
			return;
		}

		if ( 'disabled' === $health['status'] ) {
			?>
			<div class="notice notice-error">
				<p>
					<strong><?php esc_html_e( 'OpenMerch webhook disabled by WooCommerce.', 'openmerch-woocommerce' ); ?></strong>
					<?php esc_html_e( 'WooCommerce automatically disables a webhook after too many consecutive delivery failures - this usually means the OpenMerch API could not be reached at all (wrong API URL, the API is down, or a firewall/network block), not a problem with an individual order.', 'openmerch-woocommerce' ); ?>
				</p>
				<p>
					<?php
					printf(
						/* translators: %s: link to the WooCommerce > Status > Logs page */
						esc_html__( 'Check %s (source "webhooks-delivery") for the exact error, fix the API URL/network access, then use "Recreate / repair webhook" below to re-enable it.', 'openmerch-woocommerce' ),
						'<a href="' . esc_url( admin_url( 'admin.php?page=wc-status&tab=logs' ) ) . '">' . esc_html__( 'WooCommerce > Status > Logs', 'openmerch-woocommerce' ) . '</a>'
					);
					?>
				</p>
			</div>
			<?php
		} elseif ( $health['failure_count'] > 0 ) {
			?>
			<div class="notice notice-warning">
				<p>
					<?php
					printf(
						/* translators: 1: number of consecutive failed deliveries, 2: link to the WooCommerce > Status > Logs page */
						esc_html__( '%1$d consecutive OpenMerch webhook delivery failure(s) so far. If this keeps happening WooCommerce will disable the webhook automatically. Check %2$s (source "webhooks-delivery") for details.', 'openmerch-woocommerce' ),
						(int) $health['failure_count'],
						'<a href="' . esc_url( admin_url( 'admin.php?page=wc-status&tab=logs' ) ) . '">' . esc_html__( 'WooCommerce > Status > Logs', 'openmerch-woocommerce' ) . '</a>'
					);
					?>
				</p>
			</div>
			<?php
		}
	}

	/**
	 * Renders the settings page markup.
	 */
	public function render_settings_page() {
		if ( ! current_user_can( 'manage_woocommerce' ) ) {
			return;
		}

		$options = self::get_options();
		?>
		<div class="wrap openmerch-settings">
			<h1><?php esc_html_e( 'OpenMerch', 'openmerch-woocommerce' ); ?></h1>

			<?php if ( isset( $_GET['openmerch_notice'] ) ) : ?>
				<div class="notice notice-success is-dismissible">
					<p>
						<?php
						$notice = sanitize_key( wp_unslash( $_GET['openmerch_notice'] ) );
						if ( 'secret_regenerated' === $notice ) {
							esc_html_e( 'Webhook secret regenerated and pushed to the WooCommerce webhook.', 'openmerch-woocommerce' );
						} elseif ( 'webhook_recreated' === $notice ) {
							esc_html_e( 'Webhook configuration synced with WooCommerce.', 'openmerch-woocommerce' );
						}
						?>
					</p>
				</div>
			<?php endif; ?>

			<?php $this->render_webhook_health_notice(); ?>

			<form method="post" action="options.php">
				<?php
				settings_fields( self::OPTION_GROUP );
				do_settings_sections( self::PAGE_SLUG );
				submit_button( __( 'Save changes', 'openmerch-woocommerce' ) );
				?>
			</form>

			<hr />

			<h2><?php esc_html_e( 'Webhook', 'openmerch-woocommerce' ); ?></h2>
			<table class="form-table" role="presentation">
				<tr>
					<th scope="row"><?php esc_html_e( 'Secret', 'openmerch-woocommerce' ); ?></th>
					<td>
						<code>
							<?php
							if ( $options['webhook_secret'] ) {
								$masked = str_repeat( '*', max( 0, strlen( $options['webhook_secret'] ) - 4 ) ) . substr( $options['webhook_secret'], -4 );
								echo esc_html( $masked );
							} else {
								esc_html_e( '(not generated yet)', 'openmerch-woocommerce' );
							}
							?>
						</code>
						<p class="description">
							<?php esc_html_e( 'Generated automatically the first time you save the API URL. Must match the secret OpenMerch uses to verify this webhook (WOOCOMMERCE_WEBHOOK_SECRET on the API side).', 'openmerch-woocommerce' ); ?>
						</p>
						<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline-block;margin-top:6px;">
							<input type="hidden" name="action" value="openmerch_regenerate_secret" />
							<?php wp_nonce_field( 'openmerch_regenerate_secret' ); ?>
							<?php submit_button( __( 'Regenerate secret', 'openmerch-woocommerce' ), 'secondary', 'submit', false ); ?>
						</form>
					</td>
				</tr>
				<tr>
					<th scope="row"><?php esc_html_e( 'WooCommerce webhook', 'openmerch-woocommerce' ); ?></th>
					<td>
						<p>
							<?php
							echo esc_html(
								class_exists( 'Openmerch_Webhook' )
									? Openmerch_Webhook::get_status_label()
									: __( 'Unknown', 'openmerch-woocommerce' )
							);
							?>
						</p>
						<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" style="display:inline-block;">
							<input type="hidden" name="action" value="openmerch_recreate_webhook" />
							<?php wp_nonce_field( 'openmerch_recreate_webhook' ); ?>
							<?php submit_button( __( 'Recreate / repair webhook', 'openmerch-woocommerce' ), 'secondary', 'submit', false ); ?>
						</form>
						&nbsp;
						<button type="button" id="openmerch-test-webhook" class="button"><?php esc_html_e( 'Test connection', 'openmerch-woocommerce' ); ?></button>
						<span id="openmerch-test-webhook-result"></span>
					</td>
				</tr>
			</table>
		</div>
		<?php
	}

	/**
	 * Renders the settings section intro text.
	 */
	public function render_section_intro() {
		echo '<p>' . esc_html__( 'Point this store at your self-hosted OpenMerch Engine instance.', 'openmerch-woocommerce' ) . '</p>';
	}

	/**
	 * Renders the Editor URL field.
	 */
	public function render_demo_url_field() {
		$value = self::get_option( 'demo_url' );
		?>
		<input
			type="url"
			class="regular-text"
			name="<?php echo esc_attr( self::OPTION_NAME ); ?>[demo_url]"
			id="openmerch_demo_url"
			value="<?php echo esc_attr( $value ); ?>"
			placeholder="https://demo.yourstore.com"
		/>
		<p class="description">
			<?php esc_html_e( 'Base URL of the OpenMerch editor/embed app (apps/demo). The product-page iframe points here.', 'openmerch-woocommerce' ); ?>
		</p>
		<?php
	}

	/**
	 * Renders the API URL field.
	 */
	public function render_api_url_field() {
		$value = self::get_option( 'api_url' );
		?>
		<input
			type="url"
			class="regular-text"
			name="<?php echo esc_attr( self::OPTION_NAME ); ?>[api_url]"
			id="openmerch_api_url"
			value="<?php echo esc_attr( $value ); ?>"
			placeholder="https://api.yourstore.com"
		/>
		<p class="description">
			<?php esc_html_e( 'Base URL of the OpenMerch API (packages/api). Used for the order webhook and the connection test.', 'openmerch-woocommerce' ); ?>
		</p>
		<?php
	}
}
