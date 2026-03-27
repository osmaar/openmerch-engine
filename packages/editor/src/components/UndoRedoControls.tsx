import { Undo2, Redo2 } from 'lucide-react';
import { useEditorStore } from '../store/editorStore.js';

export function UndoRedoControls() {
  const { undo, historyIndex } = useEditorStore();

  const canUndo = historyIndex >= 0;

  const btnStyle = (enabled: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderWidth: 0,
    borderRadius: 6,
    background: '#fff',
    cursor: enabled ? 'pointer' : 'default',
    color: enabled ? '#555' : '#ccc',
    padding: 0,
    boxShadow: '0 1px 4px rgba(0,0,0,0.1)',
  });

  return (
    <div
      style={{
        position: 'absolute',
        top: 12,
        right: 12,
        display: 'flex',
        gap: 4,
      }}
    >
      <button
        style={btnStyle(canUndo)}
        onClick={() => canUndo && undo()}
        disabled={!canUndo}
        title="Undo (Ctrl+Z)"
      >
        <Undo2 size={16} />
      </button>
      <button
        style={btnStyle(false)}
        disabled={true}
        title="Redo (coming soon)"
      >
        <Redo2 size={16} />
      </button>
    </div>
  );
}
