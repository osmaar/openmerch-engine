import {
  Square, Circle, Triangle, Star, Pentagon, Hexagon,
  Diamond, Plus, RectangleHorizontal,
} from 'lucide-react';
import type { ShapeLayer } from '@openmerch/core';
import { useEditorStore } from '../../../store/editorStore.js';

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

export function ShapesTab() {
  const { addShapeLayer } = useEditorStore();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>Shapes</div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
        {SHAPES.map((shape) => {
          const Icon = shape.icon;
          return (
            <button
              key={shape.type}
              onClick={() => addShapeLayer(shape.type)}
              title={shape.label}
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
              <span style={{ fontSize: 9, color: '#888' }}>{shape.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 10, color: '#ccc', textAlign: 'center' }}>
        Click to add shape to canvas
      </div>
    </div>
  );
}
