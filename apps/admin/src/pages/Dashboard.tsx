import { useEffect, useState } from 'react';
import {
  Title, SimpleGrid, Paper, Text, Group, ThemeIcon, Button, Stack, Badge, Anchor, Divider,
} from '@mantine/core';
import { ShirtIcon, PenTool, Image, Activity, ExternalLink, Plus } from 'lucide-react';
import { listProducts, listDesigns, checkHealth } from '../services/api.js';

interface Stats {
  products: number;
  designs: number;
  apiStatus: string;
  version: string;
}

export function Dashboard() {
  const [stats, setStats] = useState<Stats>({ products: 0, designs: 0, apiStatus: 'checking...', version: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listProducts().catch(() => []),
      listDesigns().catch(() => []),
      checkHealth().catch(() => ({ status: 'offline', version: '?' })),
    ]).then(([products, designs, health]) => {
      setStats({ products: products.length, designs: designs.length, apiStatus: health.status, version: health.version });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div>
        <Title order={2} mb="lg">Dashboard</Title>
        <Text c="dimmed" size="sm">Loading...</Text>
      </div>
    );
  }

  const cards = [
    { label: 'Products', value: stats.products, icon: ShirtIcon, color: 'blue' },
    { label: 'Designs', value: stats.designs, icon: PenTool, color: 'green' },
    { label: 'Assets', value: 0, icon: Image, color: 'orange' },
    { label: 'API Status', value: stats.apiStatus, icon: Activity, color: stats.apiStatus === 'ok' ? 'green' : 'red' },
  ];

  return (
    <div>
      <Title order={2} mb="lg">Dashboard</Title>

      {/* Stats */}
      <SimpleGrid cols={4} mb="xl">
        {cards.map((card) => {
          const Icon = card.icon;
          return (
            <Paper key={card.label} p="md" radius="md" withBorder style={{ overflow: 'visible' }}>
              <Group justify="space-between" wrap="nowrap">
                <div>
                  <Text size="xs" c="dimmed">{card.label}</Text>
                  <Title order={2} mt={4}>{String(card.value)}</Title>
                </div>
                <ThemeIcon size={44} radius="md" variant="light" color={card.color}>
                  <Icon size={22} />
                </ThemeIcon>
              </Group>
            </Paper>
          );
        })}
      </SimpleGrid>

      {/* Quick Actions */}
      <Text fw={600} size="sm" mb="sm">Quick Actions</Text>
      <Group mb="xl">
        <Button component="a" href="/products" leftSection={<Plus size={16} />} color="dark">
          New Product
        </Button>
        <Button component="a" href="http://localhost:3000" target="_blank" leftSection={<ExternalLink size={14} />} variant="default">
          Open Editor
        </Button>
        <Button component="a" href="http://localhost:9001" target="_blank" leftSection={<ExternalLink size={14} />} variant="default">
          MinIO Console
        </Button>
      </Group>

      {/* System Info */}
      <Paper p="md" radius="md" withBorder style={{ overflow: 'visible' }}>
        <Text fw={600} size="sm" mb="md">System Info</Text>
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>API</Text>
            <Group gap="xs" wrap="nowrap">
              <Anchor size="xs" href="http://localhost:3001/api/v1/health" target="_blank">http://localhost:3001</Anchor>
              <Badge size="xs" color="green" variant="light" styles={{ label: { overflow: 'visible' } }}>Online</Badge>
            </Group>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>Editor</Text>
            <Anchor size="xs" href="http://localhost:3000" target="_blank">http://localhost:3000</Anchor>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>MinIO</Text>
            <Anchor size="xs" href="http://localhost:9001" target="_blank">http://localhost:9001</Anchor>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>Database</Text>
            <Text size="xs">PostgreSQL :5432</Text>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>Version</Text>
            <Badge size="xs" variant="light" styles={{ label: { overflow: 'visible' } }}>{stats.version}</Badge>
          </Group>
        </Stack>
      </Paper>
    </div>
  );
}
