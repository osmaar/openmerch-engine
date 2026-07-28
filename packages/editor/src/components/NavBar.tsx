import { useState, useEffect, useCallback } from 'react';
import {
  Printer,
  HelpCircle,
  Globe,
  ShoppingCart,
  ArrowLeft,
  X,
  Download,
  Check,
  Loader,
  Trash2,
} from 'lucide-react';
import { exportDesign } from '../utils/exportDesign.js';
import { useEditorStore } from '../store/editorStore.js';
import type { CartItem } from '../store/editorStore.js';
import { PRODUCT_COLORS } from './sidebar/tabs/ProductTab.js';
import { useI18nStore, useT } from '../i18n/useTranslation.js';
import { MM_PER_INCH } from '@openmerch/core';

export function NavBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const t = useT();

  const toggle = (id: string) => {
    setActiveMenu(activeMenu === id ? null : id);
  };

  const close = () => setActiveMenu(null);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      height: 42,
      background: '#2c2c2c',
      color: '#ddd',
      fontSize: 13,
      paddingLeft: 12,
      paddingRight: 12,
      flexShrink: 0,
      position: 'relative',
      zIndex: 200,
    }}>
      {/* Logo / Store name */}
      <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginRight: 12, letterSpacing: 0.5 }}>
        {useEditorStore((s) => s.storeName) || 'OpenMerch'}
      </div>

      {/* Save indicator */}
      <SaveIndicator />

      {/* Left items */}
      <NavItem label={t('Print')} icon={Printer} isActive={activeMenu === 'print'} onClick={() => toggle('print')} />
      <NavItem label={t('Help')} icon={HelpCircle} isActive={activeMenu === 'help'} onClick={() => toggle('help')} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right items */}
      <NavItem label={t('Languages')} icon={Globe} isActive={activeMenu === 'lang'} onClick={() => toggle('lang')} hideLabel />
      <CartPrice />
      <CartBadge isActive={activeMenu === 'cart'} onClick={() => toggle('cart')} title={t('My Cart')} />
      <AddToCartButton onAdded={() => setActiveMenu('cart')} />
      <button
        style={{
          padding: '5px 12px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: 'rgba(255,255,255,0.3)',
          borderRadius: 4,
          background: 'transparent',
          color: '#ccc',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          marginLeft: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        onClick={() => { window.history.back(); }}
        title={t('Back to Shop')}
      >
        <ArrowLeft size={12} />
        {t('Back to Shop')}
      </button>

      {/* Dropdowns */}
      {activeMenu === 'print' && <PrintDropdown onClose={close} />}
      {activeMenu === 'help' && <HelpDropdown onClose={close} />}
      {activeMenu === 'lang' && <LanguageDropdown onClose={close} />}
      {activeMenu === 'cart' && <CartDropdown onClose={close} />}
    </div>
  );
}

function CartPrice() {
  const cartItems = useEditorStore((s) => s.cartItems);
  const total = cartItems.reduce((sum, item) => sum + item.price * item.totalUnits, 0);
  return <div style={{ padding: '0 8px', fontSize: 12, color: '#aaa' }}>${(total / 100).toFixed(2)}</div>;
}

function CartBadge({ isActive, onClick, title }: { isActive: boolean; onClick: () => void; title?: string }) {
  const totalUnits = useEditorStore((s) => s.cartItems.reduce((sum, i) => sum + i.totalUnits, 0));
  return <NavItem label={title ?? ''} icon={ShoppingCart} isActive={isActive} onClick={onClick} badge={totalUnits} hideLabel />;
}

