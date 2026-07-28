import { useState } from 'react';
import {
  Paintbrush,
  Layers,
  Move,
  BoxSelect,
  Trash2,
  Copy,
  RotateCcw,
  X,
} from 'lucide-react';
import type { ShapeLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';
import { ToolbarButton, ToolbarDivider, ToolbarSlider, PopoverAnchor } from './shared.js';
import { ArrangePopover } from './ArrangePopover.js';
import { PositionPopover } from './PositionPopover.js';
import { TransformPopover } from './TransformPopover.js';
import { useT } from '../../i18n/useTranslation.js';

interface ShapeToolbarProps {
  layer: ShapeLayer;
}

const COLORS = [
  'transparent',
  '#000000', '#FFFFFF', '#e53935', '#FB8C00', '#FDD835',
  '#43A047', '#039BE5', '#3949AB', '#8E24AA', '#6D4C41',
  '#546E7A', '#EC407A', '#00ACC1', '#7CB342', '#FF7043',
];

export function ShapeToolbar({ layer }: ShapeToolbarProps) {
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const resetLayer = useEditorStore((s) => s.resetLayer);
  const designZone = useEditorStore((s) => s.design?.zones[s.activeZoneId]);
  const [activePopover, setActivePopover] = useState<string | null>(null);
  const t = useT();

  const toggle = (id: string) => setActivePopover(activePopover === id ? null : id);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      {/* Fill color */}
      <PopoverAnchor isOpen={activePopover === 'fill'} popover={
        <ColorPicker
          label="Fill color"
          value={layer.fill}
          onChange={(c) => updateLayer(layer.id, { fill: c })}
          onClose={() => setActivePopover(null)}
        />
      }>
        <ToolbarButton icon={Paintbrush} tooltip={t('Fill color')} onClick={() => toggle('fill')} active={activePopover === 'fill'} />
      </PopoverAnchor>

      {/* Stroke color */}
      <PopoverAnchor isOpen={activePopover === 'stroke'} popover={
        <ColorPicker
          label={t('Stroke color')}
          value={layer.stroke}
          onChange={(c) => updateLayer(layer.id, { stroke: c })}
          onClose={() => setActivePopover(null)}
        />
      }>
        <ToolbarButton icon={Paintbrush} tooltip={t('Stroke color')} onClick={() => toggle('stroke')} active={activePopover === 'stroke'} />
      </PopoverAnchor>

      {/* Stroke width */}
      <ToolbarSlider
        label={t('Stroke')}
        value={layer.strokeWidth}
        min={0}
        max={10}
        onChange={(v) => updateLayer(layer.id, { strokeWidth: v })}
      />

      <ToolbarDivider />

      {/* Opacity */}
      <ToolbarSlider
        label={t('Opacity')}
        value={Math.round(layer.opacity * 100)}
        min={10}
        max={100}
        onChange={(v) => updateLayer(layer.id, { opacity: v / 100 })}
      />

      <ToolbarDivider />

      {/* Arrange */}
      <PopoverAnchor isOpen={activePopover === 'arrange'} popover={<ArrangePopover layerId={layer.id} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={Layers} tooltip={t('Arrange')} onClick={() => toggle('arrange')} active={activePopover === 'arrange'} />
      </PopoverAnchor>

      {/* Position */}
      <PopoverAnchor isOpen={activePopover === 'position'} popover={
        designZone ? <PositionPopover layer={layer} zoneWidthMM={designZone.canvasWidthMM} zoneHeightMM={designZone.canvasHeightMM} onClose={() => setActivePopover(null)} /> : <></>
      }>
        <ToolbarButton icon={Move} tooltip={t('Position')} onClick={() => toggle('position')} active={activePopover === 'position'} />
      </PopoverAnchor>

      {/* Transform */}
      <PopoverAnchor isOpen={activePopover === 'transform'} popover={<TransformPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={BoxSelect} tooltip={t('Transform')} onClick={() => toggle('transform')} active={activePopover === 'transform'} />
      </PopoverAnchor>

      <ToolbarDivider />

      {/* Duplicate */}
      <ToolbarButton icon={Copy} tooltip={t('Duplicate')} onClick={() => duplicateLayer(layer.id)} />

      {/* Reset */}
      <ToolbarButton icon={RotateCcw} tooltip={t('Reset')} onClick={() => resetLayer(layer.id)} />

      {/* Delete */}
      <ToolbarButton icon={Trash2} tooltip={t('Delete')} onClick={() => removeLayer(layer.id)} />
    </div>
  );
}

// Simple color picker popover
function ColorPicker({ label, value, onChange, onClose }: {
  label: string;
  value: string;
  onChange: (color: string) => void;
  onClose: () => void;
}) {
  return (
    <div style={{
      position: 'absolute',
      top: '100%',
      left: '50%',
      transform: 'translateX(-50%)',
      marginTop: 6,
      background: '#fff',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: '#e0e0e0',
      borderRadius: 10,
      boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
      padding: 12,
      zIndex: 100,
      width: 200,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: '#333' }}>{label}</span>
        <button onClick={onClose} style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}>
          <X size={14} />
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onChange(c)}
            title={c === 'transparent' ? 'No fill' : c}
            style={{
              width: 30,
              height: 30,
              borderRadius: 4,
              background: c === 'transparent' ? '#fff' : c,
              borderWidth: 2,
              borderStyle: 'solid',
              borderColor: value === c ? '#4A90D9' : '#ddd',
              cursor: 'pointer',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {c === 'transparent' && (
              <div style={{
                position: 'absolute',
                top: '50%',
                left: -2,
                width: '140%',
                height: 2,
                background: '#e53935',
                transform: 'rotate(-45deg)',
                transformOrigin: 'left center',
              }} />
            )}
          </button>
        ))}
      </div>

      {/* Custom color input */}
      <div style={{ marginTop: 8, display: 'flex', gap: 4, alignItems: 'center' }}>
        <input
          type="color"
          value={value === 'transparent' ? '#ffffff' : value}
          onChange={(e) => onChange(e.target.value)}
          style={{ width: 30, height: 26, padding: 0, borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 4, cursor: 'pointer' }}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          style={{ flex: 1, padding: '3px 6px', borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 4, fontSize: 11 }}
        />
      </div>
    </div>
  );
}
