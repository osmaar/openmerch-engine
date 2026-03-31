import { Undo2, Redo2, Eye, EyeOff } from 'lucide-react';
import { useEditorStore } from '../store/editorStore.js';

export function UndoRedoControls() {
  const { undo, redo, historyIndex, history, showPrintZone } = useEditorStore();

  const canUndo = historyIndex >= 0;
  const canRedo = historyIndex + 2 < history.length;

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

  const togglePrintZone = () => {
    useEditorStore.setState({ showPrintZone: !showPrintZone });
  };

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
        style={btnStyle(canRedo)}
        onClick={() => canRedo && redo()}
        disabled={!canRedo}
        title="Redo (Ctrl+Shift+Z)"
      >
        <Redo2 size={16} />
      </button>

      <div style={{ width: 1, height: 32, background: '#e0e0e0' }} />

      <button
        style={{
          ...btnStyle(true),
          color: showPrintZone ? '#4A90D9' : '#aaa',
        }}
        onClick={togglePrintZone}
        title={showPrintZone ? 'Hide print zone guides' : 'Show print zone guides'}
      >
        {showPrintZone ? <Eye size={16} /> : <EyeOff size={16} />}
      </button>
    </div>
  );
}
