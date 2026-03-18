import { useRef } from 'react';
import { useEditorStore } from '../store/editorStore.js';

interface ToolbarProps {
  pxPerMM?: number;
}

const BTN_BASE: React.CSSProperties = {
  padding: '8px 14px',
  borderWidth: 1,
  borderStyle: 'solid',
  borderColor: '#ccc',
  borderRadius: 6,
  background: '#fff',
  cursor: 'pointer',
  fontSize: 13,
  fontWeight: 500,
  color: '#333',
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const BTN_DISABLED: React.CSSProperties = {
  ...BTN_BASE,
  color: '#bbb',
  borderColor: '#ddd',
  cursor: 'default',
};

const BTN_DELETE: React.CSSProperties = {
  ...BTN_BASE,
  color: '#e53935',
  borderColor: '#e53935',
};

export function Toolbar(_props: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    addImageLayer,
    addTextLayer,
    removeLayer,
    duplicateLayer,
    resetLayer,
    undo,
    selectedLayerId,
  } = useEditorStore();

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      addImageLayer(url, img.width, img.height);
    };
    img.src = url;

    e.target.value = '';
  };

  const has = !!selectedLayerId;

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
      <button style={BTN_BASE} onClick={handleUploadClick}>
        Upload Image
      </button>
      <button style={BTN_BASE} onClick={addTextLayer}>
        Add Text
      </button>

      <div style={{ width: 1, height: 24, background: '#ddd' }} />

      <button
        style={has ? BTN_BASE : BTN_DISABLED}
        onClick={() => selectedLayerId && duplicateLayer(selectedLayerId)}
        disabled={!has}
        title="Duplicate (Ctrl+C, Ctrl+V)"
      >
        Duplicate
      </button>
      <button
        style={has ? BTN_BASE : BTN_DISABLED}
        onClick={() => selectedLayerId && resetLayer(selectedLayerId)}
        disabled={!has}
        title="Reset position and scale"
      >
        Reset
      </button>
      <button
        style={has ? BTN_DELETE : BTN_DISABLED}
        onClick={() => selectedLayerId && removeLayer(selectedLayerId)}
        disabled={!has}
        title="Delete (Del)"
      >
        Delete
      </button>

      <div style={{ width: 1, height: 24, background: '#ddd' }} />

      <button style={BTN_BASE} onClick={undo} title="Undo (Ctrl+Z)">
        Undo
      </button>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
