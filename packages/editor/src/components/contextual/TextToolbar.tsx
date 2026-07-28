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
  // ── Sans-serif ──
  'Roboto', 'Open Sans', 'Lato', 'Inter', 'Nunito', 'Poppins',
  'Montserrat', 'Raleway', 'Quicksand', 'Comfortaa', 'Oswald',
  'Mukta', 'Rubik', 'Work Sans', 'Barlow', 'Outfit',
  'DM Sans', 'Manrope', 'Plus Jakarta Sans', 'Lexend',
  'IBM Plex Sans', 'Source Sans 3', 'Noto Sans', 'Figtree', 'Urbanist',
  'Josefin Sans', 'Exo 2', 'Kanit', 'Titillium Web', 'Cabin',
  'Mulish', 'Karla', 'Asap', 'Overpass', 'Red Hat Display',
  // ── Serif ──
  'Playfair Display', 'Merriweather', 'Lora', 'Cinzel', 'Cormorant Garamond',
  'EB Garamond', 'Libre Baskerville', 'Bitter', 'Crimson Text', 'Noto Serif',
  'DM Serif Display', 'Zilla Slab', 'Rokkitt', 'Spectral', 'Source Serif 4',
  // ── Display / Impact ──
  'Bebas Neue', 'Anton', 'Righteous', 'Bangers', 'Bungee',
  'Black Ops One', 'Russo One', 'Orbitron', 'Audiowide', 'Monoton',
  'Creepster', 'Press Start 2P', 'Fugaz One', 'Passion One', 'Bowlby One SC',
  'Bungee Shade', 'Faster One', 'Rampart One', 'Nabla', 'Silkscreen',
  'Alfa Slab One', 'Archivo Black', 'Teko', 'Saira Stencil One', 'Secular One',
  'Staatliches', 'Francois One', 'Jockey One', 'Changa One', 'Coda',
  'Graduate', 'Baumans', 'Michroma', 'Megrim', 'Iceland',
  // ── Handwriting / Script ──
  'Pacifico', 'Permanent Marker', 'Lobster', 'Dancing Script', 'Caveat',
  'Satisfy', 'Great Vibes', 'Sacramento', 'Kaushan Script', 'Cookie',
  'Yellowtail', 'Allura', 'Alex Brush', 'Tangerine', 'Pinyon Script',
  'Rock Salt', 'Indie Flower', 'Shadows Into Light', 'Amatic SC', 'Gloria Hallelujah',
  'Patrick Hand', 'Architects Daughter', 'Covered By Your Grace', 'Just Another Hand', 'Reenie Beanie',
  // ── Monospace ──
  'Fira Code', 'JetBrains Mono', 'Space Mono', 'Inconsolata', 'IBM Plex Mono',
  // ── System fallback ──
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Impact',
  'Courier New', 'Verdana',
];

interface TextToolbarProps {
  layer: TextLayer;
}

type PopoverName = 'editText' | 'effects' | 'align' | 'case' | 'arrange' | 'position' | 'transform' | null;

export function TextToolbar({ layer }: TextToolbarProps) {
  const [activePopover, setActivePopover] = useState<PopoverName>(null);
  const updateLayer = useEditorStore((s) => s.updateLayer);
  const duplicateLayer = useEditorStore((s) => s.duplicateLayer);
  const removeLayer = useEditorStore((s) => s.removeLayer);
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

  // Preload a small set of popular fonts; the rest load on selection.
  useEffect(() => {
    FONT_OPTIONS.slice(0, 15).forEach(loadGoogleFont);
    loadGoogleFont(layer.fontFamily);
  }, []);

  useEffect(() => {
    loadGoogleFont(layer.fontFamily);
  }, [layer.fontFamily]);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
      <select
        style={{ ...selectStyle, fontFamily: layer.fontFamily }}
        value={layer.fontFamily}
        onChange={(e) => { loadGoogleFont(e.target.value); updateLayer(layer.id, { fontFamily: e.target.value }); }}
      >
        {FONT_OPTIONS.map((f) => (
          <option key={f} value={f} style={{ fontFamily: f }}>{f}</option>
        ))}
      </select>

      {/*
        Font size in MILLIMETERS — the canonical unit. Range 2-200mm covers
        everything from tiny labels to full-shirt slogans. Step 0.5 lets users
        fine-tune below 1mm increments without overwhelming the input.
      */}
      {/*
        Font size input. Internal unit is millimeters but we don't surface
        that to users — most people associate "font size" with an opaque
        number (Word, Quill, Google Docs all do this), so showing "mm" just
        adds friction. The number scales linearly with the visible text so
        the relationship stays intuitive.
      */}
      <input
        type="number"
        value={Math.round(layer.fontSize * 10) / 10}
        min={2}
        max={200}
        step={0.5}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!isNaN(v) && v > 0) updateLayer(layer.id, { fontSize: v });
        }}
        title={t('Font size')}
        style={{
          width: 56,
          padding: '4px 6px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#ccc',
          borderRadius: 4,
          fontSize: 12,
          background: '#fff',
        }}
      />

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
