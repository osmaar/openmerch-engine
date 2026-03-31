import { useState } from 'react';
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
} from 'lucide-react';
import { exportDesign } from '../utils/exportDesign.js';
import { useEditorStore } from '../store/editorStore.js';

export function NavBar() {
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

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
      {/* Logo */}
      <div style={{ fontWeight: 700, fontSize: 15, color: '#fff', marginRight: 20, letterSpacing: 0.5 }}>
        OpenMerch
      </div>

      {/* Left items */}
      <NavItem label="Print" icon={Printer} isActive={activeMenu === 'print'} onClick={() => toggle('print')} />
      <NavItem label="Help" icon={HelpCircle} isActive={activeMenu === 'help'} onClick={() => toggle('help')} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Right items */}
      <NavItem label="" icon={Globe} isActive={activeMenu === 'lang'} onClick={() => toggle('lang')} />
      <div style={{ padding: '0 8px', fontSize: 12, color: '#aaa' }}>$0.00</div>
      <NavItem label="" icon={ShoppingCart} isActive={activeMenu === 'cart'} onClick={() => toggle('cart')} badge={0} />
      <button
        style={{
          padding: '5px 12px',
          borderWidth: 0,
          borderRadius: 4,
          background: '#4A90D9',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 12,
          fontWeight: 500,
          marginLeft: 8,
          display: 'flex',
          alignItems: 'center',
          gap: 4,
        }}
        onClick={() => {}}
        title="Coming soon — requires backend"
      >
        Add to Cart
      </button>
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
        title="Back to Shop"
      >
        <ArrowLeft size={12} />
        Back to Shop
      </button>

      {/* Dropdowns */}
      {activeMenu === 'print' && <PrintDropdown onClose={close} />}
      {activeMenu === 'help' && <HelpDropdown onClose={close} />}
      {activeMenu === 'lang' && <LanguageDropdown onClose={close} />}
      {activeMenu === 'cart' && <CartDropdown onClose={close} />}
    </div>
  );
}

function NavItem({ label, icon: Icon, isActive, onClick, badge }: {
  label: string;
  icon: typeof Printer;
  isActive: boolean;
  onClick: () => void;
  badge?: number;
}) {
  return (
    <button
      onClick={onClick}
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
      {label && <span>{label}</span>}
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

  // Get state from store
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const canvasLayout = useEditorStore((s) => s.canvasLayout);
  const pxPerMM = canvasLayout?.pxPerMM ?? 1;
  const widthMM = canvasLayout ? canvasLayout.printW / pxPerMM : 0;
  const heightMM = canvasLayout ? canvasLayout.printH / pxPerMM : 0;

  const formatSize = (mm: number): string => {
    switch (unit) {
      case 'cm': return (mm / 10).toFixed(1);
      case 'inch': return (mm / 25.4).toFixed(1);
      case 'px': return Math.round(mm / 25.4 * 300).toString();
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
      <DropdownHeader title="Print / Download" onClose={onClose} />

      <div style={rowStyle}>
        <span>Format</span>
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
            <span>Size</span>
            <span style={{ fontSize: 12, color: '#333', fontWeight: 500 }}>
              {formatSize(widthMM)} x {formatSize(heightMM)} {unitLabel}
            </span>
          </div>

          <div style={rowStyle}>
            <span>Unit</span>
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
        <span>Include base?</span>
        <ToggleSwitch value={includeBase} onChange={setIncludeBase} />
      </div>

      <div style={rowStyle}>
        <span>Include {activeZoneId === 'front' ? 'back' : 'front'}?</span>
        <ToggleSwitch value={includeBack} onChange={setIncludeBack} />
      </div>

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
              Exporting...
            </>
          ) : (
            <>
              <Download size={14} />
              Download
            </>
          )}
        </button>
      </div>
    </Dropdown>
  );
}

// Help dropdown
function HelpDropdown({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { keys: 'Delete', desc: 'Delete selected element' },
    { keys: 'Ctrl + C', desc: 'Copy selected element' },
    { keys: 'Ctrl + X', desc: 'Cut selected element' },
    { keys: 'Ctrl + V', desc: 'Paste element' },
    { keys: 'Ctrl + D', desc: 'Duplicate selected element' },
    { keys: 'Ctrl + A', desc: 'Select last element' },
    { keys: 'Ctrl + E', desc: 'Clear all elements' },
    { keys: 'Ctrl + Z', desc: 'Undo' },
    { keys: 'Ctrl+Shift+Z', desc: 'Redo' },
    { keys: 'Ctrl + S', desc: 'Save design' },
    { keys: 'Ctrl+Shift+S', desc: 'Download design (PNG)' },
    { keys: 'Ctrl + P', desc: 'Print (mockup PNG)' },
    { keys: 'Ctrl + +', desc: 'Zoom in' },
    { keys: 'Ctrl + -', desc: 'Zoom out' },
    { keys: 'Ctrl + 0', desc: 'Reset zoom' },
    { keys: '← ↑ → ↓', desc: 'Move element 1px' },
    { keys: 'Shift + arrows', desc: 'Move element 10px' },
    { keys: 'Double click', desc: 'Edit text inline' },
    { keys: 'Scroll', desc: 'Zoom in/out' },
    { keys: 'Drag canvas', desc: 'Pan (when zoomed)' },
  ];

  return (
    <Dropdown align="left" onClose={onClose}>
      <DropdownHeader title="Hotkeys" onClose={onClose} />
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
  const [lang, setLang] = useState('en');
  const langs = [
    { id: 'en', name: 'English', flag: '🇺🇸' },
    { id: 'es', name: 'Español', flag: '🇪🇸' },
    { id: 'pt', name: 'Português', flag: '🇧🇷' },
    { id: 'fr', name: 'Français', flag: '🇫🇷' },
  ];

  return (
    <Dropdown align="right" onClose={onClose}>
      <DropdownHeader title="Languages" onClose={onClose} />
      <div style={{ padding: '4px 0' }}>
        {langs.map((l) => (
          <button
            key={l.id}
            onClick={() => setLang(l.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '8px 14px',
              borderWidth: 0,
              background: lang === l.id ? '#EBF2FA' : 'transparent',
              cursor: 'pointer',
              fontSize: 13,
              color: '#333',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 18 }}>{l.flag}</span>
            <span style={{ flex: 1 }}>{l.name}</span>
            {lang === l.id && <Check size={14} color="#4A90D9" />}
          </button>
        ))}
      </div>
    </Dropdown>
  );
}

// Cart dropdown
function CartDropdown({ onClose }: { onClose: () => void }) {
  return (
    <Dropdown align="right" onClose={onClose}>
      <DropdownHeader title="My Cart" onClose={onClose} />
      <div style={{
        padding: '30px 14px',
        textAlign: 'center',
        color: '#aaa',
        fontSize: 13,
      }}>
        <ShoppingCart size={32} style={{ opacity: 0.3, marginBottom: 8 }} />
        <div>Your cart is empty</div>
      </div>
      <div style={{ padding: '10px 14px', display: 'flex', gap: 8 }}>
        <button
          onClick={() => {}}
          style={{
            flex: 1,
            padding: '8px 0',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#ddd',
            borderRadius: 6,
            background: '#fff',
            cursor: 'pointer',
            fontSize: 12,
            color: '#666',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
          }}
        >
          <ArrowLeft size={12} />
          Back to Shop
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
