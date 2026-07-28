import { useState, useCallback, useEffect } from 'react';
import { Search, Loader } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';
import { getBaseUrl } from '../../../services/api.js';

interface UnsplashPhoto {
  id: string;
  urls: { small: string; regular: string };
  alt_description: string | null;
  user: { name: string };
  links: { download_location: string };
}

const API_BASE = getBaseUrl();
const DEFAULT_QUERY = 'popular';
const SUGGESTIONS = ['trending', 'aesthetic', 'minimal', 'retro', 'graffiti', 'neon', 'floral', 'geometric', 'animals', 'landscape', 'food', 'music'];

export function PhotosTab() {
  const t = useT();
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const [query, setQuery] = useState('');
  const [photos, setPhotos] = useState<UnsplashPhoto[]>([]);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/proxy/unsplash/search?query=${encodeURIComponent(q || DEFAULT_QUERY)}&per_page=20`,
      );
      const data = await res.json();
      setPhotos(data.results ?? []);
    } catch {
      setPhotos([]);
    }
    setLoading(false);
  }, []);

  // Load default photos on mount
  useEffect(() => {
    if (photos.length === 0) search(DEFAULT_QUERY);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') search(query);
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

    // Trigger Unsplash download tracking via proxy
    fetch(`${API_BASE}/api/v1/proxy/unsplash/search?query=download&download_location=${encodeURIComponent(photo.links.download_location)}`).catch(() => {});
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('Photos')}</div>

      {/* Search */}
      <div style={{ display: 'flex', gap: 4 }}>
        <div style={{
          flex: 1, display: 'flex', alignItems: 'center', gap: 4,
          padding: '5px 8px', borderWidth: 1, borderStyle: 'solid', borderColor: '#ddd', borderRadius: 6,
        }}>
          <Search size={14} color="#aaa" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('Search photos...')}
            style={{ flex: 1, borderWidth: 0, outline: 'none', fontSize: 12 }}
          />
        </div>
        <button onClick={() => search(query)} style={{
          padding: '5px 10px', borderWidth: 0, borderRadius: 6,
          background: '#4A90D9', color: '#fff', cursor: 'pointer', fontSize: 11,
        }}>
          {t('Search')}
        </button>
      </div>

      {/* Suggestions */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setQuery(s); search(s); }}
            style={{
              padding: '3px 8px', borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0',
              borderRadius: 12, background: '#fff', cursor: 'pointer', fontSize: 10, color: '#666',
            }}
          >
            {t(s)}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <Loader size={20} color="#aaa" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Key warning removed — proxy handles key resolution (DB > .env) */}

      {!loading && photos.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6 }}>
          {photos.map((photo) => (
            <div
              key={photo.id}
              onClick={() => handlePhotoClick(photo)}
              title={`${photo.alt_description ?? 'Photo'} by ${photo.user.name}`}
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
        <div style={{ fontSize: 9, color: '#767676', textAlign: 'center' }}>
          {t('Photos by')} <a href="https://unsplash.com" target="_blank" rel="noopener noreferrer" style={{ color: '#595959' }}>Unsplash</a>
        </div>
      )}
    </div>
  );
}
