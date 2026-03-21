import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

interface ToolbarButtonProps {
  icon: LucideIcon;
  tooltip: string;
  onClick: () => void;
  active?: boolean;
  danger?: boolean;
}

export function ToolbarButton({ icon: Icon, tooltip, onClick, active, danger }: ToolbarButtonProps) {
  const baseColor = danger ? '#e53935' : active ? '#4A90D9' : '#555';
  const bgColor = active ? '#EBF2FA' : 'transparent';

  return (
    <button
      onClick={onClick}
      title={tooltip}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 30,
        height: 30,
        borderWidth: 1,
        borderStyle: 'solid',
        borderColor: active ? '#4A90D9' : 'transparent',
        borderRadius: 4,
        background: bgColor,
        cursor: 'pointer',
        color: baseColor,
        padding: 0,
      }}
    >
      <Icon size={16} />
    </button>
  );
}

export function ToolbarDivider() {
  return <div style={{ width: 1, height: 22, background: '#ddd', margin: '0 2px' }} />;
}

interface ToolbarSliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

interface PopoverAnchorProps {
  children: ReactNode;
  popover: ReactNode;
  isOpen: boolean;
}

export function PopoverAnchor({ children, popover, isOpen }: PopoverAnchorProps) {
  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      {children}
      {isOpen && popover}
    </div>
  );
}

export function ToolbarSlider({ label, value, min, max, onChange }: ToolbarSliderProps) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span style={{ fontSize: 11, color: '#888', whiteSpace: 'nowrap' }}>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: 60, cursor: 'pointer' }}
      />
      <span style={{ fontSize: 11, color: '#666', minWidth: 28 }}>{value}%</span>
    </div>
  );
}
