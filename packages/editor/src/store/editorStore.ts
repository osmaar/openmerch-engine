import { create } from 'zustand';
import type {
  Product,
  ProductZone,
  Design,
  DesignZone,
  DesignLayer,
  ImageLayer,
  TextLayer,
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

  setProduct: (product: Product) => void;
  setActiveZone: (zoneId: string) => void;
  getActiveProductZone: () => ProductZone | undefined;
  getActiveDesignZone: () => DesignZone | undefined;

  addImageLayer: (src: string, widthPx: number, heightPx: number) => void;
  addTextLayer: () => void;
  updateLayer: (layerId: string, updates: Partial<DesignLayer>) => void;
  removeLayer: (layerId: string) => void;
  selectLayer: (layerId: string | null) => void;
  duplicateLayer: (layerId: string) => void;
  resetLayer: (layerId: string) => void;
  copyLayer: () => void;
  cutLayer: () => void;
  pasteLayer: () => void;
  undo: () => void;
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
      originalWidthMM: layerWidthMM,
      originalHeightMM: layerHeightMM,
      x: (zone.canvasWidthMM - layerWidthMM) / 2,
      y: (zone.canvasHeightMM - layerHeightMM) / 2,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
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
      selectedLayerId: layer.id,
    });
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
      x: zone.canvasWidthMM * 0.25,
      y: zone.canvasHeightMM * 0.4,
      rotation: 0,
      scaleX: 1,
      scaleY: 1,
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
      selectedLayerId: layer.id,
    });
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
    };

    // Re-center the layer
    if (layer.type === 'image') {
      updates.x = (zone.canvasWidthMM - layer.originalWidthMM) / 2;
      updates.y = (zone.canvasHeightMM - layer.originalHeightMM) / 2;
    } else {
      updates.x = zone.canvasWidthMM * 0.25;
      updates.y = zone.canvasHeightMM * 0.4;
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

  undo: () => {
    const { design, activeZoneId, history, historyIndex } = get();
    if (!design || historyIndex < 0) return;

    const entry = history[historyIndex];
    if (!entry || entry.zoneId !== activeZoneId) return;

    const zone = design.zones[activeZoneId];
    if (!zone) return;

    set({
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
}));
