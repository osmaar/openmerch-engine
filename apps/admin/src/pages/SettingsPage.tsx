import { useEffect, useState } from 'react';
import {
  Title, Paper, TextInput, PasswordInput, Button, Group, Text, Stack, Badge, Anchor, Divider, Select, Switch, NumberInput, FileButton, SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Save, ExternalLink, Upload, Trash2 } from 'lucide-react';
import { getSettings, updateSettings, uploadAsset } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';

const API_BASE = (typeof window !== 'undefined' && window.location.port !== '3001') ? 'http://localhost:3001' : '';

export function SettingsPage() {
  const t = useT();
  const [unsplashKey, setUnsplashKey] = useState('');
  const [pollinationsKey, setPollinationsKey] = useState('');
  const [unsplashConfigured, setUnsplashConfigured] = useState(false);
  const [pollinationsConfigured, setPollinationsConfigured] = useState(false);
  const [storeName, setStoreName] = useState('');
  const [storageMode, setStorageMode] = useState('database');
  const [showBranding, setShowBranding] = useState(true);
  const [maxUploadSize, setMaxUploadSize] = useState(50);
  const [defaultCurrency, setDefaultCurrency] = useState('USD');
  const [contactEmail, setContactEmail] = useState('');
  const [faviconUrl, setFaviconUrl] = useState('');
  const [faviconDisplay, setFaviconDisplay] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((rows) => {
      for (const s of rows) {
        if (s.key === 'store_name') setStoreName(s.value);
        if (s.key === 'unsplash_key') {
          setUnsplashConfigured(!!s.value);
        }
        if (s.key === 'pollinations_key') {
          setPollinationsConfigured(!!s.value);
        }
        if (s.key === 'storage_mode') setStorageMode(s.value);
        if (s.key === 'show_branding') setShowBranding(s.value !== 'false');
        if (s.key === 'max_upload_size_mb') setMaxUploadSize(Number(s.value) || 50);
        if (s.key === 'default_currency') setDefaultCurrency(s.value);
        if (s.key === 'contact_email') setContactEmail(s.value);
        if (s.key === 'favicon_url') {
          setFaviconUrl(s.value);
          // Show friendly name: "Uploaded file" for internal paths, full URL for external
          setFaviconDisplay(s.value.startsWith('/') ? t('Uploaded file') : s.value);
        }
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: { key: string; value: string; isSecret?: boolean }[] = [
        { key: 'store_name', value: storeName },
        { key: 'storage_mode', value: storageMode },
        { key: 'show_branding', value: String(showBranding) },
        { key: 'max_upload_size_mb', value: String(maxUploadSize) },
        { key: 'default_currency', value: defaultCurrency },
        { key: 'contact_email', value: contactEmail },
        { key: 'favicon_url', value: faviconUrl },
      ];
      if (unsplashKey) {
        entries.push({ key: 'unsplash_key', value: unsplashKey, isSecret: true });
        setUnsplashConfigured(true);
        setUnsplashKey('');
      }
      if (pollinationsKey) {
        entries.push({ key: 'pollinations_key', value: pollinationsKey, isSecret: true });
        setPollinationsConfigured(true);
        setPollinationsKey('');
      }
      await updateSettings(entries);
      // Apply changes immediately to browser
      if (storeName) document.title = `${storeName} — Admin`;
      if (faviconUrl) {
        const resolvedFav = faviconUrl.startsWith('/') ? `${API_BASE}${faviconUrl}` : faviconUrl;
        let link = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
        if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
        link.href = resolvedFav;
      }
      window.dispatchEvent(new CustomEvent('openmerch:settings-changed', { detail: { storeName, faviconUrl } }));
      notifications.show({ title: t('Settings saved'), message: t('Your settings have been saved successfully'), color: 'green' });
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 900 }}>
      <Title order={2} mb="lg">{t('Settings')}</Title>

      {loading ? (
        <Text c="dimmed" size="sm">{t('Loading...')}</Text>
      ) : (
        <Stack gap="md">
          {/* General */}
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">{t('General')}</Text>
            <SimpleGrid cols={2} spacing="md">
              <TextInput
                label={t('Store Name')}
                description={t('Displayed in the admin header, editor, and browser tab title')}
                placeholder="OpenMerch"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
              />
              <TextInput
                label={t('Contact Email')}
                description={t('Support email shown to customers')}
                placeholder="contact@example.com"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
              <Select
                label={t('Default Currency')}
                description={t('Currency for product prices')}
                data={['USD', 'EUR', 'GBP', 'MXN', 'BRL', 'CAD', 'AUD', 'JPY', 'CNY', 'INR']}
                value={defaultCurrency}
                onChange={(v) => setDefaultCurrency(v ?? 'USD')}
              />
              <NumberInput
                label={t('Max Upload Size (MB)')}
                description={t('Maximum file size for image uploads in the editor')}
                value={maxUploadSize}
                onChange={(v) => setMaxUploadSize(Number(v) || 50)}
                min={1}
                max={200}
              />
            </SimpleGrid>
          </Paper>

          {/* Favicon */}
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="xs">{t('Favicon')}</Text>
            <Text size="xs" c="dimmed" mb="sm">{t('Browser tab icon. Upload a .png or .ico file, or paste an external URL.')}</Text>
            <Group gap="sm">
              <TextInput
                placeholder="https://example.com/favicon.png"
                value={faviconDisplay}
                onChange={(e) => { setFaviconDisplay(e.target.value); setFaviconUrl(e.target.value); }}
                style={{ flex: 1 }}
                readOnly={faviconUrl.startsWith('/')}
              />
              <FileButton
                accept=".png,.ico,.svg,image/png,image/x-icon,image/svg+xml"
                onChange={async (file) => {
                  if (!file) return;
                  try {
                    const asset = await uploadAsset(file, 'upload');
                    setFaviconUrl(asset.url);
                    setFaviconDisplay(file.name);
                    notifications.show({ message: t('Favicon uploaded'), color: 'green' });
                  } catch {
                    notifications.show({ message: t('Upload failed'), color: 'red' });
                  }
                }}
              >
                {(props) => <Button variant="light" size="xs" leftSection={<Upload size={14} />} {...props}>{t('Upload')}</Button>}
              </FileButton>
              {faviconUrl && (
                <Button variant="subtle" color="red" size="xs" leftSection={<Trash2 size={14} />} onClick={() => { setFaviconUrl(''); setFaviconDisplay(''); }}>
                  {t('Remove')}
                </Button>
              )}
            </Group>
          </Paper>

          {/* Branding */}
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">{t('Branding')}</Text>
            <Switch
              label={t('Show OpenMerch branding in editor')}
              description={t('Displays "© OpenMerch Engine · Open Source · MIT" footer in the customer editor. Disabling removes the branding completely.')}
              checked={showBranding}
              onChange={(e) => setShowBranding(e.currentTarget.checked)}
            />
          </Paper>

          {/* API Keys */}
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="xs">{t('API Keys')}</Text>
            <Text size="xs" c="dimmed" mb="sm">{t('Keys are encrypted in the database. Leave empty to keep the current key.')}</Text>
            <SimpleGrid cols={2} spacing="md">
              <PasswordInput
                label={<Group gap={6}><span>{t('Unsplash Access Key')}</span>{unsplashConfigured && <Badge size="xs" color="green" variant="light">{t('Configured')}</Badge>}</Group>}
                placeholder={unsplashConfigured ? t('Leave empty to keep current key') : 'unsplash.com/developers'}
                value={unsplashKey}
                onChange={(e) => setUnsplashKey(e.target.value)}
              />
              <PasswordInput
                label={<Group gap={6}><span>{t('Pollinations Key')}</span>{pollinationsConfigured && <Badge size="xs" color="green" variant="light">{t('Configured')}</Badge>}</Group>}
                placeholder={pollinationsConfigured ? t('Leave empty to keep current key') : 'pollinations.ai'}
                value={pollinationsKey}
                onChange={(e) => setPollinationsKey(e.target.value)}
              />
            </SimpleGrid>
          </Paper>

          {/* Design Storage */}
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">{t('Design Storage')}</Text>
            <Stack gap="sm">
              <Select
                label={t('Storage Mode')}
                description={t('Where to store customer design images uploaded in the editor')}
                data={[
                  { value: 'database', label: t('Database (Base64) — simple, no extra setup') },
                  { value: 'minio', label: t('MinIO/S3 — recommended for production') },
                  { value: 'hybrid', label: t('Hybrid — metadata in DB, files in MinIO') },
                ]}
                value={storageMode}
                onChange={(v) => setStorageMode(v ?? 'database')}
              />
              <Text size="xs" c="dimmed">
                {storageMode === 'database' && t('Images are stored as Base64 inside the design JSON in PostgreSQL. Simple but increases DB size. Good for development and small stores.')}
                {storageMode === 'minio' && t('Images are uploaded to MinIO/S3 and the design stores only URLs. Recommended for production — keeps the DB lean and files are served directly.')}
                {storageMode === 'hybrid' && t('Small images (<100KB) stay in the DB, larger ones go to MinIO. Balances simplicity and performance.')}
              </Text>
            </Stack>
          </Paper>

          {/* Infrastructure */}
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">{t('Infrastructure')}</Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">{t('Database')}</Text>
                <Group gap="xs"><Text size="xs">PostgreSQL :5432</Text><Badge size="xs" color="green" variant="light">{t('Connected')}</Badge></Group>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">{t('Storage')}</Text>
                <Anchor size="xs" href="http://localhost:9001" target="_blank">MinIO Console <ExternalLink size={10} style={{ display: 'inline' }} /></Anchor>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Redis</Text>
                <Group gap="xs"><Text size="xs">:6379</Text><Badge size="xs" color="green" variant="light">{t('Connected')}</Badge></Group>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">API</Text>
                <Anchor size="xs" href="http://localhost:3001/api/v1/health" target="_blank">{t('Health Check')} <ExternalLink size={10} style={{ display: 'inline' }} /></Anchor>
              </Group>
            </Stack>
          </Paper>

          <Button onClick={handleSave} loading={saving} leftSection={<Save size={16} />} style={{ alignSelf: 'flex-start' }}>
            {t('Save Settings')}
          </Button>
        </Stack>
      )}
    </div>
  );
}
