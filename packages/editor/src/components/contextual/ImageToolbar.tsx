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
import { useT } from '../../i18n/useTranslation.js';

interface ImageToolbarProps {
  layer: ImageLayer;
}

type PopoverName = 'removeBg' | 'filters' | 'fill' | 'arrange' | 'position' | 'transform' | null;

export function ImageToolbar({ layer }: ImageToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showCrop, setShowCrop] = useState(false);
  const [showRemoveBg, setShowRemoveBg] = useState(false);
  const [activePopover, setActivePopover] = useState<PopoverName>(null);
  const t = useT();
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    const blobUrl = URL.createObjectURL(file);
    const img = new window.Image();
    img.onload = async () => {
      const { width, height } = img;
      URL.revokeObjectURL(blobUrl);
      try {
        const { uploadAsset } = await import('../../services/api.js');
        const asset = await uploadAsset(file);
        replaceImage(layer.id, asset.url, width, height);
      } catch {
        replaceImage(layer.id, blobUrl, width, height);
      }
    };
    img.src = blobUrl;
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <ToolbarButton icon={ImagePlus} tooltip={t('Replace image')} onClick={handleReplace} />
      <ToolbarButton icon={Crop} tooltip={t('Crop image')} onClick={() => { setShowCrop(true); setActivePopover(null); }} />

      <ToolbarButton icon={Eraser} tooltip={layer.src.includes('.svg') ? t('SVGs already have transparent background') : t('Remove background')} onClick={() => { if (!layer.src.includes('.svg')) setShowRemoveBg(true); }} disabled={layer.src.includes('.svg')} />

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
        <ToolbarButton icon={SlidersHorizontal} tooltip={t('Filters')} onClick={() => toggle('filters')} active={activePopover === 'filters'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'fill'} popover={
        <FillPopover currentColor={layer.tint ?? '#000000'} currentOpacity={layer.tintOpacity ?? 1} onClose={() => setActivePopover(null)} onApply={(color, opacity) => updateLayer(layer.id, { tint: color, tintOpacity: opacity })} onClear={() => updateLayer(layer.id, { tint: undefined, tintOpacity: 0 })} />
      }>
        <ToolbarButton icon={Paintbrush} tooltip={t('Fill color')} onClick={() => toggle('fill')} active={activePopover === 'fill'} />
      </PopoverAnchor>

      <ToolbarDivider />

      <ToolbarSlider
        label={t('Opacity')}
        value={Math.round(layer.opacity * 100)}
        min={10}
        max={100}
        onChange={(v) => updateLayer(layer.id, { opacity: v / 100 })}
      />

      <ToolbarDivider />

      <PopoverAnchor isOpen={activePopover === 'arrange'} popover={<ArrangePopover layerId={layer.id} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={Layers} tooltip={t('Arrange layer')} onClick={() => toggle('arrange')} active={activePopover === 'arrange'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'position'} popover={
        designZone ? <PositionPopover layer={layer} zoneWidthMM={designZone.canvasWidthMM} zoneHeightMM={designZone.canvasHeightMM} onClose={() => setActivePopover(null)} /> : <></>
      }>
        <ToolbarButton icon={Move} tooltip={t('Object position')} onClick={() => toggle('position')} active={activePopover === 'position'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'transform'} popover={<TransformPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={BoxSelect} tooltip={t('Transform')} onClick={() => toggle('transform')} active={activePopover === 'transform'} />
      </PopoverAnchor>

      <ToolbarDivider />

      <ToolbarButton icon={Copy} tooltip={t('Duplicate')} onClick={() => duplicateLayer(layer.id)} />
      <ToolbarButton icon={Trash2} tooltip={t('Delete')} onClick={() => removeLayer(layer.id)} danger />

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
