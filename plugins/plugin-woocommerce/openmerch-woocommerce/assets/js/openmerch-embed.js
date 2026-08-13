/**
 * OpenMerch WooCommerce embed bridge.
 *
 * Opens the OpenMerch editor in a new tab when the "Customize" button is
 * clicked, and listens for the `openmerch:export` / `openmerch:export-error`
 * postMessage that tab sends back once the customer finishes their design
 * (via `window.opener.postMessage()` - see apps/demo/src/App.tsx). On
 * success, calls back into WordPress (admin-ajax.php) to add the customized
 * product to the WooCommerce cart with the design data attached.
 *
 * Security: `event.origin` is checked against `OpenMerchEmbed.allowedOrigin`
 * (the configured OpenMerch editor's own origin - see
 * class-openmerch-editor-embed.php) before any message is processed. Never
 * trust postMessage without an origin check, and never widen this to '*'.
 *
 * `OpenMerchEmbed` is provided via wp_localize_script() - see
 * includes/class-openmerch-editor-embed.php.
 */
( function () {
	'use strict';

	if ( typeof window.OpenMerchEmbed === 'undefined' ) {
		return;
	}

	var config = window.OpenMerchEmbed;
	var messageEl = document.getElementById( 'openmerch-embed-message' );

	/**
	 * Reference to the editor tab opened by the "Customize" button - kept at this outer
	 * scope (not local to the click handler) so `addToCart()` can reply to it once the
	 * add-to-cart AJAX call actually finishes. Without this reply, the editor tab has no
	 * way to know whether this page's `WC()->cart->add_to_cart()` call succeeded, failed,
	 * or is still in flight - it could only show an optimistic "success" the instant the
	 * design finished uploading, regardless of what happens here afterwards. That's what
	 * caused the customer-reported bug: closing/returning from the editor tab before this
	 * (backgrounded, possibly browser-throttled) tab finished its own AJAX call and cart
	 * redirect made it look like "the cart never updated".
	 */
	var editorTab = null;

	/**
	 * @param {string} text
	 * @param {string|null} variant 'busy' | 'error' | null
	 */
	function setMessage( text, variant ) {
		if ( ! messageEl ) {
			return;
		}
		messageEl.textContent = text || '';
		messageEl.className = 'openmerch-embed-message';
		if ( variant ) {
			messageEl.className += ' openmerch-embed-message--' + variant;
		}
	}

	/**
	 * @param {*} value
	 * @return {boolean}
	 */
	function isPlainObject( value ) {
		return !! value && typeof value === 'object';
	}

	/**
	 * Replies to the editor tab so it can stop showing an optimistic "success" and instead
	 * reflect what actually happened here - see the `editorTab` comment above for why this
	 * exists. A no-op if that tab already closed itself (`editorTab.closed`) or was never
	 * tracked (e.g. a popup blocker returned null when it was opened).
	 *
	 * @param {string} type 'openmerch:added-to-cart' | 'openmerch:add-to-cart-error'
	 * @param {object} data
	 */
	function replyToEditorTab( type, data ) {
		if ( ! editorTab || editorTab.closed ) {
			return;
		}
		var payload = { type: type };
		for ( var key in data ) {
			if ( Object.prototype.hasOwnProperty.call( data, key ) ) {
				payload[ key ] = data[ key ];
			}
		}
		editorTab.postMessage( payload, config.allowedOrigin );
	}

	/**
	 * Sends the exported design to admin-ajax.php to be added to the cart,
	 * then redirects to the cart on success. Also replies to the editor tab
	 * (see `replyToEditorTab`) so its confirmation modal reflects reality
	 * instead of appearing the instant the design finished uploading.
	 *
	 * @param {string} designUrl
	 * @param {object} meta
	 */
	function addToCart( designUrl, meta ) {
		setMessage( config.i18n && config.i18n.adding, 'busy' );

		var body = new URLSearchParams();
		body.set( 'action', 'openmerch_add_to_cart' );
		body.set( 'nonce', config.nonce );
		body.set( 'wc_product_id', String( config.wcProductId ) );
		body.set( 'wc_variation_id', currentWcVariationId ? String( currentWcVariationId ) : '' );
		body.set( 'design_key', ( meta && meta.designKey ) || '' );
		body.set( 'design_url', designUrl || '' );
		body.set( 'design_filename', ( meta && meta.filename ) || '' );
		body.set( 'width_mm', meta && typeof meta.widthMm !== 'undefined' ? String( meta.widthMm ) : '' );
		body.set( 'height_mm', meta && typeof meta.heightMm !== 'undefined' ? String( meta.heightMm ) : '' );

		fetch( config.ajaxUrl, {
			method: 'POST',
			credentials: 'same-origin',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: body.toString(),
		} )
			.then( function ( response ) {
				return response.json();
			} )
			.then( function ( json ) {
				if ( json && json.success && json.data && json.data.cart_url ) {
					setMessage( '', null );
					replyToEditorTab( 'openmerch:added-to-cart', { cartUrl: json.data.cart_url } );
					window.location.href = json.data.cart_url;
					return;
				}
				var message = ( json && json.data && json.data.message ) || ( config.i18n && config.i18n.error );
				setMessage( message, 'error' );
				replyToEditorTab( 'openmerch:add-to-cart-error', { error: message } );
			} )
			.catch( function () {
				var message = config.i18n && config.i18n.error;
				setMessage( message, 'error' );
				replyToEditorTab( 'openmerch:add-to-cart-error', { error: message } );
			} );
	}

	window.addEventListener( 'message', function ( event ) {
		if ( event.origin !== config.allowedOrigin ) {
			return;
		}
		if ( ! isPlainObject( event.data ) ) {
			return;
		}

		if ( 'openmerch:export' === event.data.type ) {
			addToCart( event.data.designUrl, event.data.meta );
		} else if ( 'openmerch:export-error' === event.data.type ) {
			setMessage( event.data.error || ( config.i18n && config.i18n.error ), 'error' );
		}
	} );

	// For a variable product (size/model options), `config.variantMap` maps each WC
	// variation id to the OpenMerch variant id configured for it (see
	// Openmerch_Product_Meta::render_variation_fields()). WooCommerce's own variation-form
	// script (wc-add-to-cart-variation, always loaded alongside it - jQuery is declared as
	// this script's dependency specifically so it's available here) fires `found_variation`
	// on `.variations_form` with the selected variation's data once every attribute
	// (size/color/model) has a value. Tracking that here is what lets the Customize button
	// - baked into the page once at load with no variant in its URL - open the editor with
	// the print zone matching whatever the customer actually picked, instead of always the
	// product's first/default one.
	// `config.colorMap` is the same idea as variantMap above, but for the per-variation
	// color to preselect (see Openmerch_Product_Meta::render_variation_fields()) - purely
	// visual, independent of which (if any) OpenMerch variant that variation maps to.
	var currentVariantId = null;
	var currentColor = null;
	// The actual WooCommerce variation post ID the customer selected - distinct from
	// `currentVariantId` above, which is the *OpenMerch* variant id it maps to (print zone
	// dimensions). This one is what `WC()->cart->add_to_cart()` needs as its 3rd argument:
	// without it, `add_to_cart()` is called with only the parent variable product id, which
	// WooCommerce always rejects ("Please choose product options...") - the parent product
	// is not itself purchasable. Simple products never set this; `add_to_cart()` already
	// ignores a falsy variation id for those.
	var currentWcVariationId = null;
	// Simple products have no attributes to select, so nothing blocks them. Variable
	// products start blocked - WooCommerce's own `found_variation`/`reset_data` events are
	// the only source of truth for "the customer has fully selected a real variation",
	// since a theme may still leave our button visible/clickable even with an incomplete
	// selection (native "Add to cart" only blocks at *submit* time via its own validation,
	// which our click handler doesn't go through at all).
	var hasSelectedVariation = ! config.isVariable;
	if ( window.jQuery ) {
		window.jQuery( document ).on( 'found_variation', '.variations_form', function ( event, variation ) {
			var variantMap = config.variantMap || {};
			var colorMap = config.colorMap || {};
			currentVariantId = ( variation && variantMap[ variation.variation_id ] ) || null;
			currentColor = ( variation && colorMap[ variation.variation_id ] ) || null;
			currentWcVariationId = ( variation && variation.variation_id ) || null;
			hasSelectedVariation = true;
			// Clears the "please select all options" message (see the click handler below)
			// the moment that becomes true again - without this it stayed on screen
			// forever after one incomplete attempt, even once the customer went back and
			// finished picking size/color.
			setMessage( '', null );
		} );
		window.jQuery( document ).on( 'reset_data hide_variation', '.variations_form', function () {
			currentVariantId = null;
			currentColor = null;
			currentWcVariationId = null;
			hasSelectedVariation = false;
		} );
	}

	var customizeButton = document.getElementById( 'openmerch-customize-button' );
	if ( customizeButton ) {
		customizeButton.addEventListener( 'click', function () {
			if ( ! hasSelectedVariation ) {
				setMessage( config.i18n && config.i18n.selectOptionsFirst, 'error' );
				return;
			}
			var editorUrl = customizeButton.getAttribute( 'data-editor-url' );
			if ( currentVariantId ) {
				editorUrl += ( editorUrl.indexOf( '?' ) === -1 ? '?' : '&' ) + 'variant=' + encodeURIComponent( currentVariantId );
			}
			if ( currentColor ) {
				editorUrl += '&color=' + encodeURIComponent( currentColor );
			}
			editorTab = window.open( editorUrl, '_blank' );
			if ( ! editorTab ) {
				setMessage( config.i18n && config.i18n.popupBlocked, 'error' );
			}
		} );
	}
} )();
