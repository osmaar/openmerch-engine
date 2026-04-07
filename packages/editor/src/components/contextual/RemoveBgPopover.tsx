import { useState, useRef, useEffect, useCallback } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useT } from '../../i18n/useTranslation.js';

interface RemoveBgPopoverProps {
  imageSrc: string;
  onApply: (processedSrc: string) => void;
  onClose: () => void;
}

type BgMode = 'light' | 'dark';

export function RemoveBgPopover({ imageSrc, onApply, onClose }: RemoveBgPopoverProps) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [threshold, setThreshold] = useState(100);
  const [mode, setMode] = useState<BgMode>('light');

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImgEl(img);
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
        if (brightness > 255 - threshold) {
          data[i + 3] = 0;
        }
      } else {
        if (brightness < threshold) {
          data[i + 3] = 0;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    return offscreen;
  }, [imgEl, threshold, mode]);

  // Draw preview at full modal size
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Scale to fit the modal preview area
    const maxW = 500;
    const maxH = 400;
    const scale = Math.min(1, maxW / imgEl.width, maxH / imgEl.height);
    const w = imgEl.width * scale;
    const h = imgEl.height * scale;
    canvas.width = w;
    canvas.height = h;

    // Checkerboard background
    const tileSize = 10;
    for (let y = 0; y < h; y += tileSize) {
      for (let x = 0; x < w; x += tileSize) {
        const isEven = (Math.floor(x / tileSize) + Math.floor(y / tileSize)) % 2 === 0;
        ctx.fillStyle = isEven ? '#e0e0e0' : '#fff';
        ctx.fillRect(x, y, tileSize, tileSize);
      }
    }

    const processed = processImage();
    if (processed) {
      ctx.drawImage(processed, 0, 0, w, h);
    }
  }, [imgEl, threshold, mode, processImage]);

  const handleApply = () => {
    const processed = processImage();
    if (processed) {
      onApply(processed.toDataURL('image/png'));
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
    }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: '#fff',
        borderRadius: 12,
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
        width: '90%',
        maxWidth: 600,
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 18px',
          borderBottomWidth: 1,
          borderBottomStyle: 'solid',
          borderBottomColor: '#eee',
        }}>
          <span style={{ fontWeight: 600, fontSize: 15, color: '#333' }}>{t('Remove Background')}</span>
          <button onClick={onClose} style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 4, display: 'flex' }}>
            <X size={18} />
          </button>
        </div>

        {/* Preview */}
        <div style={{
          flex: 1,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: 20,
          background: '#fafafa',
          minHeight: 300,
        }}>
          <canvas ref={canvasRef} style={{ display: 'block', borderRadius: 6, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }} />
        </div>

        {/* Controls */}
        <div style={{
          padding: '16px 18px',
          borderTopWidth: 1,
          borderTopStyle: 'solid',
          borderTopColor: '#eee',
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
        }}>
          {/* Info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', background: '#FFF8E1', borderRadius: 6, fontSize: 11, color: '#F57F17' }}>
            <AlertTriangle size={14} />
            {t('Basic removal — AI-powered removal coming soon with backend integration')}
          </div>

          {/* Mode */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#555', minWidth: 50 }}>{t('Mode')}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              {(['light', 'dark'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  style={{
                    padding: '6px 16px',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: mode === m ? '#4A90D9' : '#ddd',
                    borderRadius: 6,
                    background: mode === m ? '#EBF2FA' : '#fff',
                    color: mode === m ? '#4A90D9' : '#555',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: mode === m ? 600 : 400,
                  }}
                >
                  {m === 'light' ? t('Light Background') : t('Dark Background')}
                </button>
              ))}
            </div>
          </div>

          {/* Threshold */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#555', minWidth: 50 }}>{t('Deep')}</span>
            <input
              type="range"
              min={0}
              max={200}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              style={{ flex: 1, cursor: 'pointer' }}
            />
            <span style={{ fontSize: 12, color: '#888', minWidth: 30, textAlign: 'right' }}>{threshold}</span>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <button
              onClick={onClose}
              style={{
                padding: '8px 18px',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: '#ddd',
                borderRadius: 6,
                background: '#fff',
                color: '#666',
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {t('Cancel')}
            </button>
            <button
              onClick={handleApply}
              style={{
                padding: '8px 18px',
                borderWidth: 0,
                borderRadius: 6,
                background: '#4A90D9',
                color: '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: 500,
              }}
            >
              {t('Apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
