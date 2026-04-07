import { useState, useEffect } from 'react';

const loadedFonts = new Set<string>();
function loadGoogleFont(name: string) {
  if (loadedFonts.has(name) || ['Arial','Helvetica','Georgia','Times New Roman','Impact','Courier New','Verdana'].includes(name)) return;
  loadedFonts.add(name);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(name)}&display=swap`;
  document.head.appendChild(link);
}
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
import { useT } from '../../i18n/useTranslation.js';

const FONT_OPTIONS = [
  // Google Fonts — popular for design
  'Oswald', 'Bebas Neue', 'Anton', 'Pacifico', 'Permanent Marker',
  'Righteous', 'Bangers', 'Bungee', 'Creepster', 'Press Start 2P',
  'Black Ops One', 'Russo One', 'Orbitron', 'Audiowide', 'Monoton',
  'Lobster', 'Dancing Script', 'Caveat', 'Satisfy', 'Great Vibes',
  'Playfair Display', 'Merriweather', 'Lora', 'Cinzel', 'Cormorant Garamond',
  'Montserrat', 'Raleway', 'Poppins', 'Quicksand', 'Comfortaa',
  'Roboto', 'Open Sans', 'Lato', 'Inter', 'Nunito',
  // System fonts as fallback
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Impact',
  'Courier New', 'Verdana',
];

interface TextToolbarProps {
  layer: TextLayer;
}

type PopoverName = 'editText' | 'effects' | 'align' | 'case' | 'arrange' | 'position' | 'transform' | null;

export function TextToolbar({ layer }: TextToolbarProps) {
  const [activePopover, setActivePopover] = useState<PopoverName>(null);
  const { updateLayer, duplicateLayer, removeLayer } = useEditorStore();
  const designZone = useEditorStore((s) => s.design?.zones[s.activeZoneId]);
  const t = useT();

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

  // Load Google Fonts on mount + when font changes
  useEffect(() => {
    FONT_OPTIONS.forEach(loadGoogleFont);
  }, []);

  useEffect(() => {
    loadGoogleFont(layer.fontFamily);
  }, [layer.fontFamily]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <select
        style={selectStyle}
        value={layer.fontFamily}
        onChange={(e) => { loadGoogleFont(e.target.value); updateLayer(layer.id, { fontFamily: e.target.value }); }}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f} value={f}>{f}</option>
        ))}
      </select>

      <PopoverAnchor isOpen={activePopover === 'editText'} popover={<EditTextPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={Type} tooltip={t('Edit text')} onClick={() => toggle('editText')} active={activePopover === 'editText'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'effects'} popover={<TextEffectsPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={Sparkles} tooltip={t('Text effects')} onClick={() => toggle('effects')} active={activePopover === 'effects'} />
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

      <ToolbarButton icon={Bold} tooltip={t('Bold')} active={isBold} onClick={toggleBold} />
      <ToolbarButton icon={Italic} tooltip={t('Italic')} active={isItalic} onClick={toggleItalic} />
      <ToolbarButton icon={Underline} tooltip={t('Underline')} active={hasUnderline} onClick={toggleUnderline} />

      <ToolbarDivider />

      <PopoverAnchor isOpen={activePopover === 'align'} popover={<AlignPopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={AlignCenter} tooltip={t('Align')} onClick={() => toggle('align')} active={activePopover === 'align'} />
      </PopoverAnchor>

      <PopoverAnchor isOpen={activePopover === 'case'} popover={<CasePopover layer={layer} onClose={() => setActivePopover(null)} />}>
        <ToolbarButton icon={CaseSensitive} tooltip={t('Case')} onClick={() => toggle('case')} active={activePopover === 'case'} />
      </PopoverAnchor>

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
    </div>
  );
}
