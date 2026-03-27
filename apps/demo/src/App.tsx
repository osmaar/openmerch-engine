import { ProductEditor } from '@openmerch/editor';
import { tshirtProduct } from './products/tshirt.js';

export function App() {
  return (
    <ProductEditor product={tshirtProduct} />
  );
}
