import { useEffect } from 'react';
import { ProductEditor, useEditorStore } from '@openmerch/editor';
import { tshirtProduct } from './products/tshirt.js';

export function App() {
  const { setUnsplashKey, setPollinationsKey } = useEditorStore();

  useEffect(() => {
    const unsplash = import.meta.env.VITE_UNSPLASH_ACCESS_KEY;
    if (unsplash) setUnsplashKey(unsplash);
    const pollinations = import.meta.env.VITE_POLLINATIONS_KEY;
    if (pollinations) setPollinationsKey(pollinations);
  }, [setUnsplashKey, setPollinationsKey]);

  return (
    <ProductEditor product={tshirtProduct} />
  );
}
