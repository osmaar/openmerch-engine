import {
  X,
  CaseSensitive,
  CaseUpper,
  CaseLower,
} from 'lucide-react';
import type { TextLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';
import { useT } from '../../i18n/useTranslation.js';

interface CasePopoverProps {
  layer: TextLayer;
  onClose: () => void;
}

export function CasePopover({ layer, onClose }: CasePopoverProps) {
  const { updateLayer } = useEditorStore();
  const t = useT();

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: 6,
    background: '#fff',
    color: '#555',
    cursor: 'pointer',
    fontSize: 12,
    width: '100%',
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
    width: 180,
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  };

  const toUpperCase = () => {
    updateLayer(layer.id, { text: layer.text.toUpperCase() });
  };

  const toLowerCase = () => {
    updateLayer(layer.id, { text: layer.text.toLowerCase() });
  };

  const toTitleCase = () => {
    const titled = layer.text.replace(
      /\w\S*/g,
      (txt) => txt.charAt(0).toUpperCase() + txt.substring(1).toLowerCase(),
    );
    updateLayer(layer.id, { text: titled });
  };

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>{t('Case')}</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      <button style={btnStyle} onClick={toUpperCase}>
        <CaseUpper size={16} /> {t('UPPERCASE')}
      </button>
      <button style={btnStyle} onClick={toLowerCase}>
        <CaseLower size={16} /> {t('lowercase')}
      </button>
      <button style={btnStyle} onClick={toTitleCase}>
        <CaseSensitive size={16} /> {t('Title Case')}
      </button>
    </div>
  );
}
