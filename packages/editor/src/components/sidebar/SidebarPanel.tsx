import { useState } from 'react';
import {
  ShirtIcon,
  ImageIcon,
  Type,
  Layers,
  Shapes,
  Sticker,
  Camera,
  Wallpaper,
  Sparkles,
} from 'lucide-react';
import { ProductTab } from './tabs/ProductTab.js';
import { ImageTab } from './tabs/ImageTab.js';
import { TextTab } from './tabs/TextTab.js';
import { LayersTab } from './tabs/LayersTab.js';
import { ClipartsTab } from './tabs/ClipartsTab.js';
import { ShapesTab } from './tabs/ShapesTab.js';
import { PhotosTab } from './tabs/PhotosTab.js';
import { BackgroundsTab } from './tabs/BackgroundsTab.js';
import { AiImageTab } from './tabs/AiImageTab.js';

type TabId = 'product' | 'image' | 'text' | 'layers' | 'shapes' | 'cliparts' | 'photos' | 'backgrounds' | 'ai';

interface TabDef {
  id: TabId;
  label: string;
  icon: typeof ShirtIcon;
}

const TABS: TabDef[] = [
  { id: 'product', label: 'Product', icon: ShirtIcon },
  { id: 'image', label: 'Image', icon: ImageIcon },
  { id: 'photos', label: 'Photos', icon: Camera },
  { id: 'ai', label: 'AI Image', icon: Sparkles },
  { id: 'text', label: 'Text', icon: Type },
  { id: 'cliparts', label: 'Cliparts', icon: Sticker },
  { id: 'shapes', label: 'Shapes', icon: Shapes },
  { id: 'backgrounds', label: 'Backgrnd', icon: Wallpaper },
  { id: 'layers', label: 'Layers', icon: Layers },
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
        overflowY: 'auto',
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
                padding: '7px 4px',
                borderWidth: 0,
                borderRightWidth: 2,
                borderRightStyle: 'solid',
                borderRightColor: isActive ? '#4A90D9' : 'transparent',
                background: isActive ? '#EBF2FA' : 'transparent',
                color: isActive ? '#4A90D9' : '#777',
                cursor: 'pointer',
                fontSize: 8,
                fontWeight: isActive ? 600 : 400,
                flexShrink: 0,
              }}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div style={{
        width: 280,
        overflowY: 'auto',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
      }}>
        {activeTab === 'product' && <ProductTab />}
        {activeTab === 'image' && <ImageTab />}
        {activeTab === 'photos' && <PhotosTab />}
        {activeTab === 'text' && <TextTab />}
        {activeTab === 'cliparts' && <ClipartsTab />}
        {activeTab === 'shapes' && <ShapesTab />}
        {activeTab === 'backgrounds' && <BackgroundsTab />}
        {activeTab === 'ai' && <AiImageTab />}
        {activeTab === 'layers' && <LayersTab />}
      </div>
    </div>
  );
}
