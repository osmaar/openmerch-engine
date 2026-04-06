import { useEffect, useState } from 'react';
import {
  Title, Paper, TextInput, PasswordInput, Button, Group, Text, Stack, Badge, Anchor, Divider,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Save, ExternalLink } from 'lucide-react';
import { getSettings, updateSettings } from '../services/api.js';

export function SettingsPage() {
  const [unsplashKey, setUnsplashKey] = useState('');
  const [pollinationsKey, setPollinationsKey] = useState('');
  const [storeName, setStoreName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings().then((settings) => {
      for (const s of settings) {
        if (s.key === 'store_name') setStoreName(s.value);
        if (s.key === 'unsplash_key' && !s.value.startsWith('••')) setUnsplashKey(s.value);
        if (s.key === 'pollinations_key' && !s.value.startsWith('••')) setPollinationsKey(s.value);
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const entries: { key: string; value: string; isSecret?: boolean }[] = [
        { key: 'store_name', value: storeName },
      ];
      if (unsplashKey) entries.push({ key: 'unsplash_key', value: unsplashKey, isSecret: true });
      if (pollinationsKey) entries.push({ key: 'pollinations_key', value: pollinationsKey, isSecret: true });
      await updateSettings(entries);
      notifications.show({ title: 'Settings saved', message: 'Your settings have been saved successfully', color: 'green' });
    } catch (e) {
      notifications.show({ title: 'Error', message: (e as Error).message, color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Title order={2} mb="lg">Settings</Title>

      {loading ? (
        <Text c="dimmed" size="sm">Loading...</Text>
      ) : (
        <Stack gap="md">
          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">General</Text>
            <TextInput label="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
          </Paper>

          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">API Keys</Text>
            <Stack gap="sm">
              <PasswordInput label="Unsplash Access Key" placeholder="Get key at unsplash.com/developers" value={unsplashKey} onChange={(e) => setUnsplashKey(e.target.value)} />
              <PasswordInput label="Pollinations Key" placeholder="Get key at enter.pollinations.ai" value={pollinationsKey} onChange={(e) => setPollinationsKey(e.target.value)} />
            </Stack>
          </Paper>

          <Paper p="lg" radius="md" withBorder>
            <Text fw={600} size="sm" mb="md">Infrastructure</Text>
            <Stack gap="xs">
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Database</Text>
                <Group gap="xs"><Text size="xs">PostgreSQL :5432</Text><Badge size="xs" color="green" variant="light">Connected</Badge></Group>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Storage</Text>
                <Anchor size="xs" href="http://localhost:9001" target="_blank">MinIO Console <ExternalLink size={10} style={{ display: 'inline' }} /></Anchor>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">Redis</Text>
                <Group gap="xs"><Text size="xs">:6379</Text><Badge size="xs" color="green" variant="light">Connected</Badge></Group>
              </Group>
              <Divider />
              <Group justify="space-between">
                <Text size="xs" c="dimmed">API</Text>
                <Anchor size="xs" href="http://localhost:3001/api/v1/health" target="_blank">Health Check <ExternalLink size={10} style={{ display: 'inline' }} /></Anchor>
              </Group>
            </Stack>
          </Paper>

          <Button onClick={handleSave} loading={saving} leftSection={<Save size={16} />} style={{ alignSelf: 'flex-start' }}>
            Save Settings
          </Button>
        </Stack>
      )}
    </div>
  );
}
