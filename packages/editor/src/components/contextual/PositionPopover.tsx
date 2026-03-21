import {
  X,
  Lock,
  Unlock,
  AlignStartVertical,
  AlignEndVertical,
  AlignStartHorizontal,
  AlignCenterHorizontal,
  AlignEndHorizontal,
  Maximize,
} from 'lucide-react';
import type { DesignLayer, ImageLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';

interface PositionPopoverProps {
  layer: DesignLayer;
  zoneWidthMM: number;
  zoneHeightMM: number;
  onClose: () => void;
}

function getLayerSizeMM(layer: DesignLayer): { w: number; h: number } {
  if (layer.type === 'image') {
    const img = layer as ImageLayer;
    return {
      w: img.originalWidthMM * Math.abs(img.scaleX),
      h: img.originalHeightMM * Math.abs(img.scaleY),
    };
  }
  // For text, approximate — scale-based
  return { w: 50 * Math.abs(layer.scaleX), h: 20 * Math.abs(layer.scaleY) };
}

export function PositionPopover({ layer, zoneWidthMM, zoneHeightMM, onClose }: PositionPopoverProps) {
  const { updateLayer } = useEditorStore();

  const size = getLayerSizeMM(layer);

  const positionTo = (xAlign: 'left' | 'center' | 'right', yAlign: 'top' | 'center' | 'bottom') => {
    let x = layer.x;
    let y = layer.y;

    if (xAlign === 'left') x = 0;
    else if (xAlign === 'center') x = (zoneWidthMM - size.w) / 2;
    else if (xAlign === 'right') x = zoneWidthMM - size.w;

    if (yAlign === 'top') y = 0;
    else if (yAlign === 'center') y = (zoneHeightMM - size.h) / 2;
    else if (yAlign === 'bottom') y = zoneHeightMM - size.h;

    updateLayer(layer.id, { x, y });
  };

  const handleLock = () => {
    updateLayer(layer.id, { locked: !layer.locked });
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
    width: 200,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const iconBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 36,
    height: 36,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    color: '#555',
    padding: 0,
  };

  const lockBtn: React.CSSProperties = {
    ...iconBtn,
    borderColor: layer.locked ? '#4A90D9' : '#ddd',
    background: layer.locked ? '#EBF2FA' : '#fff',
    color: layer.locked ? '#4A90D9' : '#555',
    width: '100%',
    gap: 6,
    fontSize: 12,
  };

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>Position</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Lock toggle */}
      <button style={lockBtn} onClick={handleLock}>
        {layer.locked ? <Lock size={14} /> : <Unlock size={14} />}
        {layer.locked ? 'Unlock Position' : 'Lock Position'}
      </button>

      {/* Position grid: 3x3 + center */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 4 }}>
        <button style={iconBtn} onClick={() => positionTo('left', 'top')} title="Top Left">
          <AlignStartVertical size={16} />
        </button>
        <button style={iconBtn} onClick={() => positionTo('center', 'top')} title="Top Center">
          <AlignCenterHorizontal size={16} />
        </button>
        <button style={iconBtn} onClick={() => positionTo('right', 'top')} title="Top Right">
          <AlignEndVertical size={16} />
        </button>

        <button style={iconBtn} onClick={() => positionTo('left', 'center')} title="Center Left">
          <AlignStartHorizontal size={16} />
        </button>
        <button style={iconBtn} onClick={() => positionTo('center', 'center')} title="Center">
          <Maximize size={16} />
        </button>
        <button style={iconBtn} onClick={() => positionTo('right', 'center')} title="Center Right">
          <AlignEndHorizontal size={16} />
        </button>

        <button style={iconBtn} onClick={() => positionTo('left', 'bottom')} title="Bottom Left">
          <AlignStartVertical size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button style={iconBtn} onClick={() => positionTo('center', 'bottom')} title="Bottom Center">
          <AlignCenterHorizontal size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
        <button style={iconBtn} onClick={() => positionTo('right', 'bottom')} title="Bottom Right">
          <AlignEndVertical size={16} style={{ transform: 'rotate(180deg)' }} />
        </button>
      </div>
    </div>
  );
}
