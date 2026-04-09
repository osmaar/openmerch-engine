import { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';

const TEXT_EFFECTS = [
  { type: 'none' as const, label: 'Normal', image: '/assets/text-effects/normal.svg' },
  { type: 'curved' as const, label: 'Curved', image: '/assets/text-effects/curved.svg' },
  { type: 'wave' as const, label: 'Oblique', image: '/assets/text-effects/oblique.svg' },
];

// Google Fonts — curated for t-shirt design (shown by default)
const FEATURED_FONTS = [
  'Oswald', 'Bebas Neue', 'Anton', 'Pacifico', 'Permanent Marker',
  'Righteous', 'Bangers', 'Bungee', 'Creepster', 'Press Start 2P',
  'Black Ops One', 'Russo One', 'Orbitron', 'Audiowide', 'Monoton',
  'Lobster', 'Dancing Script', 'Caveat', 'Satisfy', 'Great Vibes',
  'Playfair Display', 'Merriweather', 'Lora', 'Cinzel', 'Cormorant Garamond',
  'Montserrat', 'Raleway', 'Poppins', 'Quicksand', 'Comfortaa',
];

// Extended list for search
const ALL_FONTS = [
  ...FEATURED_FONTS,
  'Roboto', 'Open Sans', 'Lato', 'Inter', 'Nunito', 'Rubik', 'Work Sans',
  'Fira Sans', 'Ubuntu', 'Kanit', 'Josefin Sans', 'Dosis', 'Titillium Web',
  'Archivo', 'Barlow', 'Cabin', 'Exo 2', 'Karla', 'Mukta', 'Noto Sans',
  'Overpass', 'Signika', 'Varela Round', 'Yanone Kaffeesatz', 'Abel',
  'Abril Fatface', 'Alfa Slab One', 'Amatic SC', 'Archivo Black',
  'Arvo', 'Asap', 'Baloo 2', 'Bitter', 'Bree Serif', 'Cardo',
  'Catamaran', 'Chakra Petch', 'Chivo', 'Concert One', 'Courgette',
  'Crete Round', 'Crimson Text', 'DM Sans', 'DM Serif Display',
  'EB Garamond', 'Exo', 'Fjalla One', 'Francois One', 'Fredoka One',
  'Gloria Hallelujah', 'Gochi Hand', 'Gruppo', 'Handlee', 'Hind',
  'IBM Plex Sans', 'Inconsolata', 'Indie Flower', 'Josefin Slab',
  'Kalam', 'Kaushan Script', 'Libre Baskerville', 'Lilita One',
  'Maven Pro', 'Merienda', 'Neuton', 'Noto Serif', 'Nunito Sans',
  'Old Standard TT', 'Outfit', 'Oxygen', 'PT Sans', 'PT Serif',
  'Patrick Hand', 'Philosopher', 'Play', 'Poetsen One', 'Prompt',
  'Rajdhani', 'Recursive', 'Rokkitt', 'Saira', 'Shadows Into Light',
  'Source Code Pro', 'Source Sans 3', 'Space Grotesk', 'Space Mono',
  'Special Elite', 'Spectral', 'Teko', 'Titan One', 'Unbounded',
  'Vollkorn', 'Zilla Slab',
];

const loadedFonts = new Set<string>();
const loadedCustomFonts = new Set<string>();

function loadGoogleFont(fontName: string) {
  if (loadedFonts.has(fontName)) return;
  loadedFonts.add(fontName);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}&display=swap`;
  document.head.appendChild(link);
}

function loadCustomFont(name: string, url: string) {
  if (loadedCustomFonts.has(name)) return;
  loadedCustomFonts.add(name);
  const face = new FontFace(name, `url(${url})`);
  face.load().then((loaded) => { document.fonts.add(loaded); }).catch(() => {});
}

interface AdminFont {
  id: string;
  name: string;
  fileUrl: string | null;
  isGoogle: boolean;
}

const API_BASE = (typeof window !== 'undefined' && window.location.port === '3000') ? 'http://localhost:3001' : '';

export function TextTab() {
  const t = useT();
  const { addTextLayer, updateLayer, selectLayer } = useEditorStore();
  // Track selectedLayerId directly so Zustand re-renders on selection changes.
  const hasTextSelected = useEditorStore((s) => {
    if (!s.selectedLayerId || !s.design) return false;
    const zone = s.design.zones[s.activeZoneId];
    const layer = zone?.layers.find((l) => l.id === s.selectedLayerId);
    return layer?.type === 'text';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [adminFonts, setAdminFonts] = useState<AdminFont[]>([]);

  useEffect(() => {
    FEATURED_FONTS.forEach(loadGoogleFont);
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/fonts`)
      .then((r) => r.json())
      .then((data: { id: string; name: string; fileUrl: string | null; isGoogle: boolean; active: boolean }[]) => {
        const active = data.filter((f) => f.active);
        setAdminFonts(active.map((f) => ({ id: f.id, name: f.name, fileUrl: f.fileUrl, isGoogle: f.isGoogle })));
        // Preload font faces
        active.forEach((f) => {
          if (f.isGoogle) {
            loadGoogleFont(f.name);
          } else if (f.fileUrl) {
            const url = f.fileUrl.startsWith('/') ? `${API_BASE}${f.fileUrl}` : f.fileUrl;
            loadCustomFont(f.name, url);
          }
        });
      })
      .catch(() => setAdminFonts([]));
  }, []);

  // Read fresh selected layer at click-time — the rendered `selectedLayer`
  // can be stale if TextTab didn't re-render after a canvas selection.
  const getSelected = () => {
    const s = useEditorStore.getState();
    const sel = s.getSelectedLayer();
    return sel?.type === 'text' ? sel : null;
  };

  // If a text layer is selected, apply effect to it; otherwise create new
  const applyOrAddEffect = (effectType: 'none' | 'curved' | 'wave') => {
    const sel = getSelected();
    if (sel) {
      // Preserve existing effect values — only change the type.
      const existing = sel.textEffect ?? { type: 'none', radius: 200, spacing: 0, curve: 0, height: 0, offset: 0 };
      updateLayer(sel.id, {
        textEffect: { ...existing, type: effectType },
      });
      return;
    }
    addTextLayer();
    const state = useEditorStore.getState();
    const zone = state.design?.zones[state.activeZoneId];
    if (!zone) return;
    const lastLayer = zone.layers[zone.layers.length - 1];
    if (!lastLayer) return;
    if (effectType !== 'none') {
      updateLayer(lastLayer.id, {
        textEffect: { type: effectType, radius: 200, spacing: 0, curve: 0, height: 0, offset: 0 },
      });
    }
    selectLayer(lastLayer.id);
  };

  // If a text layer is selected, change its font; otherwise create new with font
  const applyOrAddFont = (fontFamily: string, fontId?: string) => {
    loadGoogleFont(fontFamily);
    const update = fontId ? { fontFamily, fontId } : { fontFamily, fontId: undefined };
    const sel = getSelected();
    if (sel) {
      updateLayer(sel.id, update);
      return;
    }
    addTextLayer();
    const state = useEditorStore.getState();
    const zone = state.design?.zones[state.activeZoneId];
    if (!zone) return;
    const lastLayer = zone.layers[zone.layers.length - 1];
    if (!lastLayer) return;
    updateLayer(lastLayer.id, update);
    selectLayer(lastLayer.id);
  };

  // Local filtering — no API call needed
  const filteredFonts = searchQuery.trim()
    ? ALL_FONTS.filter((f) => f.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 20)
    : [];

  // Load search results fonts
  useEffect(() => {
    filteredFonts.forEach(loadGoogleFont);
  }, [searchQuery]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('Add Text')}</div>

      {/* Text effect tiles — applies to selected text or creates new */}
      {hasTextSelected && (
        <div style={{ fontSize: 10, color: '#4A90D9', fontWeight: 500 }}>{t('Text selected — click to change effect/font')}</div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {TEXT_EFFECTS.map((effect) => (
          <button
            key={effect.type}
            onClick={() => applyOrAddEffect(effect.type)}
            title={t(effect.label)}
            style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              padding: 6, borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0',
              borderRadius: 6, background: '#fff', cursor: 'pointer',
            }}
          >
            <img src={effect.image} alt={t(effect.label)} style={{ width: '100%', height: 50, objectFit: 'contain' }} />
          </button>
        ))}
      </div>

      {/* Font search — local filtering, no API */}
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 8px', borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 6,
        }}>
          <Search size={14} color="#aaa" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('Search fonts...')}
            style={{ flex: 1, borderWidth: 0, outline: 'none', fontSize: 12 }}
          />
        </div>
      </div>

      {/* Search results */}
      {filteredFonts.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 200, overflowY: 'auto' }}>
          {filteredFonts.map((font) => (
            <button
              key={font}
              onClick={() => applyOrAddFont(font)}
              style={{
                padding: '8px 10px', borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0',
                borderRadius: 6, background: '#fff', cursor: 'pointer', textAlign: 'left',
                fontFamily: font, fontSize: 14, color: '#333',
              }}
            >
              {font}
            </button>
          ))}
        </div>
      )}

      {/* Merchant fonts library */}
      {adminFonts.length > 0 && filteredFonts.length === 0 && (
        <>
          <div style={{ fontSize: 10, color: '#bbb', fontWeight: 600 }}>{t('COLLECTION')} ({adminFonts.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
            {adminFonts.map((font) => (
              <button
                key={font.id}
                onClick={() => applyOrAddFont(font.name, font.id)}
                title={font.name}
                style={{
                  padding: '7px 5px', borderWidth: 1, borderStyle: 'solid', borderColor: '#4A90D9',
                  borderRadius: 6, background: '#EBF2FA', cursor: 'pointer', textAlign: 'center',
                  fontFamily: font.name, fontSize: 12, color: '#333',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {font.name}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Default fonts grid */}
      {filteredFonts.length === 0 && (
        <>
          <div style={{ fontSize: 10, color: '#bbb' }}>{t('Popular for t-shirt design')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 5 }}>
            {FEATURED_FONTS.map((font) => (
              <button
                key={font}
                onClick={() => applyOrAddFont(font)}
                title={font}
                style={{
                  padding: '7px 5px', borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0',
                  borderRadius: 6, background: '#fff', cursor: 'pointer', textAlign: 'center',
                  fontFamily: font, fontSize: 12, color: '#333',
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}
              >
                {font}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
