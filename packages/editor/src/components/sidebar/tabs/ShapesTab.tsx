import { useState, useEffect } from 'react';
import {
  Square, Circle, Triangle, Star, Pentagon, Hexagon,
  Diamond, Plus, RectangleHorizontal,
} from 'lucide-react';
import type { ShapeLayer } from '@openmerch/core';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';

const SHAPES: { type: ShapeLayer['shapeType']; label: string; icon: typeof Square }[] = [
  { type: 'rect', label: 'Rectangle', icon: Square },
  { type: 'rounded-rect', label: 'Rounded', icon: RectangleHorizontal },
  { type: 'circle', label: 'Circle', icon: Circle },
  { type: 'triangle', label: 'Triangle', icon: Triangle },
  { type: 'star', label: 'Star', icon: Star },
  { type: 'diamond', label: 'Diamond', icon: Diamond },
  { type: 'pentagon', label: 'Pentagon', icon: Pentagon },
  { type: 'hexagon', label: 'Hexagon', icon: Hexagon },
  { type: 'cross', label: 'Cross', icon: Plus },
];

interface AdminShape {
  id: string;
  name: string;
  svgContent: string;
}

const API_BASE = (typeof window !== 'undefined' && window.location.port === '3000') ? 'http://localhost:3001' : '';

export function ShapesTab() {
  const t = useT();
  const { addShapeLayer, addImageLayer } = useEditorStore();
  const [adminShapes, setAdminShapes] = useState<AdminShape[]>([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/v1/shapes`)
      .then((r) => r.json())
      .then((data: { id: string; name: string; svgContent: string; active: boolean }[]) => {
        setAdminShapes(data.filter((s) => s.active && s.svgContent).map((s) => ({ id: s.id, name: s.name, svgContent: s.svgContent })));
      })
      .catch(() => setAdminShapes([]));
  }, []);

  const normalizeSvg = (svg: string): string => {
    // Replace currentColor with black so it renders in img tags
    let normalized = svg.replace(/currentColor/g, '#000000');
    // Ensure svg has width/height or viewBox so it scales properly
    if (!normalized.includes('viewBox') && !normalized.includes('width=')) {
      normalized = normalized.replace('<svg', '<svg viewBox="0 0 100 100"');
    }
    return normalized;
  };

  const addAdminShape = (svg: string) => {
    const normalized = normalizeSvg(svg);
    const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(normalized)));
    const img = new window.Image();
    img.onload = () => addImageLayer(dataUrl, img.width || 200, img.height || 200);
    img.src = dataUrl;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('Shapes')}</div>

      {/* Merchant collection */}
      {adminShapes.length > 0 && (
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: 12 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#666', marginBottom: 6 }}>{t('COLLECTION')} ({adminShapes.length})</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {adminShapes.map((s) => (
              <button
                key={s.id}
                onClick={() => addAdminShape(s.svgContent)}
                title={s.name}
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 6, borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0', borderRadius: 6, background: '#fff', cursor: 'pointer', aspectRatio: '1' }}
              >
                <img
                  src={'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(normalizeSvg(s.svgContent))))}
                  alt={s.name}
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              </button>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {SHAPES.map((shape) => {
          const Icon = shape.icon;
          return (
            <button
              key={shape.type}
              onClick={() => addShapeLayer(shape.type)}
              title={t(shape.label)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: 10,
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#e0e0e0',
                borderRadius: 8,
                background: '#fff',
                cursor: 'pointer',
                aspectRatio: '1',
              }}
            >
              <Icon size={26} color="#4A90D9" strokeWidth={1.5} />
              <span style={{ fontSize: 9, color: '#888' }}>{t(shape.label)}</span>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center' }}>
        {t('Click to add shape to canvas')}
      </div>
    </div>
  );
}
