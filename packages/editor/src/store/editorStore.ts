import { create } from 'zustand';
import type { Product, ProductZone, Design, DesignZone } from '@openmerch/core';

interface EditorState {
  product: Product | null;
  activeZoneId: string;
  design: Design | null;

  setProduct: (product: Product) => void;
  setActiveZone: (zoneId: string) => void;
  getActiveProductZone: () => ProductZone | undefined;
  getActiveDesignZone: () => DesignZone | undefined;
}

export const useEditorStore = create<EditorState>((set, get) => ({
  product: null,
  activeZoneId: 'front',
  design: null,

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
    });
  },

  setActiveZone: (zoneId: string) => {
    set({ activeZoneId: zoneId });
  },

  getActiveProductZone: () => {
    const { product, activeZoneId } = get();
    return product?.zones.find((z) => z.id === activeZoneId);
  },

  getActiveDesignZone: () => {
    const { design, activeZoneId } = get();
    return design?.zones[activeZoneId];
  },
}));
