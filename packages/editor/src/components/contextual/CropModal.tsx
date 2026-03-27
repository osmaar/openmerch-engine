import { useState, useRef, useCallback, useEffect } from 'react';
import {
  AlignCenterHorizontal,
  AlignCenterVertical,
  Maximize,
  Square,
} from 'lucide-react';

interface CropModalProps {
  imageSrc: string;
  onCrop: (croppedSrc: string) => void;
  onCancel: () => void;
}

interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type DragMode = 'create' | 'move' | 'resize-tl' | 'resize-tr' | 'resize-bl' | 'resize-br';

const HANDLE_RADIUS = 12; // hit area in image-space pixels

function getCornerHit(pos: { x: number; y: number }, crop: CropRect): DragMode | null {
  const corners: [number, number, DragMode][] = [
    [crop.x, crop.y, 'resize-tl'],
    [crop.x + crop.width, crop.y, 'resize-tr'],
    [crop.x, crop.y + crop.height, 'resize-bl'],
    [crop.x + crop.width, crop.y + crop.height, 'resize-br'],
  ];

  for (const [cx, cy, mode] of corners) {
    if (Math.abs(pos.x - cx) < HANDLE_RADIUS && Math.abs(pos.y - cy) < HANDLE_RADIUS) {
      return mode;
    }
  }
  return null;
}

