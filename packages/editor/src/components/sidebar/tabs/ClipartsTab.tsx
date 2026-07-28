import { useState, useCallback, useEffect } from 'react';
import { Search, Loader } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';
import { getBaseUrl } from '../../../services/api.js';

interface IconifyIcon {
  prefix: string;
  name: string;
}

interface AdminClipart {
  id: string;
  name: string;
  fileUrl: string | null;
}

const API_BASE = getBaseUrl();

const ICON_SETS = [
  { prefix: 'lucide', label: 'Basic', defaultQuery: 'star' },
  { prefix: 'mdi', label: 'Material', defaultQuery: 'heart' },
  { prefix: 'ph', label: 'Phosphor', defaultQuery: 'fire' },
  { prefix: 'tabler', label: 'Tabler', defaultQuery: 'sport' },
  { prefix: 'game-icons', label: 'Gaming', defaultQuery: 'sword' },
  { prefix: 'emojione-monotone', label: 'Emoji', defaultQuery: 'face' },
  { prefix: 'twemoji', label: 'Color', defaultQuery: 'heart' },
  { prefix: 'fluent-emoji-flat', label: 'Fluent', defaultQuery: 'star' },
  { prefix: 'noto', label: 'Noto', defaultQuery: 'animal' },
  { prefix: 'streamline', label: 'Stream', defaultQuery: 'design' },
];

export function ClipartsTab() {
  const t = useT();
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<IconifyIcon[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeSet, setActiveSet] = useState(ICON_SETS[0]!);
  const [adminCliparts, setAdminCliparts] = useState<AdminClipart[]>([]);
  const [showLibrary, setShowLibrary] = useState(true);

  // Load merchant cliparts from admin/API
  useEffect(() => {
    fetch(`${API_BASE}/api/v1/cliparts`)
      .then((r) => r.json())
      .then((data: { id: string; name: string; fileUrl: string | null; active: boolean }[]) => {
        setAdminCliparts(data.filter((c) => c.active && c.fileUrl).map((c) => ({ id: c.id, name: c.name, fileUrl: c.fileUrl })));
      })
      .catch(() => setAdminCliparts([]));
  }, []);

  const addAdminClipart = (url: string) => {
    const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : url;
    const img = new window.Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => addImageLayer(fullUrl, img.width || 200, img.height || 200);
    img.src = fullUrl;
  };

  const searchIconify = useCallback(async (q: string, prefix: string) => {
    setLoading(true);
    try {
      const res = await fetch(
        `https://api.iconify.design/search?query=${encodeURIComponent(q)}&prefix=${prefix}&limit=40`,
      );
      const data = await res.json();
      setResults((data.icons ?? []).map((fullName: string) => {
        const parts = fullName.split(':');
        return { prefix: parts[0] ?? prefix, name: parts[1] ?? fullName };
      }));
    } catch {
      setResults([]);
    }
    setLoading(false);
  }, []);

  // Load default icons on mount and when switching sets
  useEffect(() => {
    searchIconify(query || activeSet.defaultQuery, activeSet.prefix);
  }, [activeSet]);

  const handleSearch = () => {
    searchIconify(query || activeSet.defaultQuery, activeSet.prefix);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  const handleSetClick = (s: typeof ICON_SETS[0]) => {
    setActiveSet(s);
  };

  const addIcon = async (prefix: string, name: string) => {
    try {
      const res = await fetch(`https://api.iconify.design/${prefix}/${name}.svg?height=200`);
      const svgText = await res.text();
      const dataUrl = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgText)));

      const img = new window.Image();
      img.onload = () => {
        addImageLayer(dataUrl, 200, 200);
      };
      img.src = dataUrl;
    } catch {
      // silently fail
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('Cliparts')}</div>

      {/* Merchant collection */}
      {adminCliparts.length > 0 && (
        <div style={{ borderBottom: '1px solid #eee', paddingBottom: 10 }}>
          <button
            onClick={() => setShowLibrary(!showLibrary)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'transparent', border: 'none', padding: '4px 0', cursor: 'pointer', fontSize: 11, fontWeight: 600, color: '#666' }}
          >
            <span>{t('COLLECTION')} ({adminCliparts.length})</span>
            <span>{showLibrary ? '▼' : '▶'}</span>
          </button>
          {showLibrary && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginTop: 6 }}>
              {adminCliparts.map((c) => (
                <button
                  key={c.id}
                  onClick={() => addAdminClipart(c.fileUrl!)}
                  title={c.name}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 4, borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0', borderRadius: 6, background: '#fff', cursor: 'pointer', aspectRatio: '1', overflow: 'hidden' }}
                >
                  <img
                    src={c.fileUrl!.startsWith('/') ? `${API_BASE}${c.fileUrl}` : c.fileUrl!}
                    alt={c.name}
                    style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    loading="lazy"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

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
            placeholder={t('Search icons...')}
            style={{ flex: 1, borderWidth: 0, outline: 'none', fontSize: 12 }}
          />
        </div>
        <button onClick={handleSearch} style={{
          padding: '5px 10px', borderWidth: 0, borderRadius: 6,
          background: '#4A90D9', color: '#fff', cursor: 'pointer', fontSize: 11,
        }}>
          {t('Search')}
        </button>
      </div>

      {/* Icon set badges */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
        {ICON_SETS.map((s) => (
          <button
            key={s.prefix}
            onClick={() => handleSetClick(s)}
            style={{
              padding: '3px 7px', borderWidth: 1, borderStyle: 'solid',
              borderColor: activeSet.prefix === s.prefix ? '#4A90D9' : '#e0e0e0',
              borderRadius: 4,
              background: activeSet.prefix === s.prefix ? '#EBF2FA' : '#fff',
              color: activeSet.prefix === s.prefix ? '#4A90D9' : '#888',
              cursor: 'pointer', fontSize: 9,
              fontWeight: activeSet.prefix === s.prefix ? 600 : 400,
            }}
          >
            {t(s.label)}
          </button>
        ))}
      </div>

      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
          <Loader size={20} color="#aaa" style={{ animation: 'spin 1s linear infinite' }} />
        </div>
      )}

      {/* Results grid */}
      {!loading && results.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {results.map((icon) => (
            <button
              key={`${icon.prefix}:${icon.name}`}
              onClick={() => addIcon(icon.prefix, icon.name)}
              title={icon.name}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: 6, borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0',
                borderRadius: 6, background: '#fff', cursor: 'pointer', aspectRatio: '1',
              }}
            >
              <img
                src={`https://api.iconify.design/${icon.prefix}/${icon.name}.svg?height=24`}
                alt={icon.name}
                style={{ width: 22, height: 22 }}
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={{ textAlign: 'center', color: '#595959', fontSize: 12, padding: 12 }}>No icons found</div>
      )}

      <div style={{ fontSize: 9, color: '#767676', textAlign: 'center' }}>
        200,000+ icons · Powered by <a href="https://iconify.design" target="_blank" rel="noopener noreferrer" style={{ color: '#595959' }}>Iconify</a>
      </div>
    </div>
  );
}
