import { useState } from 'react';
import { Sparkles, Loader, AlertCircle } from 'lucide-react';
import { useEditorStore } from '../../../store/editorStore.js';
import { useT } from '../../../i18n/useTranslation.js';
import { getBaseUrl } from '../../../services/api.js';

const API_BASE = getBaseUrl();

const STYLES = [
  { id: 'auto', label: 'Auto' },
  { id: 'photo', label: 'Photo' },
  { id: 'art', label: 'Art' },
  { id: 'anime', label: 'Anime' },
  { id: 'logo', label: 'Logo' },
  { id: 'icon', label: 'Icon' },
  { id: 'sticker', label: 'Sticker' },
  { id: 'tattoo', label: 'Tattoo' },
];

const PROMPT_SUGGESTIONS = [
  'A roaring lion with crown, bold graphic style',
  'Retro sunset with palm trees, vaporwave aesthetic',
  'Skull with roses, tattoo style, black and white',
  'Abstract geometric wolf head, modern minimal',
  'Vintage motorcycle, distressed texture, americana',
  'Japanese dragon, traditional ink style',
  'Astronaut floating in space with flowers',
  'Graffiti style text art, urban street art',
];

const styleModifiers: Record<string, string> = {
  photo: ', photorealistic, high detail, 4k',
  art: ', digital art, illustration, vibrant colors',
  anime: ', anime style, manga art, cel shaded',
  logo: ', logo design, vector style, clean lines, transparent background',
  icon: ', icon design, flat design, simple, minimal',
  sticker: ', sticker design, die-cut, white border, cartoon style',
  tattoo: ', tattoo design, black ink, detailed linework',
};

export function AiImageTab() {
  const t = useT();
  const addImageLayer = useEditorStore((s) => s.addImageLayer);
  const addToGallery = useEditorStore((s) => s.addToGallery);
  const replaceImage = useEditorStore((s) => s.replaceImage);
  const selectedLayer = useEditorStore((s) => s.getSelectedLayer());
  const isImageSelected = selectedLayer?.type === 'image';
  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('auto');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const buildPrompt = (): string => {
    let fullPrompt = prompt.trim();
    if (!fullPrompt) return '';
    if (style !== 'auto' && styleModifiers[style]) {
      fullPrompt += styleModifiers[style];
    }
    fullPrompt += ', suitable for t-shirt print, high contrast, no background';
    return fullPrompt;
  };

  const generate = async () => {
    const fullPrompt = buildPrompt();
    if (!fullPrompt) return;

    setLoading(true);
    setError(null);

    try {
      const imageUrl = `${API_BASE}/api/v1/proxy/ai-image?prompt=${encodeURIComponent(fullPrompt)}&width=1024&height=1024`;

      // Load image
      const img = new window.Image();
      img.crossOrigin = 'anonymous';

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Image generation failed'));
        img.src = imageUrl;
      });

      // Convert to data URL
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('No canvas context');
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');

      addToGallery(dataUrl, `AI: ${prompt.substring(0, 30)}`);

      // If an image layer is selected, replace it; otherwise add new
      if (isImageSelected && selectedLayer) {
        replaceImage(selectedLayer.id, dataUrl, img.width, img.height);
      } else {
        addImageLayer(dataUrl, img.width, img.height);
      }
    } catch {
      setError(t('Image generation failed. Try a different prompt.'));
    }

    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Sparkles size={16} color="#4A90D9" />
        <span style={{ fontWeight: 600, fontSize: 14, color: '#333' }}>{t('AI Image')}</span>
      </div>

      {isImageSelected && (
        <div style={{ padding: 8, background: '#EBF2FA', borderRadius: 6, fontSize: 11, color: '#4A90D9', fontWeight: 500 }}>
          {t('Image selected — generation will replace it')}
        </div>
      )}

      {/* Prompt */}
      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t('Describe your image')}</div>
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate(); } }}
          placeholder={t('A roaring lion with a crown...')}
          rows={3}
          style={{
            width: '100%', padding: '8px', borderWidth: 1, borderStyle: 'solid',
            borderColor: '#ddd', borderRadius: 6, fontSize: 12, resize: 'vertical',
            fontFamily: 'inherit',
          }}
        />
      </div>

      {/* Style */}
      <div>
        <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t('Style')}</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {STYLES.map((s) => (
            <button
              key={s.id}
              onClick={() => setStyle(s.id)}
              style={{
                padding: '4px 8px', borderWidth: 1, borderStyle: 'solid',
                borderColor: style === s.id ? '#4A90D9' : '#e0e0e0',
                borderRadius: 12,
                background: style === s.id ? '#EBF2FA' : '#fff',
                color: style === s.id ? '#4A90D9' : '#666',
                cursor: 'pointer', fontSize: 10,
                fontWeight: style === s.id ? 600 : 400,
              }}
            >
              {t(s.label)}
            </button>
          ))}
        </div>
      </div>

      {/* Generate */}
      <button
        onClick={generate}
        disabled={loading || !prompt.trim()}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          padding: '10px 16px', borderWidth: 0, borderRadius: 8,
          background: loading || !prompt.trim() ? '#ccc' : '#4A90D9',
          color: '#fff', cursor: loading || !prompt.trim() ? 'default' : 'pointer',
          fontSize: 13, fontWeight: 500,
        }}
      >
        {loading ? (
          <>
            <Loader size={14} style={{ animation: 'spin 1s linear infinite' }} />
            {t('Generating...')}
          </>
        ) : (
          <>
            <Sparkles size={14} />
            {t('Generate Image')}
          </>
        )}
      </button>

      {/* Error */}
      {error && (
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: 8, background: '#FFF3E0', borderRadius: 6, fontSize: 11, color: '#E65100' }}>
          <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>{error}</span>
        </div>
      )}

      {/* Suggestions */}
      {!loading && (
        <div>
          <div style={{ fontSize: 11, color: '#888', marginBottom: 4 }}>{t('Try these prompts')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            {PROMPT_SUGGESTIONS.map((s, i) => (
              <button
                key={i}
                onClick={() => setPrompt(t(s))}
                style={{
                  padding: '6px 8px', borderWidth: 1, borderStyle: 'solid', borderColor: '#e0e0e0',
                  borderRadius: 6, background: '#fff', cursor: 'pointer', fontSize: 10,
                  color: '#555', textAlign: 'left',
                }}
              >
                {t(s)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div style={{ fontSize: 9, color: '#767676', textAlign: 'center', lineHeight: 1.4 }}>
        {t('Powered by Hugging Face · Stable Diffusion 3 Medium · Generation may take 10-30s')}
      </div>
    </div>
  );
}
