import { useEffect, useState } from 'react';
import {
  Title, SimpleGrid, Paper, Text, Group, ThemeIcon, Button, Stack, Badge, Anchor, Divider,
} from '@mantine/core';
import { ShirtIcon, PenTool, Image, Activity, ExternalLink, Plus, ShoppingCart, Hexagon, Type } from 'lucide-react';
import { listProducts, listDesigns, listTemplates, listCliparts, listShapes, listFonts, listOrders, checkHealth } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';

interface Stats {
  products: number;
  designs: number;
  templates: number;
  cliparts: number;
  shapes: number;
  fonts: number;
  orders: number;
  apiStatus: string;
  version: string;
}

export function Dashboard() {
  const t = useT();
  const [stats, setStats] = useState<Stats>({ products: 0, designs: 0, templates: 0, cliparts: 0, shapes: 0, fonts: 0, orders: 0, apiStatus: 'checking...', version: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      listProducts().catch(() => []),
      listDesigns().catch(() => []),
      listTemplates().catch(() => []),
      listCliparts().catch(() => []),
      listShapes().catch(() => []),
      listFonts().catch(() => []),
      listOrders().catch(() => []),
      checkHealth().catch(() => ({ status: 'offline', version: '?' })),
    ]).then(([products, designs, templates, cliparts, shapes, fonts, orders, health]) => {
      setStats({ products: products.length, designs: designs.length, templates: templates.length, cliparts: cliparts.length, shapes: shapes.length, fonts: fonts.length, orders: orders.length, apiStatus: health.status, version: health.version });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div>
        <Title order={2} mb="lg">{t('Dashboard')}</Title>
        <Text c="dimmed" size="sm">{t('Loading...')}</Text>
      </div>
    );
  }

  const cards = [
    { label: t('Products'), value: stats.products, icon: ShirtIcon, color: 'blue' },
    { label: t('Designs'), value: stats.designs, icon: PenTool, color: 'green' },
    { label: t('Templates'), value: stats.templates, icon: Image, color: 'orange' },
    { label: t('Cliparts'), value: stats.cliparts, icon: Image, color: 'violet' },
    { label: t('Shapes'), value: stats.shapes, icon: Hexagon, color: 'cyan' },
    { label: t('Fonts'), value: stats.fonts, icon: Type, color: 'pink' },
    { label: t('Orders'), value: stats.orders, icon: ShoppingCart, color: 'teal' },
    { label: t('API Status'), value: stats.apiStatus, icon: Activity, color: stats.apiStatus === 'ok' ? 'green' : 'red' },
  ];

  return (
    <div>
      <Title order={2} mb="lg">{t('Dashboard')}</Title>

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
      <Text fw={600} size="sm" mb="sm">{t('Quick Actions')}</Text>
      <Group mb="xl">
        <Button component="a" href="/products" leftSection={<Plus size={16} />} color="dark">
          {t('New Product')}
        </Button>
        <Button component="a" href="http://localhost:3000" target="_blank" leftSection={<ExternalLink size={14} />} variant="default">
          {t('Open Editor')}
        </Button>
        <Button component="a" href="http://localhost:9001" target="_blank" leftSection={<ExternalLink size={14} />} variant="default">
          {t('MinIO Console')}
        </Button>
      </Group>

      {/* System Info */}
      <Paper p="md" radius="md" withBorder style={{ overflow: 'visible' }}>
        <Text fw={600} size="sm" mb="md">{t('System Info')}</Text>
        <Stack gap="sm">
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>API</Text>
            <Group gap="xs" wrap="nowrap">
              <Anchor size="xs" href="http://localhost:3001/api/v1/health" target="_blank">http://localhost:3001</Anchor>
              <Badge size="xs" color="green" variant="light" styles={{ label: { overflow: 'visible' } }}>{t('Online')}</Badge>
            </Group>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>{t('Editor')}</Text>
            <Anchor size="xs" href="http://localhost:3000" target="_blank">http://localhost:3000</Anchor>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>MinIO</Text>
            <Anchor size="xs" href="http://localhost:9001" target="_blank">http://localhost:9001</Anchor>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>{t('Database')}</Text>
            <Text size="xs">PostgreSQL :5432</Text>
          </Group>
          <Divider />
          <Group justify="space-between" wrap="nowrap">
            <Text size="xs" c="dimmed" style={{ minWidth: 70 }}>{t('Version')}</Text>
            <Badge size="xs" variant="light" styles={{ label: { overflow: 'visible' } }}>{stats.version}</Badge>
          </Group>
        </Stack>
      </Paper>
    </div>
  );
}
