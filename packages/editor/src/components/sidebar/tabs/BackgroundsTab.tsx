import { useState, useCallback, useEffect } from 'react';
import { Loader } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';

interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string | null;
  user: { name: string };
  links: { download_location: string };
}

const CATEGORIES = [
  { label: 'Gradients', query: 'gradient background' },
  { label: 'Textures', query: 'texture background' },
  { label: 'Patterns', query: 'pattern seamless' },
  { label: 'Abstract', query: 'abstract colorful' },
  { label: 'Grunge', query: 'grunge texture dark' },
  { label: 'Marble', query: 'marble texture' },
  { label: 'Wood', query: 'wood texture' },
  { label: 'Fabric', query: 'fabric texture closeup' },
  { label: 'Space', query: 'galaxy space nebula' },
  { label: 'Watercolor', query: 'watercolor splash' },
];

export function BackgroundsTab() {
  const t = useT();
  const { addImageLayer } = useEditorStore();
  const UNSPLASH_KEY = useEditorStore((s) => s.unsplashKey);
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState('Gradients');

  const search = useCallback(async (q: string) => {
    if (!UNSPLASH_KEY) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.unsplash.com/search/photos?query=${encodeURIComponent(q)}&per_page=20`,
        { headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` } },
      );
      const data = await res.json();
      setPhotos(data.results ?? []);
    } catch {
      setPhotos([]);
    }
    setLoading(false);
  }, [UNSPLASH_KEY]);

  // Load default category on mount
  useEffect(() => {
    if (UNSPLASH_KEY && photos.length === 0) search(CATEGORIES[0]!.query);
  }, [UNSPLASH_KEY]);

  const handleCategoryClick = (cat: typeof CATEGORIES[0]) => {
    setActiveCategory(cat.label);
    search(cat.query);
  };

  const handlePhotoClick = (photo: UnsplashPhoto) => {
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
      addImageLayer(dataUrl, img.width, img.height);
    };
    img.src = photo.urls.regular;

    if (UNSPLASH_KEY) {
      fetch(photo.links.download_location, {
        headers: { Authorization: `Client-ID ${UNSPLASH_KEY}` },
      }).catch(() => {});
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('Backgrounds')}</div>

      {!UNSPLASH_KEY && (
        <div style={{ padding: 12, background: '#FFF3E0', borderRadius: 6, fontSize: 11, color: '#E65100' }}>
          {t('Unsplash API key not configured. Add VITE_UNSPLASH_ACCESS_KEY to your .env file.')}
        </div>
      )}

      {/* Categories */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {CATEGORIES.map((cat) => (
          <button
            key={cat.label}
            onClick={() => handleCategoryClick(cat)}
            style={{
              padding: '4px 8px', borderWidth: 1, borderStyle: 'solid',
              borderColor: activeCategory === cat.label ? '#4A90D9' : '#e0e0e0',
              borderRadius: 12,
              background: activeCategory === cat.label ? '#EBF2FA' : '#fff',
              color: activeCategory === cat.label ? '#4A90D9' : '#666',
              cursor: 'pointer', fontSize: 10,
              fontWeight: activeCategory === cat.label ? 600 : 400,
            }}
          >
            {t(cat.label)}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <Loader size={20} color="#aaa" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {!loading && photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => handlePhotoClick(photo)}
              title={`${photo.alt_description ?? 'Background'} by ${photo.user.name}`}
              style={{
                borderRadius: 6, overflow: 'hidden', cursor: 'pointer',
                aspectRatio: '1', borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0',
              }}
            >
              <img src={photo.urls.small} alt={photo.alt_description ?? ''} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
            </div>
          ))}
        </div>
      )}

      {photos.length > 0 && (
        <div style={{ fontSize: 9, color: '#bbb', textAlign: 'center' }}>
          {t('Photos by')} <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" style={{ color: '#999' }}>Unsplash</a>
        </div>
      )}
    </div>
  );
}
