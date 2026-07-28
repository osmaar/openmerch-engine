import { X, RotateCcw } from 'lucide-react';
import type { DesignLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';
import { useT } from '../../i18n/useTranslation.js';

interface TransformPopoverProps {
  layer: DesignLayer;
  onClose: () => void;
}

export function TransformPopover({ layer, onClose }: TransformPopoverProps) {
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const resetLayer = useEditorStore((s) => s.resetLayer);
  const t = useT();

  const isFlippedX = layer.scaleX < 0;
  const isFlippedY = layer.scaleY < 0;

  const handleRotation = (value: number) => {
    updateLayer(layer.id, { rotation: value });
  };

  const handleSkewX = (value: number) => {
    updateLayer(layer.id, { skewX: value });
  };

  const handleSkewY = (value: number) => {
    updateLayer(layer.id, { skewY: value });
  };

  const handleFlipX = () => {
    updateLayer(layer.id, { scaleX: layer.scaleX * -1 });
  };

  const handleFlipY = () => {
    updateLayer(layer.id, { scaleY: layer.scaleY * -1 });
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

  const toggleStyle = (active: boolean): React.CSSProperties => ({
    padding: '6px 14px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: active ? '#4A90D9' : '#ccc',
    borderRadius: 6,
    background: active ? '#EBF2FA' : '#fff',
    color: active ? '#4A90D9' : '#555',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    flex: 1,
  });

  const resetBtn: React.CSSProperties = {
    padding: '6px 14px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ccc',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 12,
    color: '#666',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  };

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{t('Transform')}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Rotate */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666', minWidth: 50 }}>{t('Rotate')}</span>
        <input
          type="range"
          min={-180}
          max={180}
          value={Math.round(layer.rotation)}
          onChange={(e) => handleRotation(Number(e.target.value))}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: '#666' }}>
          {Math.round(layer.rotation)}°
        </span>
      </div>

      {/* Skew X */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666', minWidth: 50 }}>{t('Skew X')}</span>
        <input
          type="range"
          min={-50}
          max={50}
          value={Math.round((layer.skewX ?? 0) * 100)}
          onChange={(e) => handleSkewX(Number(e.target.value) / 100)}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: '#666' }}>
          {Math.round((layer.skewX ?? 0) * 100)}
        </span>
      </div>

      {/* Skew Y */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666', minWidth: 50 }}>{t('Skew Y')}</span>
        <input
          type="range"
          min={-50}
          max={50}
          value={Math.round((layer.skewY ?? 0) * 100)}
          onChange={(e) => handleSkewY(Number(e.target.value) / 100)}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 11, color: '#666' }}>
          {Math.round((layer.skewY ?? 0) * 100)}
        </span>
      </div>

      {/* Flip toggles */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={toggleStyle(isFlippedX)} onClick={handleFlipX}>
          {t('Flip X')} {isFlippedX ? '✓' : ''}
        </button>
        <button style={toggleStyle(isFlippedY)} onClick={handleFlipY}>
          {t('Flip Y')} {isFlippedY ? '✓' : ''}
        </button>
      </div>

      {/* Reset */}
      <button style={resetBtn} onClick={() => resetLayer(layer.id)}>
        <RotateCcw size={14} /> {t('Reset All Transforms')}
      </button>
    </div>
  );
}
