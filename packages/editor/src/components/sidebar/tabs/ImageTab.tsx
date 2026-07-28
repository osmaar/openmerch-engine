import { useRef } from 'react';
import { Upload, ImagePlus, X } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';

export function ImageTab() {
  const t = useT();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const addToGallery = useEditorStore((s) => s.addToGallery);
  const removeFromGallery = useEditorStore((s) => s.removeFromGallery);
  const gallery = useEditorStore((s) => s.gallery);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        addImageLayer(dataUrl, img.width, img.height);
        addToGallery(dataUrl, file.name);
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleUpload(file);
    e.target.value = '';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (!file || !file.type.startsWith('image/')) return;
    handleUpload(file);
  };

  const handleGalleryClick = (src: string) => {
    const img = new window.Image();
    img.onload = () => {
      addImageLayer(src, img.width, img.height);
    };
    img.src = src;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('Add Image')}</div>

      {/* Upload button */}
      <button
        onClick={() => fileInputRef.current?.click()}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: '10px 16px',
          borderWidth: 1,
          borderStyle: 'solid',
          borderColor: '#4A90D9',
          borderRadius: 8,
          background: '#4A90D9',
          color: '#fff',
          cursor: 'pointer',
          fontSize: 13,
          fontWeight: 500,
        }}
      >
        <ImagePlus size={16} />
        {t('Upload Image')}
      </button>

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; }}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          padding: 20,
          borderWidth: 2,
          borderStyle: 'dashed',
          borderColor: '#ddd',
          borderRadius: 8,
          color: '#595959',
          fontSize: 12,
          cursor: 'pointer',
        }}
        onClick={() => fileInputRef.current?.click()}
      >
        <Upload size={20} />
        <span>{t('Drag & drop here')}</span>
        <span style={{ fontSize: 10, color: '#767676' }}>{t('PNG, JPG, SVG, WebP')}</span>
      </div>

      {/* Gallery */}
      {gallery.length > 0 && (
        <>
          <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
            {t('Uploaded images')}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {gallery.map((item) => (
              <div
                key={item.id}
                style={{
                  position: 'relative',
                  borderRadius: 6,
                  overflow: 'hidden',
                  borderWidth: 1,
                  borderStyle: 'solid',
                  borderColor: '#e0e0e0',
                  cursor: 'pointer',
                  aspectRatio: '1',
                }}
                onClick={() => handleGalleryClick(item.src)}
                title={`${item.name} — Click to add to canvas`}
              >
                <img
                  src={item.src}
                  alt={item.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
                <button
                  onClick={(e) => { e.stopPropagation(); removeFromGallery(item.id); }}
                  title={t('Remove from gallery')}
                  style={{
                    position: 'absolute',
                    top: 2,
                    right: 2,
                    width: 18,
                    height: 18,
                    borderRadius: 9,
                    borderWidth: 0,
                    background: 'rgba(0,0,0,0.5)',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                  }}
                >
                  <X size={10} />
                </button>
              </div>
            ))}
          </div>

          <div style={{ fontSize: 10, color: '#767676', textAlign: 'center' }}>
            {t('Images saved during this session only')}
          </div>
        </>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/svg+xml,image/webp"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
    </div>
  );
}
