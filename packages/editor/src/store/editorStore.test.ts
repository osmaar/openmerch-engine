import { describe, it, expect, beforeEach } from 'vitest';
import type { Product, DesignLayer } from '@openmerch/core';
import { useEditorStore } from './editorStore.js';

const testProduct: Product = {
  id: 'p1',
  name: 'Test Product',
  slug: 'test-product',
  zones: [
    {
      id: 'front',
      name: 'Front',
      baseImageWidthMM: 300,
      baseImageHeightMM: 300,
      printAreaWidthMM: 200,
      printAreaHeightMM: 200,
      printAreaXMM: 50,
      printAreaYMM: 50,
      baseImageUrl: 'front.png',
    },
  ],
};

function getLayers(): DesignLayer[] {
  const { design, activeZoneId } = useEditorStore.getState();
  return design?.zones[activeZoneId]?.layers ?? [];
}

beforeEach(() => {
  useEditorStore.getState().setProduct(testProduct);
});

describe('editorStore undo/redo history', () => {
  it('truncates the redo branch when a new action is taken after an undo', () => {
    const { addTextLayer, addShapeLayer, undo, redo } = useEditorStore.getState();

    addTextLayer();
    addTextLayer();
    expect(getLayers()).toHaveLength(2);
    expect(getLayers().map((l) => l.type)).toEqual(['text', 'text']);

    undo();
    expect(getLayers()).toHaveLength(1);

    // A fresh action after undo must discard the old "future" (the 2nd text layer).
    addShapeLayer('rect');
    expect(getLayers()).toHaveLength(2);
    expect(getLayers().map((l) => l.type)).toEqual(['text', 'shape']);

    // The discarded branch must not be reachable via redo anymore.
    expect(() => redo()).not.toThrow();
    expect(getLayers()).toHaveLength(2);
    expect(getLayers().map((l) => l.type)).toEqual(['text', 'shape']);
  });

  it('undo() at the oldest point in history is a safe no-op', () => {
    const { addTextLayer, undo } = useEditorStore.getState();

    addTextLayer();
    expect(useEditorStore.getState().historyIndex).toBe(0);

    undo();
    expect(getLayers()).toHaveLength(0);
    expect(useEditorStore.getState().historyIndex).toBe(-1);

    expect(() => undo()).not.toThrow();
    expect(getLayers()).toHaveLength(0);
    expect(useEditorStore.getState().historyIndex).toBe(-1);

    // Calling it several more times must remain a harmless no-op.
    expect(() => {
      undo();
      undo();
    }).not.toThrow();
    expect(getLayers()).toHaveLength(0);
  });

  it('redo() with no future history is a safe no-op', () => {
    const { redo } = useEditorStore.getState();

    expect(() => redo()).not.toThrow();
    expect(getLayers()).toHaveLength(0);

    const { addTextLayer } = useEditorStore.getState();
    addTextLayer();
    // No undo happened, so there is nothing to redo into.
    expect(() => redo()).not.toThrow();
    expect(getLayers()).toHaveLength(1);
  });

  it('redo() restores the state that was undone', () => {
    const { addTextLayer, undo, redo } = useEditorStore.getState();

    addTextLayer();
    addTextLayer();
    undo();
    expect(getLayers()).toHaveLength(1);

    redo();
    expect(getLayers()).toHaveLength(2);
  });

  it('exceeding MAX_HISTORY discards the oldest entry, not the most recent', () => {
    const { addTextLayer, updateLayer } = useEditorStore.getState();

    addTextLayer();
    const layer = getLayers()[0];
    if (!layer) throw new Error('expected a layer to exist');

    // MAX_HISTORY is 50. Push well past that so the buffer must evict entries.
    for (let i = 1; i <= 60; i++) {
      updateLayer(layer.id, { rotation: i });
    }

    const { history } = useEditorStore.getState();
    expect(history.length).toBe(50);

    // The oldest entries (from addTextLayer and the earliest updates) must be gone.
    const oldestKept = history[0];
    expect(oldestKept).toBeDefined();
    expect(oldestKept?.layers).toHaveLength(1);
    const oldestLayer = oldestKept?.layers[0];
    expect(oldestLayer?.type).toBe('text');
    // If the oldest entries had survived, this would be 0 (the pristine layer)
    // or empty (the pre-addTextLayer snapshot). Eviction must have dropped those.
    expect(oldestLayer && 'rotation' in oldestLayer ? oldestLayer.rotation : undefined).toBe(10);

    // The most recent entry must still be present (newest, not evicted).
    const newestKept = history[history.length - 1];
    const newestLayer = newestKept?.layers[0];
    expect(newestLayer && 'rotation' in newestLayer ? newestLayer.rotation : undefined).toBe(59);

    // The live design state reflects the final update, independent of history.
    expect(getLayers()[0]?.rotation).toBe(60);
  });
});
