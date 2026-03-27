import { useState, useRef, useEffect, useCallback } from 'react';
import { X } from 'lucide-react';

interface FiltersPopoverProps {
  imageSrc: string;
  originalSrc: string;
  activeFilterIndex: number;
  onApply: (processedSrc: string, filterIndex: number) => void;
  onClose: () => void;
}

interface FilterPreset {
  name: string;
  brightness: number;
  contrast: number;
  saturate: number;
  grayscale: number;
  sepia: number;
  hueRotate: number;
  invert: number;
}

const PRESETS: FilterPreset[] = [
  // Row 1 — Basics
  { name: 'Original', brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Grayscale', brightness: 100, contrast: 100, saturate: 0, grayscale: 100, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Sepia', brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 100, hueRotate: 0, invert: 0 },
  // Row 2 — Vivid & Color
  { name: 'Vivid', brightness: 110, contrast: 120, saturate: 150, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Punch', brightness: 105, contrast: 140, saturate: 130, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Pop', brightness: 115, contrast: 110, saturate: 160, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  // Row 3 — Warm tones
  { name: 'Warm', brightness: 105, contrast: 100, saturate: 120, grayscale: 0, sepia: 30, hueRotate: 0, invert: 0 },
  { name: 'Golden', brightness: 110, contrast: 105, saturate: 110, grayscale: 0, sepia: 50, hueRotate: 0, invert: 0 },
  { name: 'Amber', brightness: 100, contrast: 110, saturate: 130, grayscale: 0, sepia: 60, hueRotate: -10, invert: 0 },
  // Row 4 — Cool tones
  { name: 'Cool', brightness: 100, contrast: 100, saturate: 90, grayscale: 0, sepia: 0, hueRotate: 180, invert: 0 },
  { name: 'Arctic', brightness: 110, contrast: 105, saturate: 70, grayscale: 0, sepia: 0, hueRotate: 200, invert: 0 },
  { name: 'Frost', brightness: 115, contrast: 95, saturate: 80, grayscale: 0, sepia: 0, hueRotate: 160, invert: 0 },
  // Row 5 — Contrast
  { name: 'Hi Contrast', brightness: 100, contrast: 160, saturate: 100, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Lo Contrast', brightness: 105, contrast: 70, saturate: 100, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Dramatic', brightness: 90, contrast: 180, saturate: 110, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  // Row 6 — Faded & Vintage
  { name: 'Faded', brightness: 120, contrast: 80, saturate: 60, grayscale: 0, sepia: 10, hueRotate: 0, invert: 0 },
  { name: 'Vintage', brightness: 110, contrast: 90, saturate: 70, grayscale: 0, sepia: 40, hueRotate: 0, invert: 0 },
  { name: 'Retro', brightness: 105, contrast: 85, saturate: 80, grayscale: 0, sepia: 25, hueRotate: 10, invert: 0 },
  // Row 7 — Muted & Soft
  { name: 'Muted', brightness: 105, contrast: 90, saturate: 50, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Soft', brightness: 115, contrast: 85, saturate: 90, grayscale: 0, sepia: 5, hueRotate: 0, invert: 0 },
  { name: 'Pastel', brightness: 120, contrast: 75, saturate: 80, grayscale: 0, sepia: 10, hueRotate: 0, invert: 0 },
  // Row 8 — Dark & Moody
  { name: 'Dark', brightness: 75, contrast: 120, saturate: 100, grayscale: 0, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'Moody', brightness: 80, contrast: 130, saturate: 80, grayscale: 0, sepia: 15, hueRotate: 0, invert: 0 },
  { name: 'Noir', brightness: 85, contrast: 150, saturate: 0, grayscale: 100, sepia: 0, hueRotate: 0, invert: 0 },
  // Row 9 — Color shift
  { name: 'Cyberpunk', brightness: 105, contrast: 130, saturate: 140, grayscale: 0, sepia: 0, hueRotate: 290, invert: 0 },
  { name: 'Emerald', brightness: 100, contrast: 110, saturate: 120, grayscale: 0, sepia: 0, hueRotate: 90, invert: 0 },
  { name: 'Sunset', brightness: 105, contrast: 115, saturate: 130, grayscale: 0, sepia: 20, hueRotate: 340, invert: 0 },
  // Row 10 — BW Variants
  { name: 'BW Soft', brightness: 110, contrast: 90, saturate: 0, grayscale: 100, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'BW Hard', brightness: 95, contrast: 160, saturate: 0, grayscale: 100, sepia: 0, hueRotate: 0, invert: 0 },
  { name: 'BW Warm', brightness: 105, contrast: 110, saturate: 0, grayscale: 100, sepia: 30, hueRotate: 0, invert: 0 },
  // Row 11 — Creative
  { name: 'Invert', brightness: 100, contrast: 100, saturate: 100, grayscale: 0, sepia: 0, hueRotate: 0, invert: 100 },
  { name: 'Solarize', brightness: 120, contrast: 140, saturate: 120, grayscale: 0, sepia: 0, hueRotate: 0, invert: 50 },
  { name: 'X-Ray', brightness: 110, contrast: 130, saturate: 0, grayscale: 100, sepia: 0, hueRotate: 0, invert: 100 },
  // Row 12 — Film
  { name: 'Kodak', brightness: 108, contrast: 105, saturate: 115, grayscale: 0, sepia: 15, hueRotate: 5, invert: 0 },
  { name: 'Fuji', brightness: 102, contrast: 108, saturate: 125, grayscale: 0, sepia: 5, hueRotate: 350, invert: 0 },
  { name: 'Polaroid', brightness: 112, contrast: 95, saturate: 90, grayscale: 0, sepia: 20, hueRotate: 0, invert: 0 },
];

function buildFilterString(f: FilterPreset): string {
  return [
    `brightness(${f.brightness}%)`,
    `contrast(${f.contrast}%)`,
    `saturate(${f.saturate}%)`,
    f.grayscale > 0 ? `grayscale(${f.grayscale}%)` : '',
    f.sepia > 0 ? `sepia(${f.sepia}%)` : '',
    f.hueRotate !== 0 ? `hue-rotate(${f.hueRotate}deg)` : '',
    f.invert > 0 ? `invert(${f.invert}%)` : '',
  ].filter(Boolean).join(' ');
}

export function FiltersPopover({ originalSrc, activeFilterIndex, onApply, onClose }: FiltersPopoverProps) {
  const previewRef = useRef<HTMLCanvasElement>(null);
  const [imgEl, setImgEl] = useState<HTMLImageElement | null>(null);
  const [activePreset, setActivePreset] = useState(activeFilterIndex);
  const initPreset = PRESETS[activeFilterIndex] ?? PRESETS[0]!;
  const [brightness, setBrightness] = useState(initPreset.brightness);
  const [contrast, setContrast] = useState(initPreset.contrast);
  const [saturate, setSaturate] = useState(initPreset.saturate);

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => setImgEl(img);
    img.src = originalSrc;
  }, [originalSrc]);

  const getCurrentFilter = useCallback((): FilterPreset => {
    const base = PRESETS[activePreset] ?? PRESETS[0]!;
    return {
      ...base,
      brightness,
      contrast,
      saturate,
    };
  }, [activePreset, brightness, contrast, saturate]);

  // Main preview
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas || !imgEl) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const scale = Math.min(1, 260 / imgEl.width, 180 / imgEl.height);
    const w = imgEl.width * scale;
    const h = imgEl.height * scale;
    canvas.width = w;
    canvas.height = h;

    ctx.filter = buildFilterString(getCurrentFilter());
    ctx.drawImage(imgEl, 0, 0, w, h);
    ctx.filter = 'none';
  }, [imgEl, getCurrentFilter]);

  const applyPreset = (idx: number) => {
    const preset = PRESETS[idx]!;
    setActivePreset(idx);
    setBrightness(preset.brightness);
    setContrast(preset.contrast);
    setSaturate(preset.saturate);
  };

  const handleApply = () => {
    if (!imgEl) return;

    const offscreen = document.createElement('canvas');
    offscreen.width = imgEl.width;
    offscreen.height = imgEl.height;
    const ctx = offscreen.getContext('2d');
    if (!ctx) return;

    ctx.filter = buildFilterString(getCurrentFilter());
    ctx.drawImage(imgEl, 0, 0);
    ctx.filter = 'none';

    onApply(offscreen.toDataURL('image/png'), activePreset);
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
    width: 300,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
  };

  const thumbStyle = (idx: number): React.CSSProperties => ({
    width: 80,
    height: 60,
    borderWidth: 2,
    borderStyle: 'solid',
    borderColor: activePreset === idx ? '#4A90D9' : '#e0e0e0',
    borderRadius: 6,
    overflow: 'hidden',
    cursor: 'pointer',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'flex-end',
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
        <span style={{ fontWeight: 600, fontSize: 13, color: '#333' }}>Filters</span>
        <button
          onClick={onClose}
          style={{ background: 'none', borderWidth: 0, cursor: 'pointer', color: '#999', padding: 2, display: 'flex' }}
        >
          <X size={16} />
        </button>
      </div>

      {/* Preview */}
      <div style={{ display: 'flex', justifyContent: 'center', background: '#f5f5f5', borderRadius: 6, padding: 8 }}>
        <canvas ref={previewRef} style={{ display: 'block', borderRadius: 4 }} />
      </div>

      {/* Preset grid: 3 columns, scrollable */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, maxHeight: 240, overflowY: 'auto', paddingRight: 4 }}>
        {PRESETS.map((preset, idx) => (
          <div key={preset.name} style={thumbStyle(idx)} onClick={() => applyPreset(idx)}>
            <PresetThumb imageSrc={originalSrc} filter={preset} />
            <span style={{
              fontSize: 9,
              color: activePreset === idx ? '#4A90D9' : '#888',
              fontWeight: activePreset === idx ? 600 : 400,
              padding: '2px 0',
              background: 'rgba(255,255,255,0.85)',
              width: '100%',
              textAlign: 'center',
            }}>
              {preset.name}
            </span>
          </div>
        ))}
      </div>

      {/* Adjustments */}
      <SliderRow label="Brightness" value={brightness} min={0} max={200} onChange={setBrightness} />
      <SliderRow label="Contrast" value={contrast} min={0} max={200} onChange={setContrast} />
      <SliderRow label="Saturation" value={saturate} min={0} max={200} onChange={setSaturate} />

      <button style={applyBtn} onClick={handleApply}>Apply</button>
    </div>
  );
}

function SliderRow({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <span style={{ fontSize: 12, color: '#666', minWidth: 65 }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, color: '#666', minWidth: 28, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

function PresetThumb({ imageSrc, filter }: { imageSrc: string; filter: FilterPreset }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const img = new window.Image();
    img.onload = () => {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      canvas.width = 76;
      canvas.height = 44;

      const scale = Math.min(76 / img.width, 44 / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      const x = (76 - w) / 2;
      const y = (44 - h) / 2;

      ctx.filter = buildFilterString(filter);
      ctx.drawImage(img, x, y, w, h);
      ctx.filter = 'none';
    };
    img.src = imageSrc;
  }, [imageSrc, filter]);

  return <canvas ref={ref} style={{ display: 'block', width: 76, height: 44 }} />;
}
