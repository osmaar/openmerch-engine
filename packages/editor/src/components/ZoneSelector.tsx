import type { ProductZone } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';

interface ZoneSelectorProps {
  zones: ProductZone[];
}

export function ZoneSelector({ zones }: ZoneSelectorProps) {
  const { activeZoneId, setActiveZone } = useEditorStore();

  return (
    <div style={{ display: 'flex', gap: 8 }}>
      {zones.map((zone) => (
        <button
          key={zone.id}
          onClick={() => setActiveZone(zone.id)}
          style={{
            padding: '8px 20px',
            border: activeZoneId === zone.id ? '2px solid #4A90D9' : '2px solid #ccc',
            borderRadius: 6,
            background: activeZoneId === zone.id ? '#EBF2FA' : '#fff',
            color: activeZoneId === zone.id ? '#4A90D9' : '#666',
            fontWeight: activeZoneId === zone.id ? 600 : 400,
            cursor: 'pointer',
            fontSize: 14,
          }}
        >
          {zone.name}
        </button>
      ))}
    </div>
  );
}
