import { useState } from 'react';
import {
  Title, Paper, TextInput, PasswordInput, Button, Group, Text, Stack, Badge, Anchor, Divider,
} from '@mantine/core';
import { Save, ExternalLink, Check } from 'lucide-react';

export function SettingsPage() {
  const [unsplashKey, setUnsplashKey] = useState('');
  const [pollinationsKey, setPollinationsKey] = useState('');
  const [storeName, setStoreName] = useState('OpenMerch Store');
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div style={{ maxWidth: 600 }}>
      <Title order={2} mb="lg">Settings</Title>

      <Stack gap="md">
        {/* General */}
        <Paper p="lg" radius="md" withBorder>
          <Text fw={600} size="sm" mb="md">General</Text>
          <TextInput label="Store Name" value={storeName} onChange={(e) => setStoreName(e.target.value)} />
        </Paper>

        {/* API Keys */}
        <Paper p="lg" radius="md" withBorder>
          <Text fw={600} size="sm" mb="md">API Keys</Text>
          <Stack gap="sm">
            <PasswordInput
              label="Unsplash Access Key"
              placeholder="Get key at unsplash.com/developers"
              value={unsplashKey}
              onChange={(e) => setUnsplashKey(e.target.value)}
            />
            <PasswordInput
              label="Pollinations Key"
              placeholder="Get key at enter.pollinations.ai"
              value={pollinationsKey}
              onChange={(e) => setPollinationsKey(e.target.value)}
            />
          </Stack>
        </Paper>

        {/* Infrastructure */}
        <Paper p="lg" radius="md" withBorder>
          <Text fw={600} size="sm" mb="md">Infrastructure</Text>
          <Stack gap="xs">
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Database</Text>
              <Group gap="xs">
                <Text size="xs">PostgreSQL :5432</Text>
                <Badge size="xs" color="green" variant="light">Connected</Badge>
              </Group>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Storage</Text>
              <Group gap="xs">
                <Anchor size="xs" href="http://localhost:9001" target="_blank">
                  MinIO Console <ExternalLink size={10} style={{ display: 'inline' }} />
                </Anchor>
              </Group>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">Redis</Text>
              <Group gap="xs">
                <Text size="xs">:6379</Text>
                <Badge size="xs" color="green" variant="light">Connected</Badge>
              </Group>
            </Group>
            <Divider />
            <Group justify="space-between">
              <Text size="xs" c="dimmed">API</Text>
              <Anchor size="xs" href="http://localhost:3001/api/v1/health" target="_blank">
                Health Check <ExternalLink size={10} style={{ display: 'inline' }} />
              </Anchor>
            </Group>
          </Stack>
        </Paper>

        {/* Save */}
        <Button
          onClick={handleSave}
          leftSection={saved ? <Check size={16} /> : <Save size={16} />}
          color={saved ? 'green' : 'blue'}
          style={{ alignSelf: 'flex-start' }}
        >
          {saved ? 'Saved!' : 'Save Settings'}
        </Button>
      </Stack>
    </div>
  );
}
