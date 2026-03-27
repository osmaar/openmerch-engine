import { Minus, Plus, Locate } from 'lucide-react';
import type Konva from 'konva';

interface ZoomControlsProps {
  stageRef: React.RefObject<Konva.Stage | null>;
  zoom: number;
  setZoom: (z: number) => void;
}

export function ZoomControls({ stageRef, zoom, setZoom }: ZoomControlsProps) {
  const applyZoom = (newScale: number) => {
    const stage = stageRef.current;
    if (!stage) return;

    const clampedScale = Math.max(0.3, Math.min(5, newScale));

    // Zoom towards center of viewport
    const centerX = stage.width() / 2;
    const centerY = stage.height() / 2;

    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: (centerX - stage.x()) / oldScale,
      y: (centerY - stage.y()) / oldScale,
    };

    stage.scale({ x: clampedScale, y: clampedScale });

    const newPos = {
      x: centerX - mousePointTo.x * clampedScale,
      y: centerY - mousePointTo.y * clampedScale,
    };
    stage.position(newPos);
    setZoom(clampedScale);
  };

  const handleZoomIn = () => applyZoom(zoom * 1.15);
  const handleZoomOut = () => applyZoom(zoom / 1.15);

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    applyZoom(Number(e.target.value) / 100);
  };

  const handleReset = () => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.scale({ x: 1, y: 1 });
    stage.position({ x: 0, y: 0 });
    setZoom(1);
  };

  const btnStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 28,
    height: 28,
    borderWidth: 0,
    borderRadius: 4,
    background: 'transparent',
    cursor: 'pointer',
    color: '#666',
    padding: 0,
  };

  const isZoomed = Math.abs(zoom - 1) > 0.01;

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 12,
        right: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        gap: 4,
      }}
    >
      {/* Reset button — only visible when zoomed/panned */}
      {isZoomed && (
        <button
          onClick={handleReset}
          title="Reset view — center canvas"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '6px 10px',
            borderWidth: 1,
            borderStyle: 'solid',
            borderColor: '#e0e0e0',
            borderRadius: 6,
            background: '#fff',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            cursor: 'pointer',
            color: '#4A90D9',
            fontSize: 11,
            fontWeight: 500,
          }}
        >
          <Locate size={14} />
          Reset view
        </button>
      )}

      {/* Zoom slider */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          background: '#fff',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#e0e0e0',
          borderRadius: 8,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          padding: '4px 8px',
        }}
      >
      <button style={btnStyle} onClick={handleZoomOut} title="Zoom out">
        <Minus size={14} />
      </button>

      <input
        type="range"
        min={30}
        max={500}
        value={Math.round(zoom * 100)}
        onChange={handleSlider}
        style={{ width: 80, cursor: 'pointer' }}
        title={`${Math.round(zoom * 100)}%`}
      />

      <button style={btnStyle} onClick={handleZoomIn} title="Zoom in">
        <Plus size={14} />
      </button>

      <span style={{ fontSize: 10, color: '#888', minWidth: 28, textAlign: 'center' }}>
        {Math.round(zoom * 100)}%
      </span>
      </div>
    </div>
  );
}
