import { useRef, useState } from 'react';
import {
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Trash2,
  ImageIcon,
  Type,
  Square,
  GripVertical,
} from 'lucide-react';
import type { DesignLayer } from '@openmerch/core';
import { useEditorStore } from '../../../store/editorStore.js';

function getLayerIcon(layer: DesignLayer) {
  switch (layer.type) {
    case 'image': return ImageIcon;
    case 'text': return Type;
    case 'shape': return Square;
  }
}

function getLayerLabel(layer: DesignLayer): string {
  switch (layer.type) {
    case 'image': return 'Image';
    case 'text': return layer.text.substring(0, 18) || 'Text';
    case 'shape': return layer.shapeType;
  }
}

export function LayersTab() {
  const design = useEditorStore((s) => s.design);
  const activeZoneId = useEditorStore((s) => s.activeZoneId);
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const { selectLayer, updateLayer, removeLayer, moveLayerUp, moveLayerDown } = useEditorStore();

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const dragCounter = useRef(0);

  const zone = design?.zones[activeZoneId];
  const layers = zone?.layers ?? [];
  const reversedLayers = [...layers].reverse();

  const handleDragStart = (layerId: string, locked: boolean) => {
    if (locked) return;
    setDraggedId(layerId);
  };

  const handleDragOver = (e: React.DragEvent, layerId: string) => {
    e.preventDefault();
    setDragOverId(layerId);
  };

  const handleDragEnter = () => { dragCounter.current++; };

  const handleDragLeave = () => {
    dragCounter.current--;
    if (dragCounter.current <= 0) { setDragOverId(null); dragCounter.current = 0; }
  };

  const handleDrop = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null); setDragOverId(null); return;
    }
    const fromIdx = layers.findIndex((l) => l.id === draggedId);
    const toIdx = layers.findIndex((l) => l.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;
    if (fromIdx < toIdx) {
      for (let i = fromIdx; i < toIdx; i++) moveLayerUp(draggedId);
    } else {
      for (let i = fromIdx; i > toIdx; i--) moveLayerDown(draggedId);
    }
    setDraggedId(null); setDragOverId(null);
  };

  const handleDragEnd = () => {
    setDraggedId(null); setDragOverId(null); dragCounter.current = 0;
  };

  const startRename = (layer: DesignLayer) => {
    setEditingId(layer.id);
    setEditName(getLayerLabel(layer));
  };

  const finishRename = (layerId: string) => {
    if (editName.trim()) {
      const layer = layers.find((l) => l.id === layerId);
      if (layer?.type === 'text') {
        updateLayer(layerId, { text: editName.trim() });
      }
      // For images we could add a custom name field later
    }
    setEditingId(null);
  };

  if (layers.length === 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>Layers</div>
        <div style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', height: 120, color: '#aaa', fontSize: 12, gap: 8,
        }}>
          <span>No layers yet</span>
          <span style={{ fontSize: 11, color: '#ccc' }}>Add an image or text to start</span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>
        Layers ({layers.length})
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {reversedLayers.map((layer) => {
          const Icon = getLayerIcon(layer);
          const isSelected = selectedLayerId === layer.id;
          const isDragging = draggedId === layer.id;
          const isDragOver = dragOverId === layer.id && draggedId !== layer.id;
          const isEditing = editingId === layer.id;
          const isLocked = layer.locked;

          return (
            <div
              key={layer.id}
              draggable={!isLocked}
              onDragStart={() => handleDragStart(layer.id, isLocked)}
              onDragOver={(e) => handleDragOver(e, layer.id)}
              onDragEnter={handleDragEnter}
              onDragLeave={handleDragLeave}
              onDrop={() => handleDrop(layer.id)}
              onDragEnd={handleDragEnd}
              onClick={() => !isLocked && selectLayer(layer.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 6px',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: isDragOver ? '#4A90D9' : isSelected ? '#4A90D9' : '#e8e8e8',
                borderTopWidth: isDragOver ? 3 : 1,
                borderTopColor: isDragOver ? '#4A90D9' : isSelected ? '#4A90D9' : '#e8e8e8',
                borderRadius: 6,
                background: isSelected ? '#EBF2FA' : isDragging ? '#f8f8f8' : '#fff',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isDragging ? 0.5 : layer.visible ? 1 : 0.4,
                transition: 'border-color 0.1s',
              }}
            >
              {/* Drag handle */}
              <GripVertical
                size={12}
                color={isLocked ? '#e0e0e0' : '#ccc'}
                style={{ cursor: isLocked ? 'not-allowed' : 'grab', flexShrink: 0 }}
              />

              {/* Layer icon */}
              <Icon size={13} color={isSelected ? '#4A90D9' : '#888'} style={{ flexShrink: 0 }} />

              {/* Layer name — click to edit for text layers */}
              {isEditing ? (
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onBlur={() => finishRename(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') finishRename(layer.id);
                    if (e.key === 'Escape') setEditingId(null);
                  }}
                  autoFocus
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    flex: 1,
                    fontSize: 11,
                    padding: '1px 4px',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: '#4A90D9',
                    borderRadius: 3,
                    outline: 'none',
                    minWidth: 0,
                  }}
                />
              ) : (
                <span
                  onDoubleClick={(e) => { e.stopPropagation(); startRename(layer); }}
                  title="Double-click to rename"
                  style={{
                    flex: 1,
                    fontSize: 11,
                    color: isSelected ? '#4A90D9' : '#555',
                    fontWeight: isSelected ? 500 : 400,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    cursor: 'text',
                  }}
                >
                  {getLayerLabel(layer)}
                </span>
              )}

              {/* Visibility — disabled when locked */}
              <button
                style={iconBtnStyle(false, isLocked)}
                title={isLocked ? 'Locked' : layer.visible ? 'Hide' : 'Show'}
                onClick={(e) => { e.stopPropagation(); if (!isLocked) updateLayer(layer.id, { visible: !layer.visible }); }}
                disabled={isLocked}
              >
                {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
              </button>

              {/* Lock — always enabled */}
              <button
                style={iconBtnStyle(layer.locked, false)}
                title={layer.locked ? 'Unlock' : 'Lock'}
                onClick={(e) => { e.stopPropagation(); updateLayer(layer.id, { locked: !layer.locked }); }}
              >
                {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
              </button>

              {/* Delete — disabled when locked */}
              <button
                style={{ ...iconBtnStyle(false, isLocked), color: isLocked ? '#e0e0e0' : '#e53935' }}
                title={isLocked ? 'Locked' : 'Delete'}
                onClick={(e) => { e.stopPropagation(); if (!isLocked) removeLayer(layer.id); }}
                disabled={isLocked}
              >
                <Trash2 size={11} />
              </button>
            </div>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center', marginTop: 4 }}>
        Drag to reorder · Double-click to rename
      </div>
    </div>
  );
}

function iconBtnStyle(active?: boolean, disabled?: boolean): React.CSSProperties {
  return {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 20,
    height: 20,
    borderWidth: 0,
    borderRadius: 3,
    background: 'transparent',
    cursor: disabled ? 'not-allowed' : 'pointer',
    color: disabled ? '#e0e0e0' : active ? '#4A90D9' : '#bbb',
    padding: 0,
    flexShrink: 0,
    opacity: disabled ? 0.5 : 1,
  };
}
