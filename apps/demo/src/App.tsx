import { useEffect, useState } from 'react';
import { ProductEditor, useEditorStore } from '@openmerch/editor';
import type { Product } from '@openmerch/core';
import { ErrorBoundary } from './components/ErrorBoundary.js';
import { tshirtProduct } from './products/tshirt.js';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

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
  const { setUnsplashKey, setPollinationsKey } = useEditorStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsplash = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (unsplash) setUnsplashKey(unsplash);
    const pollinations = import.meta.env.VITE_POLLINATIONS_KEY;
    if (pollinations) setPollinationsKey(pollinations);
  }, [setUnsplashKey, setPollinationsKey]);

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
      <ProductEditor key={product.id} product={product} />
    </ErrorBoundary>
  );
}