export function CropModal({ imageSrc, onCrop, onCancel }: CropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [displayScale, setDisplayScale] = useState(1);
  const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragMode, setDragMode] = useState<DragMode>('create');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<CropRect>({ x: 0, y: 0, width: 0, height: 0 });
  const [cursorStyle, setCursorStyle] = useState('crosshair');

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      setImgEl(img);

      const maxW = 560;
      const maxH = 440;
      const scale = Math.min(1, maxW / img.width, maxH / img.height);
      setDisplayScale(scale);

      const cw = img.width * 0.8;
      const ch = img.height * 0.8;
      setCrop({
        x: (img.width - cw) / 2,
        y: (img.height - ch) / 2,
        width: cw,
        height: ch,
      });
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Draw
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imgEl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = imgEl.width * displayScale;
    const h = imgEl.height * displayScale;
    canvas.width = w;
    canvas.height = h;

    ctx.drawImage(imgEl, 0, 0, w, h);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillRect(0, 0, w, h);

    const cx = crop.x * displayScale;
    const cy = crop.y * displayScale;
    const cw = crop.width * displayScale;
    const ch = crop.height * displayScale;

    ctx.clearRect(cx, cy, cw, ch);
    ctx.drawImage(imgEl, crop.x, crop.y, crop.width, crop.height, cx, cy, cw, ch);

    ctx.strokeStyle = '#4A90D9';
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(cx, cy, cw, ch);

    // Corner handles
    const hs = 10;
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#4A90D9';
    ctx.lineWidth = 2;
    for (const [hx, hy] of [[cx, cy], [cx + cw, cy], [cx, cy + ch], [cx + cw, cy + ch]]) {
      ctx.beginPath();
      ctx.arc(hx!, hy!, hs / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }

    // Rule of thirds
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + (cw * i) / 3, cy);
      ctx.lineTo(cx + (cw * i) / 3, cy + ch);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(cx, cy + (ch * i) / 3);
      ctx.lineTo(cx + cw, cy + (ch * i) / 3);
      ctx.stroke();
    }

    // Dimensions label inside crop area
    if (cw > 60 && ch > 30) {
      const label = `${Math.round(crop.width)} x ${Math.round(crop.height)}`;
      ctx.font = '11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const textW = ctx.measureText(label).width;
      const padX = 6;
      const padY = 3;
      const labelX = cx + cw / 2;
      const labelY = cy + 14;

      ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
      ctx.beginPath();
      ctx.roundRect(labelX - textW / 2 - padX, labelY - 11 - padY, textW + padX * 2, 14 + padY * 2, 4);
      ctx.fill();

      ctx.fillStyle = '#fff';
      ctx.fillText(label, labelX, labelY);
    }
  }, [imgEl, crop, displayScale]);

  const getMousePos = useCallback(
    (e: React.MouseEvent): { x: number; y: number } => {
      const canvas = canvasRef.current;
      if (!canvas) return { x: 0, y: 0 };
      const rect = canvas.getBoundingClientRect();
      return {
        x: (e.clientX - rect.left) / displayScale,
        y: (e.clientY - rect.top) / displayScale,
      };
    },
    [displayScale],
  );

  const isInsideCrop = useCallback(
    (pos: { x: number; y: number }) => {
      return (
        pos.x >= crop.x &&
        pos.x <= crop.x + crop.width &&
        pos.y >= crop.y &&
        pos.y <= crop.y + crop.height
      );
    },
    [crop],
  );

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);
      setIsDragging(true);
      setDragStart(pos);
      setCropStart({ ...crop });

      // Check corner handles first
      const corner = getCornerHit(pos, crop);
      if (corner) {
        setDragMode(corner);
      } else if (isInsideCrop(pos)) {
        setDragMode('move');
      } else {
        setDragMode('create');
        setCrop({ x: pos.x, y: pos.y, width: 0, height: 0 });
      }
    },
    [getMousePos, isInsideCrop, crop],
  );

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      const pos = getMousePos(e);

      // Update cursor based on hover
      if (!isDragging) {
        const corner = getCornerHit(pos, crop);
        if (corner) {
          if (corner === 'resize-tl' || corner === 'resize-br') setCursorStyle('nwse-resize');
          else setCursorStyle('nesw-resize');
        } else if (isInsideCrop(pos)) {
          setCursorStyle('move');
        } else {
          setCursorStyle('crosshair');
        }
        return;
      }

      if (!imgEl) return;

      if (dragMode === 'move') {
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        setCrop({
          ...cropStart,
          x: Math.max(0, Math.min(imgEl.width - cropStart.width, cropStart.x + dx)),
          y: Math.max(0, Math.min(imgEl.height - cropStart.height, cropStart.y + dy)),
        });
      } else if (dragMode === 'create') {
        const x = Math.min(dragStart.x, pos.x);
        const y = Math.min(dragStart.y, pos.y);
        const w = Math.abs(pos.x - dragStart.x);
        const h = Math.abs(pos.y - dragStart.y);
        setCrop({
          x: Math.max(0, x),
          y: Math.max(0, y),
          width: Math.min(w, imgEl.width - Math.max(0, x)),
          height: Math.min(h, imgEl.height - Math.max(0, y)),
        });
      } else {
        // Resize from corner
        let newX = cropStart.x;
        let newY = cropStart.y;
        let newW = cropStart.width;
        let newH = cropStart.height;

        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;

        if (dragMode === 'resize-tl') {
          newX = Math.max(0, cropStart.x + dx);
          newY = Math.max(0, cropStart.y + dy);
          newW = cropStart.width - (newX - cropStart.x);
          newH = cropStart.height - (newY - cropStart.y);
        } else if (dragMode === 'resize-tr') {
          newY = Math.max(0, cropStart.y + dy);
          newW = Math.min(cropStart.width + dx, imgEl.width - cropStart.x);
          newH = cropStart.height - (newY - cropStart.y);
        } else if (dragMode === 'resize-bl') {
          newX = Math.max(0, cropStart.x + dx);
          newW = cropStart.width - (newX - cropStart.x);
          newH = Math.min(cropStart.height + dy, imgEl.height - cropStart.y);
        } else if (dragMode === 'resize-br') {
          newW = Math.min(cropStart.width + dx, imgEl.width - cropStart.x);
          newH = Math.min(cropStart.height + dy, imgEl.height - cropStart.y);
        }

        // Ensure minimum size
        if (newW > 10 && newH > 10) {
          setCrop({ x: newX, y: newY, width: newW, height: newH });
        }
      }
    },
    [isDragging, dragMode, dragStart, cropStart, getMousePos, imgEl, crop, isInsideCrop],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleCenterH = () => {
    if (!imgEl) return;
    setCrop((c) => ({ ...c, x: (imgEl.width - c.width) / 2 }));
  };

  const handleCenterV = () => {
    if (!imgEl) return;
    setCrop((c) => ({ ...c, y: (imgEl.height - c.height) / 2 }));
  };

  const handleCenter = () => {
    if (!imgEl) return;
    setCrop((c) => ({
      ...c,
      x: (imgEl.width - c.width) / 2,
      y: (imgEl.height - c.height) / 2,
    }));
  };

  const handleSquare = () => {
    if (!imgEl) return;
    const size = Math.min(crop.width, crop.height, imgEl.width, imgEl.height);
    setCrop({
      x: (imgEl.width - size) / 2,
      y: (imgEl.height - size) / 2,
      width: size,
      height: size,
    });
  };

  const handleSave = () => {
    if (!imgEl || crop.width < 1 || crop.height < 1) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = Math.round(crop.width);
    offscreen.height = Math.round(crop.height);
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(imgEl, crop.x, crop.y, crop.width, crop.height, 0, 0, crop.width, crop.height);
    onCrop(offscreen.toDataURL('image/png'));
  };

  const iconBtn: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 32,
    height: 32,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ddd',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    color: '#555',
    padding: 0,
  };

  const btnStyle: React.CSSProperties = {
    padding: '8px 18px',
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: '#ccc',
    borderRadius: 6,
    background: '#fff',
    cursor: 'pointer',
    fontSize: 13,
    color: '#333',
  };

  const primaryBtn: React.CSSProperties = {
    ...btnStyle,
    background: '#4A90D9',
    borderColor: '#4A90D9',
    color: '#fff',
    fontWeight: 500,
  };

  if (!imgEl) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
    >
      <div
        style={{
          background: '#fff',
          borderRadius: 12,
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 12,
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
          <span style={{ fontWeight: 600, fontSize: 16, color: '#333' }}>Crop Image</span>

          <div style={{ display: 'flex', gap: 4 }}>
            <button style={iconBtn} onClick={handleCenter} title="Center">
              <Maximize size={16} />
            </button>
            <button style={iconBtn} onClick={handleCenterH} title="Center Horizontal">
              <AlignCenterHorizontal size={16} />
            </button>
            <button style={iconBtn} onClick={handleCenterV} title="Center Vertical">
              <AlignCenterVertical size={16} />
            </button>
            <button style={iconBtn} onClick={handleSquare} title="Square">
              <Square size={16} />
            </button>
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#1a1a1a',
            borderRadius: 6,
            padding: 12,
          }}
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            style={{
              display: 'block',
              borderRadius: 4,
              cursor: isDragging
                ? dragMode === 'move' ? 'grabbing' : cursorStyle
                : cursorStyle,
            }}
          />
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, width: '100%' }}>
          <button style={btnStyle} onClick={onCancel}>Cancel</button>
          <button style={primaryBtn} onClick={handleSave}>Apply Crop</button>
        </div>
      </div>
    </div>
  );
}
