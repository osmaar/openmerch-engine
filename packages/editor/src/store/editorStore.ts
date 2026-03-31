import { create } from 'zustand';
import type {
  Product,
  ProductZone,
  Design,
  DesignZone,
  DesignLayer,
  ImageLayer,
  TextLayer,
  ShapeLayer,
} from '@openmerch/core';

// Undo history entry: snapshot of layers for the active zone
interface HistoryEntry {
  zoneId: string;
  layers: DesignLayer[];
}

const MAX_HISTORY = 50;

interface EditorState {
  product: Product | null;
  activeZoneId: string;
  design: Design | null;
  selectedLayerId: string | null;
  clipboard: DesignLayer | null;
  history: HistoryEntry[];
  historyIndex: number;
  productColor: string;
  sizes: Record<string, number>;
  canvasOffsetMM: { x: number; y: number };
  gallery: { id: string; src: string; name: string }[];
  showPrintZone: boolean;
  stageRef: { current: unknown } | null;
  canvasLayout: { printX: number; printY: number; printW: number; printH: number; pxPerMM: number } | null;
  savedDesignId: string | null;
  isSaving: boolean;
  lastSavedAt: string | null;
  unsplashKey: string;
  pollinationsKey: string;

  setProduct: (product: Product) => void;
  setUnsplashKey: (key: string) => void;
  setPollinationsKey: (key: string) => void;
  setActiveZone: (zoneId: string) => void;
  setProductColor: (color: string) => void;
  setSizeQuantity: (size: string, qty: number) => void;
  setCanvasOffsetMM: (x: number, y: number) => void;
  addToGallery: (src: string, name: string) => void;
  removeFromGallery: (id: string) => void;
  getActiveProductZone: () => ProductZone | undefined;
  getActiveDesignZone: () => DesignZone | undefined;

  addImageLayer: (src: string, widthPx: number, heightPx: number) => void;
  addTextLayer: () => void;
  addShapeLayer: (shapeType: ShapeLayer['shapeType']) => void;
  updateLayer: (layerId: string, updates: Partial<DesignLayer>) => void;
  removeLayer: (layerId: string) => void;
  selectLayer: (layerId: string | null) => void;
  duplicateLayer: (layerId: string) => void;
  resetLayer: (layerId: string) => void;
  copyLayer: () => void;
  cutLayer: () => void;
  pasteLayer: () => void;
  moveLayerUp: (layerId: string) => void;
  moveLayerDown: (layerId: string) => void;
  replaceImage: (layerId: string, newSrc: string, widthPx: number, heightPx: number) => void;
  applyFilter: (layerId: string, filteredSrc: string, filterIndex: number) => void;
  undo: () => void;
  redo: () => void;
  getSelectedLayer: () => DesignLayer | undefined;
}

