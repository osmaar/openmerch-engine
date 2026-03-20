import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.js';

export function useKeyboardShortcuts() {
  const { selectedLayerId, removeLayer, copyLayer, pasteLayer, undo, cutLayer } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't handle shortcuts when typing in an input
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId) {
          e.preventDefault();
          removeLayer(selectedLayerId);
        }
      }

      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'c') {
          e.preventDefault();
          copyLayer();
        }
        if (e.key === 'x') {
          e.preventDefault();
          cutLayer();
        }
        if (e.key === 'v') {
          e.preventDefault();
          pasteLayer();
        }
        if (e.key === 'z') {
          e.preventDefault();
          undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, removeLayer, copyLayer, cutLayer, pasteLayer, undo]);
}
