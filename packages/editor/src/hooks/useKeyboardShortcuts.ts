import { useEffect } from 'react';
import { useEditorStore } from '../store/editorStore.js';
import { exportDesign } from '../utils/exportDesign.js';

export function useKeyboardShortcuts() {
  const {
    selectedLayerId,
    removeLayer,
    copyLayer,
    pasteLayer,
    undo,
    cutLayer,
    duplicateLayer,
    updateLayer,
    selectLayer,
  } = useEditorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return;

      const ctrl = e.ctrlKey || e.metaKey;
      const shift = e.shiftKey;

      // Delete selected element
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerId) {
          e.preventDefault();
          removeLayer(selectedLayerId);
        }
        return;
      }

      // Arrow keys — move selected element
      if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
        if (selectedLayerId && !ctrl) {
          e.preventDefault();
          const store = useEditorStore.getState();
          const zone = store.design?.zones[store.activeZoneId];
          const layer = zone?.layers.find((l) => l.id === selectedLayerId);
          if (!layer || layer.locked) return;

          const step = shift ? 10 : 1; // 10px with shift, 1px without
          const pxPerMM = store.canvasLayout?.pxPerMM ?? 1;
          const mmStep = step / pxPerMM;

          let dx = 0;
          let dy = 0;
          if (e.key === 'ArrowLeft') dx = -mmStep;
          if (e.key === 'ArrowRight') dx = mmStep;
          if (e.key === 'ArrowUp') dy = -mmStep;
          if (e.key === 'ArrowDown') dy = mmStep;

          updateLayer(selectedLayerId, { x: layer.x + dx, y: layer.y + dy });
          return;
        }
      }

      // Ctrl shortcuts
      if (ctrl) {
        // Ctrl+Z — Undo
        if (e.key === 'z' && !shift) {
          e.preventDefault();
          undo();
          return;
        }

        // Ctrl+Shift+Z — Redo
        if (e.key === 'z' && shift) {
          e.preventDefault();
          useEditorStore.getState().redo();
          return;
        }

        // Ctrl+C — Copy
        if (e.key === 'c') {
          e.preventDefault();
          copyLayer();
          return;
        }

        // Ctrl+X — Cut
        if (e.key === 'x') {
          e.preventDefault();
          cutLayer();
          return;
        }

        // Ctrl+V — Paste
        if (e.key === 'v') {
          e.preventDefault();
          pasteLayer();
          return;
        }

        // Ctrl+D — Duplicate
        if (e.key === 'd') {
          e.preventDefault();
          if (selectedLayerId) duplicateLayer(selectedLayerId);
          return;
        }

        // Ctrl+A — Select all (select last layer as a simple version)
        if (e.key === 'a') {
          e.preventDefault();
          const store = useEditorStore.getState();
          const zone = store.design?.zones[store.activeZoneId];
          if (zone && zone.layers.length > 0) {
            selectLayer(zone.layers[zone.layers.length - 1]!.id);
          }
          return;
        }

        // Ctrl+E — Clear all objects
        if (e.key === 'e') {
          e.preventDefault();
          const store = useEditorStore.getState();
          const zone = store.design?.zones[store.activeZoneId];
          if (zone) {
            const ids = zone.layers.map((l) => l.id);
            ids.forEach((id) => removeLayer(id));
          }
          return;
        }

        // Ctrl+Shift+S — Download current design
        if (e.key === 's' && shift) {
          e.preventDefault();
          exportDesign({ format: 'png', includeBase: false, hideOverflow: true });
          return;
        }

        // Ctrl+S — Save (placeholder, prevent browser save)
        if (e.key === 's' && !shift) {
          e.preventDefault();
          // TODO: save to my designs (requires backend)
          return;
        }

        // Ctrl+P — Print
        if (e.key === 'p') {
          e.preventDefault();
          exportDesign({ format: 'png', includeBase: true, hideOverflow: true });
          return;
        }

        // Ctrl+ + — Zoom in
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          const store = useEditorStore.getState();
          const stage = store.stageRef?.current as { scaleX: () => number; scale: (s: { x: number; y: number }) => void; width: () => number; height: () => number; x: () => number; y: () => number; position: (p: { x: number; y: number }) => void } | null;
          if (stage) {
            const newScale = Math.min(5, stage.scaleX() * 1.15);
            const cx = stage.width() / 2;
            const cy = stage.height() / 2;
            const oldScale = stage.scaleX();
            const mx = (cx - stage.x()) / oldScale;
            const my = (cy - stage.y()) / oldScale;
            stage.scale({ x: newScale, y: newScale });
            stage.position({ x: cx - mx * newScale, y: cy - my * newScale });
          }
          return;
        }

        // Ctrl+ - — Zoom out
        if (e.key === '-') {
          e.preventDefault();
          const store = useEditorStore.getState();
          const stage = store.stageRef?.current as { scaleX: () => number; scale: (s: { x: number; y: number }) => void; width: () => number; height: () => number; x: () => number; y: () => number; position: (p: { x: number; y: number }) => void } | null;
          if (stage) {
            const newScale = Math.max(0.3, stage.scaleX() / 1.15);
            const cx = stage.width() / 2;
            const cy = stage.height() / 2;
            const oldScale = stage.scaleX();
            const mx = (cx - stage.x()) / oldScale;
            const my = (cy - stage.y()) / oldScale;
            stage.scale({ x: newScale, y: newScale });
            stage.position({ x: cx - mx * newScale, y: cy - my * newScale });
          }
          return;
        }

        // Ctrl+0 — Reset zoom
        if (e.key === '0') {
          e.preventDefault();
          const store = useEditorStore.getState();
          const stage = store.stageRef?.current as { scale: (s: { x: number; y: number }) => void; position: (p: { x: number; y: number }) => void } | null;
          if (stage) {
            stage.scale({ x: 1, y: 1 });
            stage.position({ x: 0, y: 0 });
          }
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedLayerId, removeLayer, copyLayer, cutLayer, pasteLayer, undo, duplicateLayer, updateLayer, selectLayer]);
}
