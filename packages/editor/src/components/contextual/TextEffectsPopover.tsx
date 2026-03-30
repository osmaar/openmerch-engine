import { useState } from 'react';
import { X } from 'lucide-react';
import type { TextLayer, TextEffect } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';

interface TextEffectsPopoverProps {
  layer: TextLayer;
  onClose: () => void;
}

const EFFECT_TYPES: { type: TextEffect['type']; label: string; image: string }[] = [
  { type: 'none', label: 'Normal', image: '/assets/text-effects/normal.svg' },
  { type: 'curved', label: 'Curved', image: '/assets/text-effects/curved.svg' },
  { type: 'wave', label: 'Oblique', image: '/assets/text-effects/oblique.svg' },
];

export function TextEffectsPopover({ layer, onClose }: TextEffectsPopoverProps) {
  const { updateLayer } = useEditorStore();
  const currentEffect = layer.textEffect ?? { type: 'none' as const, radius: 150, spacing: 0, curve: 0, height: 0, offset: 0 };
  const [effect, setEffect] = useState<TextEffect>(currentEffect);
  const [text, setText] = useState(layer.text);

  const updateEffect = (updates: Partial<TextEffect>) => {
    const newEffect = { ...effect, ...updates };
    setEffect(newEffect);
    updateLayer(layer.id, { textEffect: newEffect });
  };

  const handleUpdate = () => {
    updateLayer(layer.id, { text, textEffect: effect });
    onClose();
  };

  const showControls = effect.type !== 'none';

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
    width: 280,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };


  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  };

  const labelStyle: React.CSSProperties = {
    fontSize: 12,
    color: '#666',
    minWidth: 55,
  };

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>Text Effects</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Text input */}
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        style={{
          width: '100%',
          padding: '8px 10px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#ccc',
          borderRadius: 6,
          fontSize: 13,
          fontFamily: layer.fontFamily,
          resize: 'vertical',
          minHeight: 40,
        }}
      />

      {/* Effect type grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        {EFFECT_TYPES.map((et) => (
          <button
            key={et.type}
            onClick={() => updateEffect({ type: et.type })}
            title={et.label}
            style={{
              padding: 4,
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: effect.type === et.type ? '#4A90D9' : '#e0e0e0',
              borderRadius: 6,
              background: effect.type === et.type ? '#EBF2FA' : '#fff',
              cursor: 'pointer',
            }}
          >
            <img src={et.image} alt={et.label} style={{ width: '100%', height: 40, objectFit: 'contain' }} />
          </button>
        ))}
      </div>

      {/* Controls — only show when effect is active */}
      {showControls && (
        <>
          <div style={rowStyle}>
            <span style={labelStyle}>Radius</span>
            <input
              type="range"
              min={50}
              max={500}
              value={effect.radius}
              onChange={(e) => updateEffect({ radius: Number(e.target.value) })}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: '#666' }}>{effect.radius}</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Spacing</span>
            <input
              type="range"
              min={-20}
              max={40}
              value={effect.spacing}
              onChange={(e) => updateEffect({ spacing: Number(e.target.value) })}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: '#666' }}>{effect.spacing}</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Curve</span>
            <input
              type="range"
              min={-100}
              max={100}
              value={effect.curve}
              onChange={(e) => updateEffect({ curve: Number(e.target.value) })}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: '#666' }}>{effect.curve}</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Height</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={effect.height}
              onChange={(e) => updateEffect({ height: Number(e.target.value) })}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: '#666' }}>{effect.height}</span>
          </div>

          <div style={rowStyle}>
            <span style={labelStyle}>Offset</span>
            <input
              type="range"
              min={-50}
              max={50}
              value={effect.offset}
              onChange={(e) => updateEffect({ offset: Number(e.target.value) })}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 11, color: '#666' }}>{effect.offset}</span>
          </div>
        </>
      )}

      <button
        onClick={handleUpdate}
        style={{
          padding: '8px 14px',
          borderWidth: 0,
          borderRadius: 6,
          background: '#4A90D9',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        Update Text
      </button>
    </div>
  );
}
