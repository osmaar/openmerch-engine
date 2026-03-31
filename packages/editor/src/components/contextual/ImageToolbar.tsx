import { useRef, useState } from 'react';
import {
  ImagePlus,
  Crop,
  Eraser,
  SlidersHorizontal,
  Paintbrush,
  Layers,
  Move,
  BoxSelect,
  Copy,
  Trash2,
} from 'lucide-react';
import type { ImageLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';
import { ToolbarButton, ToolbarDivider, ToolbarSlider, PopoverAnchor } from './shared.js';
import { CropModal } from './CropModal.js';
import { RemoveBgPopover } from './RemoveBgPopover.js';
import { FiltersPopover } from './FiltersPopover.js';
import { FillPopover } from './FillPopover.js';
import { ArrangePopover } from './ArrangePopover.js';
import { PositionPopover } from './PositionPopover.js';
import { TransformPopover } from './TransformPopover.js';

interface ImageToolbarProps {
  layer: ImageLayer;
}

type PopoverName = 'removeBg' | 'filters' | 'fill' | 'arrange' | 'position' | 'transform' | null;

export function ImageToolbar({ layer }: ImageToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [showRemoveBg, setShowRemoveBg] = useState(false);
  const [activePopover, setActivePopover] = useState<PopoverName>(null);
  const {
    updateLayer,
    replaceImage,
    applyFilter,
    duplicateLayer,
    removeLayer,
  } = useEditorStore();
  const designZone = useEditorStore((s) => s.design?.zones[s.activeZoneId]);

  const toggle = (name: PopoverName) => {
    setActivePopover(activePopover === name ? null : name);
  };

  const handleReplace = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const url = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = () => {
      replaceImage(layer.id, url, img.width, img.height);
    };
    img.src = url;
    e.target.value = '';
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <ToolbarButton icon={ImagePlus} tooltip="Replace image" onClick={handleReplace} />
      <ToolbarButton icon={Crop} tooltip="Crop image" onClick={() => { setShowCrop(true); setActivePopover(null); }} />

      <ToolbarButton icon={Eraser} tooltip="Remove background" onClick={() => setShowRemoveBg(true)} />

      {showRemoveBg && (
        <RemoveBgPopover imageSrc={layer.src} onClose={() => setShowRemoveBg(false)} onApply={(processedSrc) => {
          const img = new window.Image();
          img.onload = () => { replaceImage(layer.id, processedSrc, img.width, img.height); setShowRemoveBg(false); };
          img.src = processedSrc;
        }} />
      )}

      <PopoverAnchor isOpen={activePopover === 'filters'} popover={
        <FiltersPopover imageSrc={layer.src} originalSrc={layer.originalSrc} activeFilterIndex={layer.activeFilter ?? 0} onClose={() => setActivePopover(null)} onApply={(processedSrc, filterIndex) => { applyFilter(layer.id, processedSrc, filterIndex); setActivePopover(null); }} />
      }>
        <ToolbarButton icon={SlidersHorizontal} tooltip="Filters" onClick={() => toggle('filters')} active={activePopover === 'filters'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'fill'} popover={
        <FillPopover currentColor={layer.tint ?? '#000000'} currentOpacity={layer.tintOpacity ?? 0} onClose={() => setActivePopover(null)} onApply={(color, opacity) => updateLayer(layer.id, { tint: color, tintOpacity: opacity })} onClear={() => updateLayer(layer.id, { tint: undefined, tintOpacity: 0 })} />
      }>
        <ToolbarButton icon={Paintbrush} tooltip="Fill color" onClick={() => toggle('fill')} active={activePopover === 'fill'} />
      </PopoverAnchor>

      <ToolbarDivider />

      <ToolbarSlider
        label="Opacity"
        value={Math.round(layer.opacity * 100)}
        min={10}
        max={100}
        onChange={(v) => updateLayer(layer.id, { opacity: v / 100 })}
      />

      <ToolbarDivider />

      <PopoverAnchor isOpen={activePopover === 'arrange'} popover={<ArrangePopover layerId={layer.id} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={Layers} tooltip="Arrange layer" onClick={() => toggle('arrange')} active={activePopover === 'arrange'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'position'} popover={
        designZone ? <PositionPopover layer={layer} zoneWidthMM={designZone.canvasWidthMM} zoneHeightMM={designZone.canvasHeightMM} onClose={() => setActivePopover(null)} /> : <></>
      }>
        <ToolbarButton icon={Move} tooltip="Object position" onClick={() => toggle('position')} active={activePopover === 'position'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'transform'} popover={<TransformPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={BoxSelect} tooltip="Transform" onClick={() => toggle('transform')} active={activePopover === 'transform'} />
      </PopoverAnchor>

      <ToolbarDivider />

      <ToolbarButton icon={Copy} tooltip="Duplicate" onClick={() => duplicateLayer(layer.id)} />
      <ToolbarButton icon={Trash2} tooltip="Delete" onClick={() => removeLayer(layer.id)} danger />

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {showCrop && (
        <CropModal
          imageSrc={layer.src}
          onCancel={() => setShowCrop(false)}
          onCrop={(croppedSrc) => {
            const img = new window.Image();
            img.onload = () => { replaceImage(layer.id, croppedSrc, img.width, img.height); setShowCrop(false); };
            img.src = croppedSrc;
          }}
        />
      )}
    </div>
  );
}
