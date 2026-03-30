import { useState, useRef } from 'react';
import { Info, QrCode } from 'lucide-react';
import QRCode from 'qrcode';
import { useEditorStore } from '../store/editorStore.js';
import { ImageToolbar } from './contextual/ImageToolbar.js';
import { TextToolbar } from './contextual/TextToolbar.js';
import { ShapeToolbar } from './contextual/ShapeToolbar.js';
import type { ImageLayer, TextLayer, ShapeLayer } from '@openmerch/core';

export function TopToolbar() {
  const selectedLayer = useEditorStore((s) => s.getSelectedLayer());
  const { addImageLayer } = useEditorStore();
  const [showQrInput, setShowQrInput] = useState(false);
  const [qrText, setQrText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleGenerateQR = async () => {
    if (!qrText.trim()) return;

    try {
      const dataUrl = await QRCode.toDataURL(qrText.trim(), {
        errorCorrectionLevel: 'H',
        type: 'image/png',
        margin: 1,
        width: 300,
        color: { dark: '#000000', light: '#00000000' },
      });

      const img = new window.Image();
      img.onload = () => {
        addImageLayer(dataUrl, img.width, img.height);
        setShowQrInput(false);
        setQrText('');
      };
      img.src = dataUrl;
    } catch {
      // silently fail
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleGenerateQR();
    }
    if (e.key === 'Escape') {
      setShowQrInput(false);
      setQrText('');
    }
  };

  return (
    <div style={{
      padding: '4px 12px',
      borderBottomWidth: 1,
      borderBottomStyle: 'solid',
      borderBottomColor: '#e0e0e0',
      background: '#fff',
      display: 'flex',
      alignItems: 'center',
      minHeight: 40,
      flexShrink: 0,
      overflow: 'visible',
      position: 'relative',
      zIndex: 100,
      gap: 8,
    }}>
      {!selectedLayer && (
        <>
          {/* Default message + QR button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#aaa', fontSize: 12, flex: 1 }}>
            <Info size={14} />
            <span>You can design your product — upload an image or add text to get started</span>
          </div>

          {/* QR Code generator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
            {showQrInput && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  ref={inputRef}
                  type="text"
                  value={qrText}
                  onChange={(e) => setQrText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Your QR code text"
                  autoFocus
                  style={{
                    padding: '5px 8px',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: '#ccc',
                    borderRadius: 4,
                    fontSize: 12,
                    width: 180,
                  }}
                />
                <button
                  onClick={handleGenerateQR}
                  style={{
                    padding: '5px 10px',
                    borderWidth: 0,
                    borderRadius: 4,
                    background: '#4A90D9',
                    color: '#fff',
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 500,
                  }}
                >
                  Generate
                </button>
                <button
                  onClick={() => { setShowQrInput(false); setQrText(''); }}
                  style={{
                    padding: '5px 8px',
                    borderWidth: 1,
                    borderStyle: 'solid',
                    borderColor: '#ddd',
                    borderRadius: 4,
                    background: '#fff',
                    color: '#888',
                    cursor: 'pointer',
                    fontSize: 11,
                  }}
                >
                  Cancel
                </button>
              </div>
            )}
            <button
              onClick={() => setShowQrInput(!showQrInput)}
              title="Create QR Code"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '5px 10px',
                borderWidth: 1,
                borderStyle: 'solid',
                borderColor: showQrInput ? '#4A90D9' : '#ddd',
                borderRadius: 4,
                background: showQrInput ? '#EBF2FA' : '#fff',
                color: showQrInput ? '#4A90D9' : '#666',
                cursor: 'pointer',
                fontSize: 12,
              }}
            >
              <QrCode size={14} />
              QR Code
            </button>
          </div>
        </>
      )}

      {selectedLayer?.type === 'image' && (
        <ImageToolbar layer={selectedLayer as ImageLayer} />
      )}

      {selectedLayer?.type === 'text' && (
        <TextToolbar layer={selectedLayer as TextLayer} />
      )}

      {selectedLayer?.type === 'shape' && (
        <ShapeToolbar layer={selectedLayer as ShapeLayer} />
      )}
    </div>
  );
}
