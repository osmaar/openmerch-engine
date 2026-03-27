import {
  X,
  ArrowUp,
  ArrowDown,
  ChevronsUp,
  ChevronsDown,
} from 'lucide-react';
import { useEditorStore } from '../../store/editorStore.js';

interface ArrangePopoverProps {
  layerId: string;
  onClose: () => void;
}

export function ArrangePopover({ layerId, onClose }: ArrangePopoverProps) {
  const { moveLayerUp, moveLayerDown, design, activeZoneId } = useEditorStore();

  const zone = design?.zones[activeZoneId];
  const layers = zone?.layers ?? [];
  const idx = layers.findIndex((l) => l.id === layerId);
  const isTop = idx >= layers.length - 1;
  const isBottom = idx <= 0;

  const moveToTop = () => {
    // Move to top by repeatedly moving up
    for (let i = idx; i < layers.length - 1; i++) {
      moveLayerUp(layerId);
    }
  };

  const moveToBottom = () => {
    for (let i = idx; i > 0; i--) {
      moveLayerDown(layerId);
    }
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

  const btnStyle = (disabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: 6,
    background: '#fff',
    cursor: disabled ? 'default' : 'pointer',
    color: disabled ? '#ccc' : '#555',
    fontSize: 12,
    width: '100%',
  });

  return (
    <div style={popoverStyle}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>Arrange</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      <button style={btnStyle(isTop)} onClick={() => !isTop && moveToTop()} disabled={isTop}>
        <ChevronsUp size={16} /> Bring to Front
      </button>
      <button style={btnStyle(isTop)} onClick={() => !isTop && moveLayerUp(layerId)} disabled={isTop}>
        <ArrowUp size={16} /> Bring Forward
      </button>
      <button style={btnStyle(isBottom)} onClick={() => !isBottom && moveLayerDown(layerId)} disabled={isBottom}>
        <ArrowDown size={16} /> Send Backward
      </button>
      <button style={btnStyle(isBottom)} onClick={() => !isBottom && moveToBottom()} disabled={isBottom}>
        <ChevronsDown size={16} /> Send to Back
      </button>
    </div>
  );
}
