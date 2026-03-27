import { useEditorStore } from '../../../store/editorStore.js';

const TEXT_EFFECTS = [
  { type: 'none' as const, label: 'Normal', image: '/assets/text-effects/normal.svg' },
  { type: 'curved' as const, label: 'Curved', image: '/assets/text-effects/curved.svg' },
  { type: 'wave' as const, label: 'Oblique', image: '/assets/text-effects/oblique.svg' },
];

const FONT_PRESETS = [
  'Arial', 'Helvetica', 'Georgia', 'Times New Roman', 'Impact',
  'Courier New', 'Verdana', 'Comic Sans MS', 'Trebuchet MS', 'Palatino',
];

export function TextTab() {
  const { addTextLayer, updateLayer, selectLayer } = useEditorStore();

  const addWithEffect = (effectType: 'none' | 'curved' | 'wave') => {
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>Add Text</div>

      {/* Text effect styles as image tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
        {TEXT_EFFECTS.map((effect) => (
          <button
            key={effect.type}
            onClick={() => addWithEffect(effect.type)}
            title={effect.label}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 4,
              padding: 6,
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#e0e0e0',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
            }}
          >
            <img
              src={effect.image}
              alt={effect.label}
              style={{ width: '100%', height: 50, objectFit: 'contain' }}
            />
          </button>
        ))}
      </div>

      {/* Font presets */}
      <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>Fonts</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
        {FONT_PRESETS.map((font) => (
          <button
            key={font}
            onClick={() => addTextLayer()}
            title={`Add text with ${font}`}
            style={{
              padding: '8px 6px',
              borderWidth: 1,
              borderStyle: 'solid',
              borderColor: '#e0e0e0',
              borderRadius: 6,
              background: '#fff',
              cursor: 'pointer',
              textAlign: 'center',
              fontFamily: font,
              fontSize: 13,
              color: '#333',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {font}
          </button>
        ))}
      </div>
    </div>
  );
}
