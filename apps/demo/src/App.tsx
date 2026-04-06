import { useEffect, useState } from 'react';
import { ProductEditor, useEditorStore } from '@openmerch/editor';
import type { Product } from '@openmerch/core';
import { tshirtProduct } from './products/tshirt.js';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function fetchProduct(id: string): Promise<Product> {
  const res = await fetch(`${API_BASE}/api/v1/products/${id}`);
  if (!res.ok) throw new Error('Product not found');
  const data = await res.json();
  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    zones: data.zones as Product['zones'],
  };
}

export function App() {
  const { setUnsplashKey, setPollinationsKey } = useEditorStore();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsplash = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (unsplash) setUnsplashKey(unsplash);
    const pollinations = import.meta.env.VITE_POLLINATIONS_KEY;
    if (pollinations) setPollinationsKey(pollinations);
  }, [setUnsplashKey, setPollinationsKey]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const productId = params.get('product');

    if (productId) {
      // Load product from API by UUID
      fetchProduct(productId)
        .then((p) => setProduct(p))
        .catch(() => setError(`Product "${productId}" not found. Using default.`))
        .finally(() => setLoading(false));
    } else {
      // No product param — find first product with complete zones, fallback to hardcoded
      fetch(`${API_BASE}/api/v1/products`)
        .then((r) => r.json())
        .then((products: { id: string; name: string; slug: string; zones: Product['zones'] }[]) => {
          const valid = products.find((p) =>
            p.zones.length > 0 && p.zones[0]?.baseImageUrl
          );
          if (valid) {
            setProduct({ id: valid.id, name: valid.name, slug: valid.slug, zones: valid.zones });
          } else {
            setProduct(tshirtProduct);
          }
        })
        .catch(() => setProduct(tshirtProduct))
        .finally(() => setLoading(false));
    }
  }, []);

  // If error fetching specific product, fallback to default
  useEffect(() => {
    if (error && !product) setProduct(tshirtProduct);
  }, [error, product]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'system-ui', color: '#666' }}>
        Loading product...
      </div>
    );
  }

  if (!product) return null;

  return <ProductEditor product={product} />;
}
