import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface RemoveBgPopoverProps {
  imageSrc: string;
  onApply: (processedSrc: string) => void;
  onClose: () => void;
}

type BgMode = 'light' | 'dark';

export function RemoveBgPopover({ imageSrc, onApply, onClose }: RemoveBgPopoverProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [threshold, setThreshold] = useState(100);
  const [mode, setMode] = useState<BgMode>('light');
  const [previewScale, setPreviewScale] = useState(1);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      setImgEl(img);
      const scale = Math.min(1, 240 / img.width, 180 / img.height);
      setPreviewScale(scale);
    };
    img.src = imageSrc;
  }, [imageSrc]);

  const processImage = useCallback(() => {
    if (!imgEl) return null;

    const offscreen = document.createElement('canvas');
    offscreen.width = imgEl.width;
    offscreen.height = imgEl.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return null;

    ctx.drawImage(imgEl, 0, 0);
    const imageData = ctx.getImageData(0, 0, offscreen.width, offscreen.height);
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!;
      const g = data[i + 1]!;
      const b = data[i + 2]!;
      const brightness = (r + g + b) / 3;

      if (mode === 'light') {
        // Remove light background: pixels brighter than threshold become transparent
        if (brightness > 255 - threshold) {
          data[i + 3] = 0;
        }
      } else {
        // Remove dark background: pixels darker than threshold become transparent
        if (brightness < threshold) {
          data[i + 3] = 0;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return offscreen;
  }, [imgEl, threshold, mode]);

  // Draw preview
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = imgEl.width * previewScale;
    const h = imgEl.height * previewScale;
    canvas.width = w;
    canvas.height = h;

    // Checkerboard background to show transparency
    const tileSize = 8;
    for (let y = 0; y < h; y += tileSize) {
      for (let x = 0; x < w; x += tileSize) {
        const isEven = ((x / tileSize) + (y / tileSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#e0e0e0' : '#fff';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    // Process and draw
    const processed = processImage();
    if (processed) {
      ctx.drawImage(processed, 0, 0, w, h);
    }
  }, [imgEl, threshold, mode, previewScale, processImage]);

  const handleApply = () => {
    const processed = processImage();
    if (processed) {
      onApply(processed.toDataURL('image/png'));
    }
  };

  const popoverStyle: React.CSSProperties = {
    position: 'absolute',
    top: '100%',
    left: '50%',
    transform: 'translateX(-50%)',
    marginTop: 6,
    background: '#fff',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#e0e0e0',
    borderRadius: 10,
    boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    padding: 14,
    zIndex: 100,
    width: 280,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const modeBtn = (m: BgMode): React.CSSProperties => ({
    padding: '5px 12px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: mode === m ? '#4A90D9' : '#ccc',
    borderRadius: 5,
    background: mode === m ? '#EBF2FA' : '#fff',
    color: mode === m ? '#4A90D9' : '#555',
    cursor: 'pointer',
    fontSize: 12,
    fontWeight: mode === m ? 600 : 400,
  });

  const applyBtn: React.CSSProperties = {
    padding: '6px 14px',
    borderWidth: 0,
    borderRadius: 6,
    background: '#4A90D9',
    color: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: 500,
  };

  return (
    <div style={popoverStyle}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>Remove Background</span>
        <button
          onClick={onClose}
          style={{
            background: 'none',
            borderWidth: 0,
            cursor: 'pointer',
            color: '#999',
            padding: 2,
            display: 'flex',
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Preview */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          background: '#f5f5f5',
          borderRadius: 6,
          padding: 8,
        }}
      >
        <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 4 }} />
      </div>

      {/* Mode */}
      <div style={{ display: 'flex', gap: 6 }}>
        <button style={modeBtn('light')} onClick={() => setMode('light')}>
          Light BG
        </button>
        <button style={modeBtn('dark')} onClick={() => setMode('dark')}>
          Dark BG
        </button>
      </div>

      {/* Threshold slider */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap' }}>Threshold</span>
        <input
          type="range"
          min={0}
          max={200}
          value={threshold}
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ flex: 1, cursor: 'pointer' }}
        />
        <span style={{ fontSize: 12, color: '#666', minWidth: 28, textAlign: 'right' }}>{threshold}</span>
      </div>

      {/* Apply */}
      <button style={applyBtn} onClick={handleApply}>
        Apply
      </button>
    </div>
  );
}
