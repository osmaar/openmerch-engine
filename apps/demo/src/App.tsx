import { ProductEditor } from '@openmerch/editor';
import { tshirtProduct } from './products/tshirt.js';

export function App() {
  return (
    <div style={{ padding: 20 }}>
      <ProductEditor product={tshirtProduct} width={800} height={700} />
    </div>
  );
}