function AddToCartButton({ onAdded }: { onAdded: () => void }) {
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'error' | 'success' } | null>(null);
  const t = useT();

  const showToast = (message: string, type: 'error' | 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // Listen for sidebar "Add to Cart" button
  const handleAddToCart = useCallback(async () => {
    const store = useEditorStore.getState();
    if (!store.design || !store.product) return;

    const totalUnits = Object.values(store.sizes).reduce((a, b) => a + b, 0);
    if (totalUnits === 0) {
      showToast(t('Select quantity in the Product tab before adding to cart.'), 'error');
      return;
    }

    const hasLayers = Object.values(store.design.zones).some((z) => z.layers.length > 0);
    if (!hasLayers) {
      showToast(t('Add at least one element to your design first.'), 'error');
      return;
    }

    setAdding(true);
    try {
      const { saveDesign, updateDesign } = await import('../services/api.js');
      const data = {
        productId: store.product.id,
        designData: store.design,
        status: 'cart',
        sizes: store.sizes,
        productColor: store.productColor,
      };

      let result;
      if (store.savedDesignId) {
        result = await updateDesign(store.savedDesignId, { ...data, status: 'cart' });
      } else {
        result = await saveDesign(data);
      }

      const productImage = store.product.zones[0]?.baseImageUrl ?? '';
      const colorEntry = PRODUCT_COLORS.find((c) => c.value === store.productColor);
      const cartItem: CartItem = {
        designId: result.id,
        productId: store.product.id,
        productName: store.product.name,
        productImage,
        sizes: { ...store.sizes },
        productColor: store.productColor,
        productColorName: colorEntry?.name ?? store.productColor,
        totalUnits,
        price: 0,
      };

      useEditorStore.setState({ savedDesignId: null });
      store.addToCart(cartItem);
      // Reset sizes based on product type
      const cats = store.product.categories ?? [];
      const hasSizes = cats.some((c: string) => ['T-Shirts', 'Hoodies'].includes(c));
      useEditorStore.setState({ sizes: hasSizes ? { S: 0, M: 0, L: 0, XL: 0, XXL: 0 } : { QTY: 1 } });

      showToast(t('Added to cart!'), 'success');
      onAdded();
    } catch (e) {
      console.error('Failed to add to cart:', e);
      showToast(t('Failed to add to cart. Please try again.'), 'error');
    } finally {
      setAdding(false);
    }
  }, [onAdded]);

  useEffect(() => {
    const handler = () => { handleAddToCart(); };
    window.addEventListener('openmerch:add-to-cart', handler);
    return () => window.removeEventListener('openmerch:add-to-cart', handler);
  }, [handleAddToCart]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        style={{
          padding: '5px 12px',
          borderWidth: 0,
          borderRadius: 4,
          background: adding ? '#888' : '#4A90D9',
          color: '#fff',
          cursor: adding ? 'default' : 'pointer',
          fontSize: 12,
          fontWeight: 500,
          marginLeft: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        onClick={handleAddToCart}
        disabled={adding}
      >
        {adding ? <Loader size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <ShoppingCart size={12} />}
        {adding ? t('Adding...') : t('Add to Cart')}
      </button>
      {toast && (
        <div style={{
          position: 'fixed',
          top: 52,
          left: '50%',
          transform: 'translateX(-50%)',
          padding: '12px 24px',
          borderRadius: 10,
          background: toast.type === 'error' ? '#c0392b' : '#27ae60',
          color: '#fff',
          fontSize: 14,
          fontWeight: 500,
          zIndex: 99999,
          boxShadow: '0 6px 20px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}>
          {toast.type === 'success' ? <Check size={16} /> : <X size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function SaveIndicator() {
  const isSaving = useEditorStore((s) => s.isSaving);
  const lastSavedAt = useEditorStore((s) => s.lastSavedAt);
  const t = useT();

  if (isSaving) {
    return <span style={{ fontSize: 10, color: '#aaa', marginRight: 8 }}>{t('Saving...')}</span>;
  }

  if (lastSavedAt) {
    const time = new Date(lastSavedAt);
    const timeStr = time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    return <span style={{ fontSize: 10, color: '#6a6' , marginRight: 8 }}>{t('Saved')} {timeStr}</span>;
  }

  return <span style={{ fontSize: 10, color: '#888', marginRight: 8 }}>{t('Ctrl+S to save')}</span>;
}

function NavItem({ label, icon: Icon, isActive, onClick, badge, hideLabel }: {
  label: string;
  icon: typeof Printer;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
  hideLabel?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        padding: '4px 10px',
        borderWidth: 0,
        borderRadius: 4,
        background: isActive ? 'rgba(255,255,255,0.1)' : 'transparent',
        color: isActive ? '#fff' : '#ccc',
        cursor: 'pointer',
        fontSize: 12,
        position: 'relative',
      }}
    >
      <Icon size={15} />
      {label && !hideLabel && <span>{label}</span>}
      {badge !== undefined && badge > 0 && (
        <span style={{
          position: 'absolute',
          top: 0,
          right: 0,
          background: '#e53935',
          color: '#fff',
          fontSize: 9,
          width: 14,
          height: 14,
          borderRadius: 7,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>{badge}</span>
      )}
    </button>
  );
}

// Dropdown wrapper
function Dropdown({ children, align = 'left', onClose }: {
  children: React.ReactNode;
  align?: 'left' | 'right';
  onClose?: () => void; // available for future use
}) {
  void onClose;
  return (
    <div
      className="navbar-dropdown"
      style={{
        position: 'absolute',
        top: 42,
        ...(align === 'left' ? { left: 0 } : { right: 0 }),
        background: '#fff',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#e0e0e0',
        borderRadius: '0 0 8px 8px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
        color: '#333',
        minWidth: 280,
        maxHeight: '70vh',
        overflowY: 'auto',
        zIndex: 300,
        scrollbarWidth: 'thin',
        scrollbarColor: '#ddd transparent',
      }}
    >
      {children}
    </div>
  );
}

function DropdownHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '10px 14px',
      borderBottomWidth: 1,
      borderBottomStyle: 'solid',
      borderBottomColor: '#eee',
    }}>
      <span style={{ fontWeight: 600, fontSize: 14 }}>{title}</span>
      <button
        onClick={onClose}
        style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
      >
        <X size={16} />
      </button>
    </div>
  );
}

// Print dropdown
function PrintDropdown({ onClose }: { onClose: () => void }) {
  const [format, setFormat] = useState<'png' | 'svg'>('png');
  const [unit, setUnit] = useState<'cm' | 'inch' | 'px'>('cm');
  const [includeBase, setIncludeBase] = useState(false);
  const hideOverflow = true;
  const [includeBack, setIncludeBack] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const t = useT();

  // Get state from store
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const product = useEditorStore((s) => s.product);
  const hasMultipleZones = (product?.zones.length ?? 0) > 1;
  const canvasLayout = useEditorStore((s) => s.canvasLayout);
  const pxPerMM = canvasLayout?.pxPerMM ?? 1;
  const widthMM = canvasLayout ? canvasLayout.printW / pxPerMM : 0;
  const heightMM = canvasLayout ? canvasLayout.printH / pxPerMM : 0;

  const formatSize = (mm: number): string => {
    switch (unit) {
      case 'cm': return (mm / 10).toFixed(1);
      case 'inch': return (mm / MM_PER_INCH).toFixed(1);
      case 'px': return Math.round(mm / MM_PER_INCH * 300).toString();
    }
  };

  const unitLabel = unit === 'px' ? 'px (300 DPI)' : unit;

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 14px',
    fontSize: 13,
  };

  return (
    <Dropdown align="left" onClose={onClose}>
      <DropdownHeader title={t('Print / Download')} onClose={onClose} />

      <div style={rowStyle}>
        <span>{t('Format')}</span>
        <div style={{ display: 'flex', gap: 4 }}>
          {(['png', 'svg'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormat(f)}
              style={{
                padding: '3px 10px',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: format === f ? '#4A90D9' : '#ddd',
                borderRadius: 4,
                background: format === f ? '#EBF2FA' : '#fff',
                color: format === f ? '#4A90D9' : '#666',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: format === f ? 600 : 400,
                textTransform: 'uppercase',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {format === 'png' && (
        <>
          <div style={rowStyle}>
            <span>{t('Print Zone')}</span>
            <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>
              {formatSize(widthMM)} x {formatSize(heightMM)} {unitLabel}
            </span>
          </div>

          <div style={rowStyle}>
            <span>{t('Unit')}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {(['cm', 'inch', 'px'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  style={{
                    padding: '3px 8px',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: unit === u ? '#4A90D9' : '#ddd',
                    borderRadius: 4,
                    background: unit === u ? '#EBF2FA' : '#fff',
                    color: unit === u ? '#4A90D9' : '#666',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <div style={rowStyle}>
        <span>{t('Include base?')}</span>
        <ToggleSwitch value={includeBase} onChange={setIncludeBase} />
      </div>

      {hasMultipleZones && (
        <div style={rowStyle}>
          <span>{activeZoneId === 'front' ? t('Include back?') : t('Include front?')}</span>
          <ToggleSwitch value={includeBack} onChange={setIncludeBack} />
        </div>
      )}

      {exportError && (
        <div style={{ padding: '6px 14px', fontSize: 11, color: '#E65100', background: '#FFF3E0' }}>
          {exportError}
        </div>
      )}

      <div style={{ padding: '10px 14px' }}>
        <button
          onClick={async () => {
            setExporting(true);
            setExportError(null);
            try {
              await exportDesign({ format, includeBase, hideOverflow, includeBack });
              onClose();
            } catch (err) {
              setExportError(err instanceof Error ? err.message : 'Export failed');
            }
            setExporting(false);
          }}
          disabled={exporting}
          style={{
            width: '100%',
            padding: '8px 14px',
            borderWidth: 0,
            borderRadius: 6,
            background: exporting ? '#999' : '#4A90D9',
            color: '#fff',
            cursor: exporting ? 'default' : 'pointer',
            fontSize: 13,
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 6,
          }}
        >
          {exporting ? (
            <>
              <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
              {t('Exporting...')}
            </>
          ) : (
            <>
              <Download size={14} />
              {t('Download')}
            </>
          )}
        </button>
      </div>
    </Dropdown>
  );
}

// Help dropdown
function HelpDropdown({ onClose }: { onClose: () => void }) {
  const t = useT();
  const shortcuts = [
    { keys: 'Delete', desc: t('Delete selected element') },
    { keys: 'Ctrl + C', desc: t('Copy selected element') },
    { keys: 'Ctrl + X', desc: t('Cut selected element') },
    { keys: 'Ctrl + V', desc: t('Paste element') },
    { keys: 'Ctrl + D', desc: t('Duplicate selected element') },
    { keys: 'Ctrl + A', desc: t('Select last element') },
    { keys: 'Ctrl + E', desc: t('Clear all elements') },
    { keys: 'Ctrl + Z', desc: t('Undo') },
    { keys: 'Ctrl+Shift+Z', desc: t('Redo') },
    { keys: 'Ctrl + S', desc: t('Save design') },
    { keys: 'Ctrl+Shift+S', desc: t('Download design (PNG)') },
    { keys: 'Ctrl + P', desc: t('Print (mockup PNG)') },
    { keys: 'Ctrl + +', desc: t('Zoom in') },
    { keys: 'Ctrl + -', desc: t('Zoom out') },
    { keys: 'Ctrl + 0', desc: t('Reset zoom') },
    { keys: '← ↑ → ↓', desc: t('Move element 1px') },
    { keys: 'Shift + arrows', desc: t('Move element 10px') },
    { keys: 'Double click', desc: t('Edit text inline') },
    { keys: 'Scroll', desc: t('Zoom in/out') },
    { keys: 'Drag canvas', desc: t('Pan (when zoomed)') },
  ];

  return (
    <Dropdown align="left" onClose={onClose}>
      <DropdownHeader title={t('Hotkeys')} onClose={onClose} />
      <div style={{ padding: '8px 14px' }}>
        {shortcuts.map((s, i) => (
          <div key={i} style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '6px 0',
            borderBottomWidth: i < shortcuts.length - 1 ? 1 : 0,
            borderBottomStyle: 'solid',
            borderBottomColor: '#f0f0f0',
            fontSize: 12,
          }}>
            <span style={{ color: '#888' }}>{s.desc}</span>
            <code style={{
              background: '#f5f5f5',
              padding: '2px 6px',
              borderRadius: 3,
              fontSize: 11,
              color: '#555',
            }}>{s.keys}</code>
          </div>
        ))}
      </div>
    </Dropdown>
  );
}

// Language dropdown
function LanguageDropdown({ onClose }: { onClose: () => void }) {
  const currentLang = useI18nStore((s) => s.currentLang);
  const availableLangs = useI18nStore((s) => s.availableLangs);
  const setLang = useI18nStore((s) => s.setLang);
  const t = useT();

  // Always include English as default
  const langs = [
    { id: 'en', name: 'English', flag: '\u{1F1FA}\u{1F1F8}' },
    ...Object.values(availableLangs).filter((l) => l.code !== 'en').map((l) => ({ id: l.code, name: l.name, flag: l.flag })),
  ];

  return (
    <Dropdown align="right" onClose={onClose}>
      <DropdownHeader title={t('Languages')} onClose={onClose} />
      <div style={{ padding: '4px 0' }}>
        {langs.map((l) => (
          <button
            key={l.id}
            onClick={() => { setLang(l.id); onClose(); }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 14px',
              borderWidth: 0,
              background: currentLang === l.id ? '#EBF2FA' : 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              color: '#333',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 18 }}>{l.flag}</span>
            <span style={{ flex: 1 }}>{l.name}</span>
            {currentLang === l.id && <Check size={14} color="#4A90D9" />}
          </button>
        ))}
        {langs.length === 1 && (
          <div style={{ padding: '8px 14px', fontSize: 11, color: '#aaa' }}>
            No additional languages enabled. Activate languages in the admin panel.
          </div>
        )}
      </div>
    </Dropdown>
  );
}

// Cart dropdown
function CartDropdown({ onClose }: { onClose: () => void }) {
  const cartItems = useEditorStore((s) => s.cartItems);
  const removeFromCart = useEditorStore((s) => s.removeFromCart);
  const [, forceUpdate] = useState(0);
  const t = useT();

  const handleRemove = async (designId: string) => {
    try {
      const { deleteDesign } = await import('../services/api.js');
      await deleteDesign(designId);
    } catch { /* design may already be deleted */ }
    removeFromCart(designId);
  };

  const updateItemQty = (designId: string, size: string, delta: number) => {
    const items = useEditorStore.getState().cartItems;
    const updated = items.map((item) => {
      if (item.designId !== designId) return item;
      const newSizes = { ...item.sizes };
      newSizes[size] = Math.max(0, (newSizes[size] ?? 0) + delta);
      const totalUnits = Object.values(newSizes).reduce((a, b) => a + b, 0);
      return { ...item, sizes: newSizes, totalUnits };
    });
    useEditorStore.setState({ cartItems: updated });
    forceUpdate((n) => n + 1);
  };

  const totalUnits = cartItems.reduce((sum, i) => sum + i.totalUnits, 0);

  return (
    <Dropdown align="right" onClose={onClose}>
      <DropdownHeader title={`${t('My Cart')} (${cartItems.length})`} onClose={onClose} />
      {cartItems.length === 0 ? (
        <div style={{ padding: '30px 14px', textAlign: 'center', color: '#aaa', fontSize: 13 }}>
          <ShoppingCart size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
          <div>{t('Your cart is empty')}</div>
          <div style={{ fontSize: 11, marginTop: 4 }}>{t('Design a product and click "Add to Cart"')}</div>
        </div>
      ) : (
        <div style={{ maxHeight: 350, overflow: 'auto' }}>
          {cartItems.map((item) => {
            const activeSizes = Object.entries(item.sizes).filter(([, q]) => q > 0);
            return activeSizes.map(([size, qty]) => (
              <div key={`${item.designId}-${size}`} style={{ padding: '10px 14px', borderBottom: '1px solid #f0f0f0', display: 'flex', alignItems: 'center', gap: 10 }}>
                {/* Product thumbnail */}
                <div style={{ width: 48, height: 48, borderRadius: 8, overflow: 'hidden', background: '#f8f8f8', border: '1px solid #eee', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {item.productImage ? (
                    <img src={item.productImage} alt={item.productName} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                  ) : (
                    <ShoppingCart size={16} color="#ccc" />
                  )}
                </div>
                {/* Name + size */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.productName}</div>
                  <div style={{ fontSize: 11, color: '#888', marginTop: 2 }}>
                    {t('Size')}: <span style={{ fontWeight: 600, color: '#555' }}>{size}</span>
                    <span title={item.productColorName} style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: item.productColor, border: '1px solid #ccc', marginLeft: 6, verticalAlign: -1, boxShadow: item.productColor === '#FFFFFF' ? 'inset 0 0 0 1px #ddd' : 'none' }} />
                  </div>
                </div>
                {/* Qty controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 0, background: '#f0f0f0', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                  <button onClick={() => updateItemQty(item.designId, size, -1)} style={{ width: 26, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>−</button>
                  <span style={{ fontSize: 12, fontWeight: 700, minWidth: 24, textAlign: 'center' }}>{qty}</span>
                  <button onClick={() => updateItemQty(item.designId, size, 1)} style={{ width: 26, height: 28, border: 'none', background: 'transparent', cursor: 'pointer', fontSize: 15, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
                </div>
                {/* Delete */}
                <button
                  onClick={() => handleRemove(item.designId)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, color: '#e74c3c', flexShrink: 0, opacity: 0.6, transition: 'opacity 0.15s' }}
                  title={t('Remove from cart')}
                  onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.6'; }}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ));
          })}
        </div>
      )}
      {/* Footer */}
      {cartItems.length > 0 && (
        <div style={{ padding: '10px 14px', borderTop: '1px solid #eee' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
            <span style={{ color: '#888' }}>Total ({totalUnits} units)</span>
            <span style={{ fontWeight: 700 }}>${(cartItems.reduce((s, i) => s + i.price * i.totalUnits, 0) / 100).toFixed(2)}</span>
          </div>
        </div>
      )}
      <div style={{ padding: '6px 14px 10px', display: 'flex', gap: 8 }}>
        <button onClick={() => { window.history.back(); }} title={t('Back to Shop')} style={{ flex: 1, padding: '8px 0', borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 12, color: '#666', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
          <ArrowLeft size={12} />
          {t('Back to Shop')}
        </button>
      </div>
    </Dropdown>
  );
}

// Toggle switch component
function ToggleSwitch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        width: 36,
        height: 20,
        borderRadius: 10,
        borderWidth: 0,
        background: value ? '#4A90D9' : '#ddd',
        cursor: 'pointer',
        position: 'relative',
        padding: 0,
        transition: 'background 0.2s',
      }}
    >
      <div style={{
        width: 16,
        height: 16,
        borderRadius: 8,
        background: '#fff',
        position: 'absolute',
        top: 2,
        left: value ? 18 : 2,
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        transition: 'left 0.2s',
      }} />
    </button>
  );
}
