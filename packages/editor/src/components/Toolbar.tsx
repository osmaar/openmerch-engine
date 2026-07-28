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

/**
 * Standalone action bar (upload image, add text, duplicate/reset/delete layer, undo).
 * Reads/writes state via `useEditorStore` directly; the `pxPerMM` prop is currently unused.
 * Not used internally by `ProductEditor` (which renders `TopToolbar` instead) — kept for custom layouts.
 */
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    // Use a temporary blob URL only to read pixel dimensions, then upload to
    // MinIO so the layer's src is a persistent URL the server can resolve.
    const blobUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      const { width, height } = img;
      URL.revokeObjectURL(blobUrl);
      try {
        const { uploadAsset } = await import('../services/api.js');
        const asset = await uploadAsset(file);
        addImageLayer(asset.url, width, height);
      } catch {
        // Fallback: keep blob URL for this session (production rendering will fail)
        addImageLayer(blobUrl, width, height);
      }
    };
    img.src = blobUrl;
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