function pushHistory(state: EditorState): Pick<EditorState, 'history' | 'historyIndex'> {
  const zone = state.design?.zones[state.activeZoneId];
  if (!zone) return { history: state.history, historyIndex: state.historyIndex };

  const entry: HistoryEntry = {
    zoneId: state.activeZoneId,
    layers: JSON.parse(JSON.stringify(zone.layers)),
  };

  // Trim future entries if we undid some steps
  const trimmed = state.history.slice(0, state.historyIndex + 1);
  const newHistory = [...trimmed, entry].slice(-MAX_HISTORY);

  return {
    history: newHistory,
    historyIndex: newHistory.length - 1,
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  product: null,
  activeZoneId: 'front',
  design: null,
  selectedLayerId: null,
  clipboard: null,
  history: [],
  historyIndex: -1,
  productColor: '#FFFFFF',
  sizes: { S: 0, M: 0, L: 0, XL: 0, XXL: 0 },
  canvasOffsetMM: { x: 0, y: 0 },
  gallery: [],
  showPrintZone: true,
  stageRef: null,
  canvasLayout: null,
  savedDesignId: null,
  isSaving: false,
  lastSavedAt: null,
  unsplashKey: '',
  pollinationsKey: '',

  setProduct: (product: Product) => {
    const design: Design = {
      id: crypto.randomUUID(),
      productId: product.id,
      activeZone: product.zones[0]?.id ?? 'front',
      zones: Object.fromEntries(
        product.zones.map((zone) => [
          zone.id,
          {
            zoneId: zone.id,
            canvasWidthMM: zone.printAreaWidthMM,
            canvasHeightMM: zone.printAreaHeightMM,
            layers: [],
          },
        ]),
      ),
    };

    set({
      product,
      activeZoneId: product.zones[0]?.id ?? 'front',
      design,
      selectedLayerId: null,
      history: [],
      historyIndex: -1,
    });
  },

  setActiveZone: (zoneId: string) => {
    set({ activeZoneId: zoneId, selectedLayerId: null });
  },

  setProductColor: (color: string) => {
    set({ productColor: color });
  },

  setSizeQuantity: (size: string, qty: number) => {
    const sizes = { ...get().sizes };
    sizes[size] = Math.max(0, qty);
    set({ sizes });
  },

  setUnsplashKey: (key: string) => {
    set({ unsplashKey: key });
  },

  setPollinationsKey: (key: string) => {
    set({ pollinationsKey: key });
  },

  setCanvasOffsetMM: (x: number, y: number) => {
    set({ canvasOffsetMM: { x, y } });
  },

  addToGallery: (src: string, name: string) => {
    const { gallery } = get();
    set({ gallery: [...gallery, { id: crypto.randomUUID(), src, name }] });
  },

  removeFromGallery: (id: string) => {
    const { gallery } = get();
    set({ gallery: gallery.filter((g) => g.id !== id) });
  },

  getActiveProductZone: () => {
    const { product, activeZoneId } = get();
    return product?.zones.find((z) => z.id === activeZoneId);
  },

  getActiveDesignZone: () => {
    const { design, activeZoneId } = get();
    return design?.zones[activeZoneId];
  },

  addImageLayer: (src: string, widthPx: number, heightPx: number) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    // Fit image to 80% of print zone, preserving aspect ratio
    const imgAspect = widthPx / heightPx;
    const maxW = zone.canvasWidthMM * 0.8;
    const maxH = zone.canvasHeightMM * 0.8;

    let layerWidthMM: number;
    let layerHeightMM: number;

    if (imgAspect > maxW / maxH) {
      layerWidthMM = maxW;
      layerHeightMM = maxW / imgAspect;
    } else {
      layerHeightMM = maxH;
      layerWidthMM = maxH * imgAspect;
    }

    const layer: ImageLayer = {
      id: crypto.randomUUID(),
      type: 'image',
      src,
      originalSrc: src,
      originalWidthMM: layerWidthMM,
      originalHeightMM: layerHeightMM,
      x: get().canvasOffsetMM.x + (zone.canvasWidthMM - layerWidthMM) / 2,
      y: get().canvasOffsetMM.y + (zone.canvasHeightMM - layerHeightMM) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      opacity: 1,
      locked: false,
      visible: true,
      activeFilter: 0,
    };

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: [...zone.layers, layer],
          },
        },
      },
      selectedLayerId: null,
    });
    // Delay selection so Konva node mounts before Transformer attaches
    setTimeout(() => set({ selectedLayerId: layer.id }), 50);
  },

  addTextLayer: () => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const layer: TextLayer = {
      id: crypto.randomUUID(),
      type: 'text',
      text: 'Your text',
      fontFamily: 'Arial',
      fontSize: 24,
      fill: '#000000',
      align: 'center',
      letterSpacing: 0,
      lineHeight: 1.2,
      fontStyle: 'normal',
      textDecoration: '',
      textEffect: { type: 'none', radius: 200, spacing: 0, curve: 0, height: 0, offset: 0 },
      x: get().canvasOffsetMM.x + zone.canvasWidthMM * 0.25,
      y: get().canvasOffsetMM.y + zone.canvasHeightMM * 0.4,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      opacity: 1,
      locked: false,
      visible: true,
    };

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: [...zone.layers, layer],
          },
        },
      },
      selectedLayerId: null,
    });
    // Delay selection so Konva node mounts before Transformer attaches
    setTimeout(() => set({ selectedLayerId: layer.id }), 50);
  },

  addShapeLayer: (shapeType: ShapeLayer['shapeType']) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const sizeMM = 40;
    const offset = get().canvasOffsetMM;

    const isLineType = shapeType === 'line' || shapeType === 'arrow';

    const layer: ShapeLayer = {
      id: crypto.randomUUID(),
      type: 'shape',
      shapeType,
      fill: isLineType ? 'transparent' : 'transparent',
      stroke: '#333333',
      strokeWidth: isLineType ? 3 : 2,
      widthMM: sizeMM,
      heightMM: shapeType === 'line' ? 0 : sizeMM,
      sides: shapeType === 'triangle' ? 3 : shapeType === 'star' ? 5 : undefined,
      innerRadius: shapeType === 'star' ? sizeMM * 0.4 : undefined,
      x: offset.x + (zone.canvasWidthMM - sizeMM) / 2,
      y: offset.y + (zone.canvasHeightMM - sizeMM) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
      opacity: 1,
      locked: false,
      visible: true,
    };

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: [...zone.layers, layer],
          },
        },
      },
      selectedLayerId: null,
    });
    // Delay selection so Konva node mounts before Transformer attaches
    setTimeout(() => set({ selectedLayerId: layer.id }), 50);
  },

  updateLayer: (layerId: string, updates: Partial<DesignLayer>) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: zone.layers.map((l) =>
              l.id === layerId ? ({ ...l, ...updates } as DesignLayer) : l,
            ),
          },
        },
      },
    });
  },

  removeLayer: (layerId: string) => {
    const state = get();
    const { design, activeZoneId, selectedLayerId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: zone.layers.filter((l) => l.id !== layerId),
          },
        },
      },
      selectedLayerId: selectedLayerId === layerId ? null : selectedLayerId,
    });
  },

  selectLayer: (layerId: string | null) => {
    set({ selectedLayerId: layerId });
  },

  duplicateLayer: (layerId: string) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const original = zone.layers.find((l) => l.id === layerId);
    if (!original) return;

    const duplicate = {
      ...JSON.parse(JSON.stringify(original)),
      id: crypto.randomUUID(),
      x: original.x + 5,
      y: original.y + 5,
    } as DesignLayer;

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: [...zone.layers, duplicate],
          },
        },
      },
      selectedLayerId: duplicate.id,
    });
  },

  resetLayer: (layerId: string) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const layer = zone.layers.find((l) => l.id === layerId);
    if (!layer) return;

    const updates: Partial<DesignLayer> = {
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
      skewX: 0,
      skewY: 0,
    };

    // Re-center the layer
    const offset = get().canvasOffsetMM;
    if (layer.type === 'image') {
      updates.x = offset.x + (zone.canvasWidthMM - layer.originalWidthMM) / 2;
      updates.y = offset.y + (zone.canvasHeightMM - layer.originalHeightMM) / 2;
    } else {
      updates.x = offset.x + zone.canvasWidthMM * 0.25;
      updates.y = offset.y + zone.canvasHeightMM * 0.4;
    }

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: zone.layers.map((l) =>
              l.id === layerId ? ({ ...l, ...updates } as DesignLayer) : l,
            ),
          },
        },
      },
    });
  },

  copyLayer: () => {
    const { design, activeZoneId, selectedLayerId } = get();
    if (!design || !selectedLayerId) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const layer = zone.layers.find((l) => l.id === selectedLayerId);
    if (!layer) return;

    set({ clipboard: JSON.parse(JSON.stringify(layer)) });
  },

  cutLayer: () => {
    const state = get();
    const { design, activeZoneId, selectedLayerId } = state;
    if (!design || !selectedLayerId) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const layer = zone.layers.find((l) => l.id === selectedLayerId);
    if (!layer) return;

    const hist = pushHistory(state);

    set({
      ...hist,
      clipboard: JSON.parse(JSON.stringify(layer)),
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: zone.layers.filter((l) => l.id !== selectedLayerId),
          },
        },
      },
      selectedLayerId: null,
    });
  },

  pasteLayer: () => {
    const state = get();
    const { design, activeZoneId, clipboard } = state;
    if (!design || !clipboard) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const pasted = {
      ...JSON.parse(JSON.stringify(clipboard)),
      id: crypto.randomUUID(),
      x: clipboard.x + 5,
      y: clipboard.y + 5,
    } as DesignLayer;

    const hist = pushHistory(state);

    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: [...zone.layers, pasted],
          },
        },
      },
      selectedLayerId: pasted.id,
    });
  },

  moveLayerUp: (layerId: string) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const idx = zone.layers.findIndex((l) => l.id === layerId);
    if (idx < 0 || idx >= zone.layers.length - 1) return;

    const newLayers = [...zone.layers];
    [newLayers[idx], newLayers[idx + 1]] = [newLayers[idx + 1]!, newLayers[idx]!];

    const hist = pushHistory(state);
    set({
      ...hist,
      design: {
        ...design,
        zones: { ...design.zones, [activeZoneId]: { ...zone, layers: newLayers } },
      },
    });
  },

  moveLayerDown: (layerId: string) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const idx = zone.layers.findIndex((l) => l.id === layerId);
    if (idx <= 0) return;

    const newLayers = [...zone.layers];
    [newLayers[idx - 1], newLayers[idx]] = [newLayers[idx]!, newLayers[idx - 1]!];

    const hist = pushHistory(state);
    set({
      ...hist,
      design: {
        ...design,
        zones: { ...design.zones, [activeZoneId]: { ...zone, layers: newLayers } },
      },
    });
  },

  replaceImage: (layerId: string, newSrc: string, widthPx: number, heightPx: number) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const layer = zone.layers.find((l) => l.id === layerId);
    if (!layer || layer.type !== 'image') return;

    const imgAspect = widthPx / heightPx;
    const maxW = zone.canvasWidthMM * 0.8;
    const maxH = zone.canvasHeightMM * 0.8;

    let w: number;
    let h: number;
    if (imgAspect > maxW / maxH) {
      w = maxW;
      h = maxW / imgAspect;
    } else {
      h = maxH;
      w = maxH * imgAspect;
    }

    const hist = pushHistory(state);
    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: zone.layers.map((l) =>
              l.id === layerId
                ? ({
                    ...l,
                    src: newSrc,
                    originalSrc: newSrc,
                    originalWidthMM: w,
                    originalHeightMM: h,
                    scaleX: 1,
                    scaleY: 1,
                    rotation: 0,
                    activeFilter: 0,
                  } as DesignLayer)
                : l,
            ),
          },
        },
      },
    });
  },

  applyFilter: (layerId: string, filteredSrc: string, filterIndex: number) => {
    const state = get();
    const { design, activeZoneId } = state;
    if (!design) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    const hist = pushHistory(state);
    set({
      ...hist,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: zone.layers.map((l) =>
              l.id === layerId
                ? ({ ...l, src: filteredSrc, activeFilter: filterIndex } as DesignLayer)
                : l,
            ),
          },
        },
      },
    });
  },

  getSelectedLayer: () => {
    const { design, activeZoneId, selectedLayerId } = get();
    if (!design || !selectedLayerId) return undefined;
    const zone = design.zones[activeZoneId];
    return zone?.layers.find((l) => l.id === selectedLayerId);
  },

  undo: () => {
    const { design, activeZoneId, history, historyIndex } = get();
    if (!design || historyIndex < 0) return;

    const entry = history[historyIndex];
    if (!entry || entry.zoneId !== activeZoneId) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    // Save current state as a redo point (append after current index if not already there)
    const currentLayers = JSON.parse(JSON.stringify(zone.layers)) as DesignLayer[];
    const redoEntry = { zoneId: activeZoneId, layers: currentLayers };
    const newHistory = [...history];

    // Insert redo entry after current index if it doesn't exist
    if (historyIndex + 1 >= newHistory.length || JSON.stringify(newHistory[historyIndex + 1]) !== JSON.stringify(redoEntry)) {
      newHistory.splice(historyIndex + 1, newHistory.length - historyIndex - 1, redoEntry);
    }

    set({
      history: newHistory,
      historyIndex: historyIndex - 1,
      selectedLayerId: null,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: entry.layers,
          },
        },
      },
    });
  },

  redo: () => {
    const { design, activeZoneId, history, historyIndex } = get();
    if (!design) return;

    const nextIndex = historyIndex + 2; // +1 is the redo point we saved, +2 skips to it
    if (nextIndex >= history.length) return;

    const entry = history[nextIndex];
    if (!entry || entry.zoneId !== activeZoneId) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    set({
      historyIndex: historyIndex + 1,
      selectedLayerId: null,
      design: {
        ...design,
        zones: {
          ...design.zones,
          [activeZoneId]: {
            ...zone,
            layers: entry.layers,
          },
        },
      },
    });
  },
}));
