import { useState, useEffect } from 'react';
import { ShoppingBag, ShoppingCart, Minus, Plus, X, Loader } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';
import type { Product } from '@openmerch/core';
import { getBaseUrl } from '../../../services/api.js';

const API_BASE = getBaseUrl();

export const PRODUCT_COLORS = [
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

/** Gets sizes (S/M/L/XL) AND color picker */
const SIZED_CATEGORIES = ['T-Shirts', 'Hoodies'];
/** Gets color picker but NO sizes (one-size products) */
const COLOR_ONLY_CATEGORIES = ['Caps'];

interface ProductListItem {
  id: string;
  name: string;
  slug: string;
  zones: Product['zones'];
  variants?: Product['variants'];
  variantLabel?: string;
  active: boolean;
  categories: string[];
}

function hasSizes(product: Product): boolean {
  return (product.categories ?? []).some((c) => SIZED_CATEGORIES.includes(c));
}

function hasColor(product: Product): boolean {
  const cats = product.categories ?? [];
  return cats.some((c) => SIZED_CATEGORIES.includes(c) || COLOR_ONLY_CATEGORIES.includes(c));
}

export function ProductTab() {
  const t = useT();
  const product = useEditorStore((s) => s.product);
  const productColor = useEditorStore((s) => s.productColor);
  const colorLocked = useEditorStore((s) => s.colorLocked);
  const setProductColor = useEditorStore((s) => s.setProductColor);
  const sizes = useEditorStore((s) => s.sizes);
  const setSizeQuantity = useEditorStore((s) => s.setSizeQuantity);
  const setProduct = useEditorStore((s) => s.setProduct);
  const setVariant = useEditorStore((s) => s.setVariant);
  const selectedVariantId = useEditorStore((s) => s.selectedVariantId);
  // When embedded in a host storefront (WooCommerce/Shopify), the product was
  // deep-linked from that store's own product page — switching to a different
  // OpenMerch product here would break the mapping back to it, so the
  // switcher is hidden entirely, same as Lumise's own WooCommerce editor page.
  const isLockedToHost = useEditorStore((s) => !!s.onExportCallback);
  const [showModal, setShowModal] = useState(false);

  if (!product) return null;

  const hasVariants = !!(product.variants && product.variants.length > 0);
  const showSizes = hasSizes(product);
  const showColor = hasColor(product);
  const variantLabel = t(product.variantLabel ?? 'Variant');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t(product.name)}</div>

      {!isLockedToHost && (
        <button
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            padding: '8px 14px', borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd',
            borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666',
          }}
          onClick={() => setShowModal(true)}
        >
          <ShoppingBag size={14} />
          {t('Change Product')}
        </button>
      )}

      {showModal && (
        <ProductSelectorModal
          currentProductId={product.id}
          onSelect={(p) => { setProduct(p); setShowModal(false); }}
          onClose={() => setShowModal(false)}
        />
      )}

      {/* Variant selector — for products with variants (devices, dimensions, etc.). Locked
          (read-only) when embedded: the host storefront already told us which variant via
          `initialVariantId` (see ProductEditor/App.tsx) - letting the customer switch to a
          different one here would silently change the print zone dimensions to something
          that no longer matches what they picked (and paid for) on the storefront. */}
      {hasVariants && (
        isLockedToHost ? (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{variantLabel}</div>
            <div style={{ fontSize: 13, fontWeight: 500, color: '#333' }}>
              {t(product.variants!.find((v) => v.id === selectedVariantId)?.name ?? '')}
            </div>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{variantLabel}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {product.variants!.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setVariant(v.id)}
                  style={{
                    padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                    borderWidth: 2, borderStyle: 'solid',
                    borderColor: selectedVariantId === v.id ? '#4A90D9' : '#e0e0e0',
                    background: selectedVariantId === v.id ? '#EBF2FA' : '#fff',
                    color: selectedVariantId === v.id ? '#4A90D9' : '#555',
                  }}
                >
                  {t(v.name)}
                </button>
              ))}
            </div>
          </div>
        )
      )}

      {/* Product color — clothing + caps. Locked (read-only swatch) only when the host
          storefront actually configured a color for the variation the customer picked
          (see ProductEditor's `initialProductColor` prop) - if it didn't, the customer
          keeps full freedom to choose one here, unlike the product/variant locks above. */}
      {showColor && <div>
        <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{t('Product Color')}</div>
        {colorLocked ? (
          <div style={{
            width: 30, height: 30, borderRadius: 6, background: productColor,
            borderWidth: 2, borderStyle: 'solid', borderColor: '#4A90D9',
          }} />
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 6 }}>
            {PRODUCT_COLORS.map((c) => (
              <button
                key={c.value}
                onClick={() => setProductColor(c.value)}
                title={t(c.name)}
                style={{
                  width: 30, height: 30, borderRadius: 6, background: c.value,
                  borderWidth: 2, borderStyle: 'solid',
                  borderColor: productColor === c.value ? '#4A90D9' : '#ddd',
                  cursor: 'pointer',
                  boxShadow: productColor === c.value ? '0 0 0 2px rgba(74,144,217,0.3)' : 'none',
                }}
              />
            ))}
          </div>
        )}
      </div>}

      {/* Quantity — clothing gets sizes, others get simple quantity. This is OpenMerch's
          own checkout model (buy one design across several sizes/quantities at once) -
          when embedded, the customer already picked one exact size/quantity in the host
          storefront's own form before ever clicking Customize, so asking again here would
          be redundant at best and confusing at worst (nothing here is sent anywhere; the
          host's own quantity is what actually gets ordered). */}
      {!isLockedToHost && (showSizes ? (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{t('Quantity by size')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {Object.entries(sizes).map(([size, qty]) => (
              <div key={size} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: '#555', minWidth: 30 }}>{size}</span>
                <QuantityControl value={qty} onChange={(v) => setSizeQuantity(size, v)} />
              </div>
            ))}
          </div>
          <div style={{ fontSize: 11, color: '#595959', marginTop: 4 }}>
            {t('Total')}: {Object.values(sizes).reduce((a, b) => a + b, 0)} {t('units')}
          </div>
        </div>
      ) : (
        <div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>{t('Quantity')}</div>
          <QuantityControl value={sizes['QTY'] ?? 1} onChange={(v) => setSizeQuantity('QTY', v)} />
        </div>
      ))}

      <button
        onClick={() => window.dispatchEvent(new CustomEvent('openmerch:add-to-cart'))}
        style={{
          width: '100%', padding: '10px 0', borderWidth: 0, borderRadius: 8,
          background: '#4A90D9', color: '#fff', cursor: 'pointer',
          fontSize: 13, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
        }}
      >
        <ShoppingCart size={14} />
        {t('Add to Cart')}
      </button>
    </div>
  );
}

function QuantityControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button onClick={() => onChange(Math.max(0, value - 1))} style={qtyBtnStyle}><Minus size={12} /></button>
      <span style={{ fontSize: 13, fontWeight: 500, color: '#333', minWidth: 20, textAlign: 'center' }}>{value}</span>
      <button onClick={() => onChange(value + 1)} style={qtyBtnStyle}><Plus size={12} /></button>
    </div>
  );
}

const qtyBtnStyle: React.CSSProperties = {
  width: 24, height: 24, borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd',
  borderRadius: 4, background: '#fff', cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#888', padding: 0,
};

// ── Product Selector Modal ──────────────────────────────────────────────────

function ProductSelectorModal({ currentProductId, onSelect, onClose }: {
  currentProductId: string;
  onSelect: (product: Product) => void;
  onClose: () => void;
}) {
  const t = useT();
  const [products, setProducts] = useState<ProductListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/products`)
      .then((r) => r.json())
      .then((data: ProductListItem[]) => {
        setProducts(data.filter((p) => p.active && p.zones.length > 0));
      })
      .catch(() => setProducts([]))
      .finally(() => setLoading(false));
  }, []);

  const categories = [...new Set(products.flatMap((p) => p.categories ?? []))];
  const filtered = filter ? products.filter((p) => (p.categories ?? []).includes(filter)) : products;

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#fff', borderRadius: 12, width: 680, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#eee' }}>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: '#333' }}>{t('Select Product')}</div>
            <div style={{ fontSize: 12, color: '#595959', marginTop: 2 }}>{products.length} {t('products available')}</div>
          </div>
          <button onClick={onClose} style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 4 }}>
            <X size={20} />
          </button>
        </div>

        {categories.length > 1 && (
          <div style={{ padding: '10px 20px', display: 'flex', gap: 6, flexWrap: 'wrap', borderBottomWidth: 1, borderBottomStyle: 'solid', borderBottomColor: '#eee' }}>
            <ChipButton active={!filter} onClick={() => setFilter('')}>{t('All')}</ChipButton>
            {categories.map((cat) => (
              <ChipButton key={cat} active={filter === cat} onClick={() => setFilter(cat)}>{t(cat)}</ChipButton>
            ))}
          </div>
        )}

        <div style={{ padding: 20, overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
              <Loader size={24} color="#aaa" style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {filtered.map((p) => {
                const isActive = p.id === currentProductId;
                const imgUrl = p.zones[0]?.baseImageUrl ?? '';
                const resolvedImg = imgUrl.startsWith('/') ? `${API_BASE}${imgUrl}` : imgUrl;
                return (
                  <button
                    key={p.id}
                    onClick={() => onSelect({ id: p.id, name: p.name, slug: p.slug, zones: p.zones, variants: p.variants, variantLabel: p.variantLabel, categories: p.categories })}
                    style={{
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
                      padding: 12, borderWidth: 2, borderStyle: 'solid',
                      borderColor: isActive ? '#4A90D9' : '#eee',
                      borderRadius: 10, background: isActive ? '#EBF2FA' : '#fff',
                      cursor: isActive ? 'default' : 'pointer',
                    }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1', borderRadius: 8, overflow: 'hidden', background: '#f5f5f5', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <img src={resolvedImg} alt={p.name} style={{ width: '85%', height: '85%', objectFit: 'contain' }} loading="lazy" />
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 500, color: isActive ? '#4A90D9' : '#333', textAlign: 'center' }}>
                      {t(p.name)}
                    </div>
                    {isActive && <div style={{ fontSize: 10, color: '#4A90D9', fontWeight: 600 }}>{t('Current')}</div>}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ChipButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 500, cursor: 'pointer',
        borderWidth: 1, borderStyle: 'solid',
        borderColor: active ? '#4A90D9' : '#ddd',
        background: active ? '#EBF2FA' : '#fff',
        color: active ? '#4A90D9' : '#666',
      }}
    >
      {children}
    </button>
  );
}
