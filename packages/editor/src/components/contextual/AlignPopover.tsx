import {
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
} from 'lucide-react';
import type { TextLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';
import { useT } from '../../i18n/useTranslation.js';

interface AlignPopoverProps {
  layer: TextLayer;
  onClose: () => void;
}

export function AlignPopover({ layer, onClose }: AlignPopoverProps) {
  const { updateLayer } = useEditorStore();
  const t = useT();

  const btnStyle = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: active ? '#4A90D9' : '#e0e0e0',
    borderRadius: 6,
    background: active ? '#EBF2FA' : '#fff',
    color: active ? '#4A90D9' : '#555',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    width: '100%',
  });

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
    width: 160,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{t('Align')}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      <button style={btnStyle(layer.align === 'left')} onClick={() => updateLayer(layer.id, { align: 'left' })}>
        <AlignLeft size={16} /> {t('Left')}
      </button>
      <button style={btnStyle(layer.align === 'center')} onClick={() => updateLayer(layer.id, { align: 'center' })}>
        <AlignCenter size={16} /> {t('Center')}
      </button>
      <button style={btnStyle(layer.align === 'right')} onClick={() => updateLayer(layer.id, { align: 'right' })}>
        <AlignRight size={16} /> {t('Right')}
      </button>
    </div>
  );
}
