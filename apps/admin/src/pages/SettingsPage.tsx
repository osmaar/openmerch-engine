import { useEffect, useState } from 'react';
import {
  Title, Paper, TextInput, PasswordInput, Button, Group, Text, Stack, Badge, Anchor, Divider, Select,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Save, ExternalLink } from 'lucide-react';
import { getSettings, updateSettings } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';

export function SettingsPage() {
  const t = useT();
  const [unsplashKey, setUnsplashKey] = useState('');
  const [pollinationsKey, setPollinationsKey] = useState('');
  const [storeName, setStoreName] = useState('');
  const [storageMode, setStorageMode] = useState('database');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((settings) => {
      for (const s of settings) {
        if (s.key === 'store_name') setStoreName(s.value);
        if (s.key === 'unsplash_key' && !s.value.startsWith('••')) setUnsplashKey(s.value);
        if (s.key === 'pollinations_key' && !s.value.startsWith('••')) setPollinationsKey(s.value);
        if (s.key === 'storage_mode') setStorageMode(s.value);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: { key: string; value: string; isSecret?: boolean }[] = [
        { key: 'store_name', value: storeName },
        { key: 'storage_mode', value: storageMode },
      ];
      if (unsplashKey) entries.push({ key: 'unsplash_key', value: unsplashKey, isSecret: true });
      if (pollinationsKey) entries.push({ key: 'pollinations_key', value: pollinationsKey, isSecret: true });
      await updateSettings(entries);
      notifications.show({ title: t('Settings saved'), message: t('Your settings have been saved successfully'), color: 'green' });
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Title order={2} mb="lg">{t('Settings')}</Title>

      {loading ? (
        <Text c="dimmed" size="sm">{t('Loading...')}</Text>
      ) : (
        <Stack gap="md">
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">{t('General')}</Text>
            <TextInput label={t('Store Name')} value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Paper>

          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">{t('API Keys')}</Text>
            <Stack gap="sm">
              <PasswordInput label={t('Unsplash Access Key')} placeholder={t('Get key at unsplash.com/developers')} value={unsplashKey} onChange={(e) => setUnsplashKey(e.target.value)} />
              <PasswordInput label={t('Pollinations Key')} placeholder={t('Get key at enter.pollinations.ai')} value={pollinationsKey} onChange={(e) => setPollinationsKey(e.target.value)} />
            </Stack>
          </Paper>

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
