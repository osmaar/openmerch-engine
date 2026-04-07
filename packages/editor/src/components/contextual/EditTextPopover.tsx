import { useState } from 'react';
import { X } from 'lucide-react';
import type { TextLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';
import { useT } from '../../i18n/useTranslation.js';

interface EditTextPopoverProps {
  layer: TextLayer;
  onClose: () => void;
}

export function EditTextPopover({ layer, onClose }: EditTextPopoverProps) {
  const { updateLayer } = useEditorStore();
  const t = useT();
  const [text, setText] = useState(layer.text);
  const [fontSize, setFontSize] = useState(layer.fontSize);
  const [letterSpacing, setLetterSpacing] = useState(layer.letterSpacing ?? 0);
  const [lineHeight, setLineHeight] = useState(layer.lineHeight ?? 1.2);

  const handleUpdate = () => {
    updateLayer(layer.id, { text, fontSize, letterSpacing, lineHeight });
    onClose();
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
    width: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{t('Edit Text')}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t('Enter your text...')}
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
          minHeight: 60,
          boxSizing: 'border-box',
        }}
      />

      <SliderRow label={t('Size')} value={fontSize} min={8} max={120} step={1} onChange={setFontSize} />
      <SliderRow label={t('Spacing')} value={letterSpacing} min={-10} max={50} step={0.5} onChange={setLetterSpacing} />
      <SliderRow label={t('Line H.')} value={lineHeight} min={0.5} max={3} step={0.1} onChange={setLineHeight} />

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
        {t('Update Text')}
      </button>
    </div>
  );
}

function SliderRow({ label, value, min, max, step, onChange }: {
  label: string; value: number; min: number; max: number; step: number; onChange: (v: number) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{ fontSize: 12, color: '#666', minWidth: 48, flexShrink: 0 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, cursor: 'pointer', minWidth: 0 }}
      />
      <span style={{ fontSize: 11, color: '#666', minWidth: 32, textAlign: 'right', flexShrink: 0 }}>
        {Number.isInteger(value) ? value : value.toFixed(1)}
      </span>
    </div>
  );
}
