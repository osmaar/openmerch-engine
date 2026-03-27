import { useState } from 'react';
import {
  ShirtIcon,
  ImageIcon,
  Type,
  Layers,
  Shapes,
  Sticker,
} from 'lucide-react';
import { ProductTab } from './tabs/ProductTab.js';
import { ImageTab } from './tabs/ImageTab.js';
import { TextTab } from './tabs/TextTab.js';
import { LayersTab } from './tabs/LayersTab.js';

type TabId = 'product' | 'image' | 'text' | 'layers' | 'shapes' | 'cliparts';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof ShirtIcon;
}

const TABS: TabDef[] = [
  { id: 'product', label: 'Product', icon: ShirtIcon },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'layers', label: 'Layers', icon: Layers },
  { id: 'cliparts', label: 'Cliparts', icon: Sticker },
  { id: 'shapes', label: 'Shapes', icon: Shapes },
];

export function SidebarPanel() {
  const [activeTab, setActiveTab] = useState<TabId>('product');

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      borderRightWidth: 1,
      borderRightStyle: 'solid',
      borderRightColor: '#e0e0e0',
      background: '#fff',
    }}>
      {/* Icon rail */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        width: 56,
        background: '#f8f8f8',
        borderRightWidth: 1,
        borderRightStyle: 'solid',
        borderRightColor: '#e0e0e0',
        paddingTop: 8,
        gap: 2,
      }}>
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              title={tab.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '8px 4px',
                borderWidth: 0,
                borderRightWidth: 2,
                borderRightStyle: 'solid',
                borderRightColor: isActive ? '#4A90D9' : 'transparent',
                background: isActive ? '#EBF2FA' : 'transparent',
                color: isActive ? '#4A90D9' : '#777',
                cursor: 'pointer',
                fontSize: 9,
                fontWeight: isActive ? 600 : 400,
              }}
            >
              <Icon size={18} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content / contextual panel */}
      <div style={{
        width: 280,
        overflowY: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {activeTab === 'product' && <ProductTab />}
        {activeTab === 'image' && <ImageTab />}
        {activeTab === 'text' && <TextTab />}
        {activeTab === 'layers' && <LayersTab />}
        {activeTab === 'cliparts' && <ComingSoon label="Cliparts" />}
        {activeTab === 'shapes' && <ComingSoon label="Shapes" />}
      </div>
    </div>
  );
}

function ComingSoon({ label }: { label: string }) {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: 200,
      gap: 8,
      color: '#aaa',
    }}>
      <span style={{ fontSize: 14, fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 12 }}>Coming soon</span>
    </div>
  );
}
