import { useState } from 'react';
import {
  Type,
  Sparkles,
  Bold,
  Italic,
  Underline,
  AlignCenter,
  CaseSensitive,
  Layers,
  Move,
  BoxSelect,
  Copy,
  Trash2,
} from 'lucide-react';
import type { TextLayer } from '@openmerch/core';
import { useEditorStore } from '../../store/editorStore.js';
import { ToolbarButton, ToolbarDivider, PopoverAnchor } from './shared.js';
import { EditTextPopover } from './EditTextPopover.js';
import { TextEffectsPopover } from './TextEffectsPopover.js';
import { AlignPopover } from './AlignPopover.js';
import { CasePopover } from './CasePopover.js';
import { ArrangePopover } from './ArrangePopover.js';
import { PositionPopover } from './PositionPopover.js';
import { TransformPopover } from './TransformPopover.js';

const FONT_OPTIONS = [
  'Arial',
  'Helvetica',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Impact',
  'Comic Sans MS',
  'Trebuchet MS',
  'Palatino',
];

interface TextToolbarProps {
  layer: TextLayer;
}

type PopoverName = 'editText' | 'effects' | 'align' | 'case' | 'arrange' | 'position' | 'transform' | null;

export function TextToolbar({ layer }: TextToolbarProps) {
  const [activePopover, setActivePopover] = useState<PopoverName>(null);
  const { updateLayer, duplicateLayer, removeLayer } = useEditorStore();
  const designZone = useEditorStore((s) => s.design?.zones[s.activeZoneId]);

  const toggle = (name: PopoverName) => {
    setActivePopover(activePopover === name ? null : name);
  };

  const isBold = (layer.fontStyle ?? '').includes('bold');
  const isItalic = (layer.fontStyle ?? '').includes('italic');
  const hasUnderline = (layer.textDecoration ?? '') === 'underline';

  const toggleBold = () => {
    const current = layer.fontStyle ?? 'normal';
    if (isBold) {
      updateLayer(layer.id, { fontStyle: current.replace('bold', '').trim() || 'normal' });
    } else {
      updateLayer(layer.id, { fontStyle: current === 'normal' ? 'bold' : `bold ${current}` });
    }
  };

  const toggleItalic = () => {
    const current = layer.fontStyle ?? 'normal';
    if (isItalic) {
      updateLayer(layer.id, { fontStyle: current.replace('italic', '').trim() || 'normal' });
    } else {
      updateLayer(layer.id, { fontStyle: current === 'normal' ? 'italic' : `${current} italic` });
    }
  };

  const toggleUnderline = () => {
    updateLayer(layer.id, { textDecoration: hasUnderline ? '' : 'underline' });
  };

  const selectStyle: React.CSSProperties = {
    padding: '4px 8px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ccc',
    borderRadius: 4,
    fontSize: 12,
    background: '#fff',
    cursor: 'pointer',
    maxWidth: 120,
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <select
        style={selectStyle}
        value={layer.fontFamily}
        onChange={(e) => updateLayer(layer.id, { fontFamily: e.target.value })}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <PopoverAnchor isOpen={activePopover === 'editText'} popover={<EditTextPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={Type} tooltip="Edit text" onClick={() => toggle('editText')} active={activePopover === 'editText'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'effects'} popover={<TextEffectsPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={Sparkles} tooltip="Text effects" onClick={() => toggle('effects')} active={activePopover === 'effects'} />
      </PopoverAnchor>

      <ToolbarDivider />

      <input
        type="color"
        value={layer.fill}
        onChange={(e) => updateLayer(layer.id, { fill: e.target.value })}
        title="Text color"
        style={{
          width: 26, height: 26, padding: 0,
          borderWidth: 1, borderStyle: 'solid', borderColor: '#ccc',
          borderRadius: 4, cursor: 'pointer', background: 'none',
        }}
      />

      <ToolbarButton icon={Bold} tooltip="Bold" active={isBold} onClick={toggleBold} />
      <ToolbarButton icon={Italic} tooltip="Italic" active={isItalic} onClick={toggleItalic} />
      <ToolbarButton icon={Underline} tooltip="Underline" active={hasUnderline} onClick={toggleUnderline} />

      <ToolbarDivider />

      <PopoverAnchor isOpen={activePopover === 'align'} popover={<AlignPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={AlignCenter} tooltip="Align" onClick={() => toggle('align')} active={activePopover === 'align'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'case'} popover={<CasePopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={CaseSensitive} tooltip="Case" onClick={() => toggle('case')} active={activePopover === 'case'} />
      </PopoverAnchor>

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
    </div>
  );
}
