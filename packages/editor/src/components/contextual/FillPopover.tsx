import { useState } from 'react';
import { X } from 'lucide-react';

interface FillPopoverProps {
  currentColor: string;
  currentOpacity: number;
  onApply: (color: string, opacity: number) => void;
  onClear: () => void;
  onClose: () => void;
}

const QUICK_COLORS = [
  '#000000', '#FFFFFF', '#E53935', '#D81B60', '#8E24AA', '#5E35B1',
  '#3949AB', '#1E88E5', '#039BE5', '#00ACC1', '#00897B', '#43A047',
  '#7CB342', '#C0CA33', '#FDD835', '#FFB300', '#FB8C00', '#F4511E',
  '#6D4C41', '#757575', '#546E7A', '#FF6F00', '#00E676', '#2979FF',
];

export function FillPopover({ currentColor, currentOpacity, onApply, onClear, onClose }: FillPopoverProps) {
  const [color, setColor] = useState(currentColor || '#000000');
  const [opacity, setOpacity] = useState(Math.round(currentOpacity * 100));
  const [hexInput, setHexInput] = useState(currentColor || '#000000');

  const handleColorChange = (c: string) => {
    setColor(c);
    setHexInput(c);
    onApply(c, opacity / 100);
  };

  const handleHexSubmit = () => {
    const valid = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/.test(hexInput);
    if (valid) {
      setColor(hexInput);
      onApply(hexInput, opacity / 100);
    }
  };

  const handleOpacityChange = (v: number) => {
    setOpacity(v);
    onApply(color, v / 100);
  };

  const handleClear = () => {
    setColor('#000000');
    setHexInput('#000000');
    setOpacity(0);
    onClear();
  };

  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 6,
    background: '#fff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    padding: 14,
    zIndex: 100,
    width: 240,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const swatchStyle = (c: string): React.CSSProperties => ({
    width: 24,
    height: 24,
    borderRadius: 4,
    background: c,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: color === c ? '#4A90D9' : '#e0e0e0',
    cursor: 'pointer',
    boxShadow: color === c ? '0 0 0 2px rgba(74,144,217,0.3)' : 'none',
  });

  return (
    <div style={popoverStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>Fill Color</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Color picker */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <input
          type="color"
          value={color}
          onChange={(e) => handleColorChange(e.target.value)}
          style={{
            width: 40,
            height: 40,
            padding: 0,
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#ccc',
            borderRadius: 6,
            cursor: 'pointer',
            background: 'none',
          }}
        />

        {/* Hex input */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
          <span style={{ fontSize: 10, color: '#999' }}>HEX</span>
          <input
            type="text"
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            onBlur={handleHexSubmit}
            onKeyDown={(e) => { if (e.key === 'Enter') handleHexSubmit(); }}
            style={{
              padding: '4px 8px',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#ccc',
              borderRadius: 4,
              fontSize: 12,
              fontFamily: 'monospace',
            }}
          />
        </div>
      </div>

      {/* Quick colors grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(8, 1fr)', gap: 4 }}>
        {QUICK_COLORS.map((c) => (
          <div key={c} style={swatchStyle(c)} onClick={() => handleColorChange(c)} title={c} />
        ))}
      </div>

      {/* Tint opacity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666', minWidth: 50 }}>Intensity</span>
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(e) => handleOpacityChange(Number(e.target.value))}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: '#666', minWidth: 28, textAlign: 'right' }}>{opacity}%</span>
      </div>

      {/* Transparent / Clear */}
      <button
        onClick={handleClear}
        style={{
          padding: '6px 14px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#ccc',
          borderRadius: 6,
          background: '#fff',
          cursor: 'pointer',
          fontSize: 12,
          color: '#666',
        }}
      >
        Transparent (Clear Tint)
      </button>
    </div>
  );
}
