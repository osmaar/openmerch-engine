import { useCallback, useEffect, useState } from 'react';
import { ProductEditor, useEditorStore } from '@openmerch/editor';
import type { DesignExportMeta, Product } from '@openmerch/core';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { tshirtProduct } from './products/tshirt.js';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

/**
 * How long to wait for the host to confirm (or reject) the add-to-cart before giving up and
 * assuming success. Hosts that predate this ack (or don't implement it at all — e.g. the
 * fire-and-forget pattern still documented for Shopify in docs/integrations/shopify.md 3.2)
 * never reply, so waiting forever would strand the customer on a spinner; 12s is generous for
 * a same-tab AJAX call while still well under a customer's patience for "did this work?".
 */
const HOST_ACK_TIMEOUT_MS = 12000;

/**
 * Waits for the host tab to reply to the `openmerch:export` message just sent to it, so the
 * confirmation modal (see NavBar's ExportSuccessModal) reflects what the host's own
 * add-to-cart call actually did instead of appearing the instant the design finished
 * uploading. That gap — showing "success" before the host had a chance to run its own AJAX
 * call, then letting the customer navigate away or close this tab before it finished — was
 * the root cause of a real bug report: the customer's cart never actually updated, because
 * this page had no way to know the host's add-to-cart hadn't happened yet (or had failed).
 *
 * Resolves on `openmerch:added-to-cart`, rejects on `openmerch:add-to-cart-error`, and
 * resolves (optimistically) on timeout for hosts that don't send either — matching this
 * function's only caller, `handleExport` below, which must not regress hosts built against
 * the older one-way contract.
 */
function waitForHostAck(target: Window, parentOrigin: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      window.removeEventListener('message', onMessage);
      resolve();
    }, HOST_ACK_TIMEOUT_MS);

    function onMessage(event: MessageEvent) {
      if (event.source !== target || event.origin !== parentOrigin) return;
      if (!event.data || typeof event.data !== 'object') return;
      if (event.data.type === 'openmerch:added-to-cart') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        resolve();
      } else if (event.data.type === 'openmerch:add-to-cart-error') {
        clearTimeout(timer);
        window.removeEventListener('message', onMessage);
        reject(new Error(event.data.error || 'The store could not add this design to the cart.'));
      }
    }
    window.addEventListener('message', onMessage);
  });
}

/**
 * This app doubles as the "hosted embed page" for the iframe + postMessage
 * integration pattern (see docs/integrations/shopify.md section 3, and the
 * WooCommerce plugin plan) — a merchant's storefront loads this page inside
 * an iframe (`?product=<id>&embed=1&parentOrigin=<their-origin>`) instead of
 * visiting it directly. `parentOrigin` is supplied by whoever renders the
 * iframe (never hardcoded, never `'*'` — see the security note in the docs
 * above) since this page can be embedded by any storefront, not one fixed
 * origin. Detecting "running inside an iframe" purely via
 * `window.self !== window.top` would also be true for the query param being
 * absent/wrong, so `embed=1` is required explicitly rather than inferred.
 */
function getEmbedContext(): {
  isEmbedded: boolean; parentOrigin: string | null; source: string | null; variant: string | null; color: string | null;
} {
  const params = new URLSearchParams(window.location.search);
  const isEmbedded = params.get('embed') === '1';
  return {
    isEmbedded,
    parentOrigin: params.get('parentOrigin'),
    source: params.get('source'),
    // Which of this product's variants (size/model) the customer already picked in the
    // host storefront before opening the editor — see class-openmerch-editor-embed.php's
    // openmerch-embed.js, which appends this once WooCommerce's variation form resolves.
    variant: params.get('variant'),
    // Same mechanism, for the hex color to preselect — purely visual, independent of variant.
    color: params.get('color'),
  };
}

/** Uploads the exported design PNG so the parent storefront gets back a stable, fetchable URL
 *  (postMessage can carry a Blob, but the parent still needs a URL to attach to its own cart/
 *  order — an in-memory Blob wouldn't survive past the current page load). */
async function uploadDesignBlob(pngBlob: Blob, meta: DesignExportMeta): Promise<string> {
  const formData = new FormData();
  formData.append('file', pngBlob, meta.filename);

  const res = await fetch(`${API_BASE}/api/v1/assets/upload?category=production`, {
    method: 'POST',
    body: formData,
  });
  if (!res.ok) throw new Error(`Design upload failed: ${res.status}`);

  const asset = await res.json() as { url: string };
  return `${API_BASE}${asset.url}`;
}

interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  zones: Product['zones'];
  categories?: string[];
  variants?: Product['variants'];
  variantLabel?: string;
  active: boolean;
}

async function fetchProducts(): Promise<ProductListItem[]> {
  const res = await fetch(`${API_BASE}/api/v1/products`);
  if (!res.ok) return [];
  return res.json();
}

