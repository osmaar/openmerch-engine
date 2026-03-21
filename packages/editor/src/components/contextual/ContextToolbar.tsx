import { useEditorStore } from '../../store/editorStore.js';
import { ImageToolbar } from './ImageToolbar.js';
import { TextToolbar } from './TextToolbar.js';

export function ContextToolbar() {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId);
  const layer = useEditorStore((s) => s.getSelectedLayer());

  if (!selectedLayerId || !layer) return null;

  const containerStyle: React.CSSProperties = {
    padding: '6px 10px',
    background: '#fff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: 8,
    boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
    minHeight: 40,
    display: 'flex',
    alignItems: 'center',
  };

  return (
    <div style={containerStyle}>
      {layer.type === 'image' && <ImageToolbar layer={layer} />}
      {layer.type === 'text' && <TextToolbar layer={layer} />}
    </div>
  );
}
