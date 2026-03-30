import { ShoppingBag, Minus, Plus } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';

const PRODUCT_COLORS = [
  { name: 'White', value: '#FFFFFF' },
  { name: 'Black', value: '#222222' },
  { name: 'Navy', value: '#1B2A4A' },
  { name: 'Red', value: '#C62828' },
  { name: 'Royal Blue', value: '#1565C0' },
  { name: 'Forest Green', value: '#2E7D32' },
  { name: 'Gray', value: '#757575' },
  { name: 'Yellow', value: '#F9A825' },
  { name: 'Orange', value: '#E65100' },
  { name: 'Pink', value: '#EC407A' },
  { name: 'Purple', value: '#7B1FA2' },
  { name: 'Brown', value: '#5D4037' },
];

export function ProductTab() {
  const { product, productColor, setProductColor, sizes, setSizeQuantity } = useEditorStore();

  if (!product) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{product.name}</div>

      <button
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: '8px 14px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#ddd',
          borderRadius: 6,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 12,
          color: '#666',
        }}
        onClick={() => {}}
        title="Coming soon — requires product catalog"
      >
        <ShoppingBag size={14} />
        Change Product
      </button>

      {/* Product color */}
      <div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Product color</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
          {PRODUCT_COLORS.map((c) => (
            <button
              key={c.value}
              onClick={() => setProductColor(c.value)}
              title={c.name}
              style={{
                width: 30,
                height: 30,
                borderRadius: 6,
                background: c.value,
                borderWidth: 2,
                borderStyle: 'solid',
                borderColor: productColor === c.value ? '#4A90D9' : '#ddd',
                cursor: 'pointer',
                boxShadow: productColor === c.value ? '0 0 0 2px rgba(74,144,217,0.3)' : 'none',
              }}
            />
          ))}
        </div>
      </div>

      {/* Quantity / Sizes */}
      <div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>Quantity by size</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {Object.entries(sizes).map(([size, qty]) => (
            <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#555', minWidth: 30 }}>{size}</span>
              <button
                onClick={() => setSizeQuantity(size, qty - 1)}
                style={{
                  width: 24, height: 24,
                  borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 4,
                  background: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#888', padding: 0,
                }}
              >
                <Minus size={12} />
              </button>
              <span style={{ fontSize: 13, fontWeight: 500, color: '#333', minWidth: 20, textAlign: 'center' }}>{qty}</span>
              <button
                onClick={() => setSizeQuantity(size, qty + 1)}
                style={{
                  width: 24, height: 24,
                  borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 4,
                  background: '#fff', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: '#888', padding: 0,
                }}
              >
                <Plus size={12} />
              </button>
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, color: '#aaa', marginTop: 4 }}>
          Total: {Object.values(sizes).reduce((a, b) => a + b, 0)} units
        </div>
      </div>
    </div>
  );
}