export function App() {
  const { setUnsplashKey } = useEditorStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [{ isEmbedded, parentOrigin, source, variant, color }] = useState(getEmbedContext);

  useEffect(() => {
    const unsplash = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (unsplash) setUnsplashKey(unsplash);
  }, [setUnsplashKey]);

  // Embedded mode's export path: upload the finished design, then hand the storefront a URL +
  // metadata via postMessage — mirrors docs/integrations/shopify.md section 3.2's handleExport.
  // The editor itself never learns the *details* of the parent's cart/checkout, only whether
  // its own add-to-cart attempt succeeded or failed (see waitForHostAck above) — hosts that
  // don't implement that ack still work exactly as before (timeout treated as success).
  //
  // Two ways a storefront can host this page: nested in an <iframe> (message target is
  // `window.parent`) or opened via `window.open()` in its own tab (message target is
  // `window.opener` — `window.parent` on a top-level tab just refers to itself). Checking
  // `window.parent !== window` first tells the two apart, since a popped-up tab with no
  // opener at all (e.g. the URL was typed directly) has neither and export silently no-ops.
  const getMessageTarget = useCallback((): Window | null => {
    if (window.parent !== window) return window.parent;
    if (window.opener) return window.opener as Window;
    return null;
  }, []);

  const handleExport = useCallback(async (pngBlob: Blob, meta: DesignExportMeta) => {
    if (!parentOrigin) {
      console.error('[embed] Cannot deliver export: parentOrigin is missing from the embed URL.');
      return;
    }
    const target = getMessageTarget();
    if (!target) {
      console.error('[embed] Cannot deliver export: no parent window or opener found.');
      return;
    }
    try {
      const designUrl = await uploadDesignBlob(pngBlob, meta);
      target.postMessage({ type: 'openmerch:export', designUrl, meta }, parentOrigin);
      // Wait for the host's own ack (see waitForHostAck above) instead of assuming success
      // the instant the message is sent — the host's add-to-cart AJAX call still has to
      // actually run, and it runs in a backgrounded/possibly-throttled tab (WooCommerce's
      // window.open() pattern) that this page has no visibility into otherwise.
      await waitForHostAck(target, parentOrigin);
      // Closing this tab automatically here (rather than leaving it to the confirmation
      // modal's "Back to store" button - see NavBar's ExportSuccessModal) would still be
      // jarring even with the ack above — the customer never gets to see a "done" state,
      // just the tab vanishing.
    } catch (err) {
      target.postMessage(
        { type: 'openmerch:export-error', error: err instanceof Error ? err.message : String(err) },
        parentOrigin,
      );
      // Re-thrown so it propagates through onExportCallback -> exportDesign -> NavBar's
      // handleAddToCart, whose catch block shows an error toast instead of the confirmation
      // modal — without this, a failed upload or a host-reported add-to-cart failure would
      // still resolve this promise normally and the customer would see a false "success".
      throw err;
    }
  }, [parentOrigin, getMessageTarget]);

  // Listen for product changes from the editor's product selector modal
  useEffect(() => {
    const unsubscribe = useEditorStore.subscribe((state) => {
      const storeProduct = state.product;
      if (storeProduct && storeProduct.id !== product?.id) {
        setProduct(storeProduct);
        localStorage.setItem('openmerch-product-slug', storeProduct.slug);
        window.history.replaceState(null, '', `?product=${storeProduct.slug}`);
      }
    });
    return unsubscribe;
  }, [product?.id]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product') || localStorage.getItem('openmerch-product-slug');

    fetchProducts()
      .then((list) => {
        const active = list.filter((p) => p.active && p.zones.length > 0);

        const pick = (item: ProductListItem): Product => ({
          id: item.id, name: item.name, slug: item.slug, zones: item.zones,
          categories: item.categories, variants: item.variants, variantLabel: item.variantLabel,
        });

        if (productId) {
          const found = active.find((p) => p.id === productId || p.slug === productId);
          if (found) {
            setProduct(pick(found));
            localStorage.setItem('openmerch-product-slug', found.slug);
          } else {
            setProduct(active[0] ? pick(active[0]) : tshirtProduct);
          }
        } else {
          setProduct(active[0] ? pick(active[0]) : tshirtProduct);
        }
      })
      .catch(() => setProduct(tshirtProduct))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#666' }}>
        Loading product...
      </div>
    );
  }

  if (!product) return null;

  return (
    <ErrorBoundary>
      <ProductEditor
        key={product.id}
        product={product}
        onExport={isEmbedded ? handleExport : undefined}
        source={source ?? undefined}
        initialVariantId={variant ?? undefined}
        initialProductColor={color && /^#[0-9a-f]{6}$/i.test(color) ? color : undefined}
      />
    </ErrorBoundary>
  );
}
