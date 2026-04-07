import { ChevronUp, ChevronDown } from 'lucide-react';
import type { Product } from '@openmerch/core';
import { useEditorStore } from '../store/editorStore.js';
import { useT } from '../i18n/useTranslation.js';

interface StageNavigatorProps {
  product: Product;
}

export function StageNavigator({ product }: StageNavigatorProps) {
  const { activeZoneId, setActiveZone, productColor } = useEditorStore();
  const t = useT();

  const zones = product.zones;
  const activeIndex = zones.findIndex((z) => z.id === activeZoneId);
  const total = zones.length;

  const goPrev = () => {
    if (activeIndex > 0) {
      setActiveZone(zones[activeIndex - 1]!.id);
    }
  };

  const goNext = () => {
    if (activeIndex < total - 1) {
      setActiveZone(zones[activeIndex + 1]!.id);
    }
  };

  const navBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    padding: '4px 0',
    borderWidth: 0,
    background: 'rgba(0,0,0,0.03)',
    cursor: 'pointer',
    color: '#888',
  };

  const thumbStyle = (isActive: boolean): React.CSSProperties => ({
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2,
    padding: 4,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: isActive ? '#4A90D9' : 'transparent',
    borderRadius: 6,
    background: isActive ? 'rgba(74,144,217,0.08)' : 'transparent',
    cursor: 'pointer',
  });

  return (
    <div
      style={{
        position: 'absolute',
        right: 12,
        top: '50%',
        transform: 'translateY(-50%)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        background: '#fff',
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: '#e0e0e0',
        borderRadius: 8,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
        overflow: 'hidden',
        width: 72,
      }}
    >
      {/* Prev button */}
      <button
        style={{ ...navBtn, opacity: activeIndex > 0 ? 1 : 0.3 }}
        onClick={goPrev}
        disabled={activeIndex <= 0}
        title={activeIndex > 0 ? `${t(zones[activeIndex - 1]!.name)} (${activeIndex}/${total})` : ''}
      >
        <ChevronUp size={16} />
      </button>

      {/* Zone thumbnails */}
      {zones.map((zone, idx) => {
        const isActive = zone.id === activeZoneId;
        return (
          <div
            key={zone.id}
            style={thumbStyle(isActive)}
            onClick={() => setActiveZone(zone.id)}
            title={`${t(zone.name)} (${idx + 1}/${total})`}
          >
            <div style={{
              width: 44,
              height: 52,
              borderRadius: 4,
              background: '#f0f0f0',
              borderBottomWidth: 3,
              borderBottomStyle: 'solid',
              borderBottomColor: productColor === '#FFFFFF' ? '#ddd' : productColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
            }}>
              <img
                src={zone.baseImageUrl}
                alt={zone.name}
                style={{ width: 40, height: 48, objectFit: 'contain' }}
              />
            </div>
            <span style={{
              fontSize: 9,
              color: isActive ? '#4A90D9' : '#888',
              fontWeight: isActive ? 600 : 400,
            }}>
              {t(zone.name)} ({idx + 1}/{total})
            </span>
          </div>
        );
      })}

      {/* Next button */}
      <button
        style={{ ...navBtn, opacity: activeIndex < total - 1 ? 1 : 0.3 }}
        onClick={goNext}
        disabled={activeIndex >= total - 1}
        title={activeIndex < total - 1 ? `${t(zones[activeIndex + 1]!.name)} (${activeIndex + 2}/${total})` : ''}
      >
        <ChevronDown size={16} />
      </button>
    </div>
  );
}
