import { useEffect, useState } from 'react';
import {
  Title, Group, Paper, Table, TextInput, Text, Badge, Modal, Stack, Select, ActionIcon, Divider, Button,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Search, Download, Eye, ShoppingCart, Filter, FileImage, RefreshCw } from 'lucide-react';
import { listOrders, getDesign, generateProductionFiles } from '../services/api.js';
import type { Order, Design, ProductionStatus } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow', processing: 'blue', completed: 'green', cancelled: 'red',
};

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export function Orders() {
  const t = useT();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedDesign, setSelectedDesign] = useState<Design | null>(null);
  const [loadingDesign, setLoadingDesign] = useState(false);

  const load = () => {
    setLoading(true);
    listOrders().then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // When the modal opens with an order, fetch its linked design so we can show
  // production status + download links per zone.
  useEffect(() => {
    if (!selectedOrder?.designId) {
      setSelectedDesign(null);
      return;
    }
    setLoadingDesign(true);
    getDesign(selectedOrder.designId)
      .then(setSelectedDesign)
      .catch(() => setSelectedDesign(null))
      .finally(() => setLoadingDesign(false));
  }, [selectedOrder]);

  const productionStatusColor = (s: ProductionStatus): string => {
    switch (s) {
      case 'completed': return 'green';
      case 'processing': return 'blue';
      case 'queued': return 'gray';
      case 'failed': return 'red';
      default: return 'gray';
    }
  };

  const productionStatusLabel = (s: ProductionStatus): string => {
    switch (s) {
      case 'completed': return t('Files ready');
      case 'processing': return t('Processing');
      case 'queued': return t('Queued');
      case 'failed': return t('Failed');
      default: return t('Not generated');
    }
  };

  const handleGenerate = async (designId: string) => {
    try {
      await generateProductionFiles(designId);
      notifications.show({
        title: t('Generation queued'),
        message: t('production files will be generated shortly'),
        color: 'blue',
      });
      // Refetch the design after a short delay to pick up the new status.
      setTimeout(async () => {
        if (selectedOrder?.designId) {
          const fresh = await getDesign(selectedOrder.designId).catch(() => null);
          if (fresh) setSelectedDesign(fresh);
        }
      }, 1500);
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    }
  };

  const handleDownloadJson = (design: Design) => {
    const blob = new Blob([JSON.stringify(design.designData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${design.name}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = orders
    .filter((o) => {
      if (search.trim() && !o.orderId.includes(search) && !o.customerName.toLowerCase().includes(search.toLowerCase())) return false;
      if (filterStatus && o.status !== filterStatus) return false;
      return true;
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('Orders')}</Title>
      </Group>

      {/* Order detail modal */}
      <Modal opened={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`${t('Order')} ${selectedOrder?.orderId}`} centered size="md">
        {selectedOrder && (
          <Stack>
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Order ID')}</Text><Text size="sm">{selectedOrder.orderId}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Customer')}</Text><Text size="sm">{selectedOrder.customerName}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Product')}</Text><Text size="sm">{selectedOrder.productName}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Status')}</Text><Badge color={STATUS_COLORS[selectedOrder.status]} variant="light">{t(selectedOrder.status)}</Badge></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Total')}</Text><Text size="sm" fw={700}>${(selectedOrder.total / 100).toFixed(2)}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Date')}</Text><Text size="sm">{new Date(selectedOrder.createdAt).toLocaleString()}</Text></Group>
            <Divider />
            <Group justify="space-between" align="center">
              <Text size="sm" fw={500}>{t('Production Files')}</Text>
              {selectedDesign && (
                <Badge size="sm" color={productionStatusColor(selectedDesign.productionStatus)} variant="light">
                  {productionStatusLabel(selectedDesign.productionStatus)}
                </Badge>
              )}
            </Group>
            <Paper p="md" radius="md" withBorder>
              {loadingDesign ? (
                <Text size="xs" c="dimmed" ta="center">{t('Loading...')}</Text>
              ) : !selectedDesign ? (
                <Text size="xs" c="dimmed" ta="center">{t('No design linked to this order')}</Text>
              ) : (
                <Stack gap="xs">
                  {/* Per-zone download links — print file + mockup per zone */}
                  {selectedDesign.productionFiles && Object.keys(selectedDesign.productionFiles).length > 0 && (
                    <Stack gap="sm">
                      {Object.entries(selectedDesign.productionFiles).map(([zoneId, urls]) => (
                        <Stack key={zoneId} gap={4}>
                          <Text size="xs" fw={600} tt="capitalize">{zoneId}</Text>
                          <Group gap="xs">
                            <Button
                              component="a"
                              href={`${API_BASE}${urls.print}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              variant="light"
                              leftSection={<Download size={14} />}
                              size="xs"
                            >
                              {t('Print file')}
                            </Button>
                            {urls.mockup && (
                              <Button
                                component="a"
                                href={`${API_BASE}${urls.mockup}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                variant="light"
                                leftSection={<Download size={14} />}
                                size="xs"
                              >
                                {t('Mockup preview')}
                              </Button>
                            )}
                          </Group>
                        </Stack>
                      ))}
                    </Stack>
                  )}
                  {selectedDesign.productionError && (
                    <Text size="xs" c="red">{selectedDesign.productionError}</Text>
                  )}
                  <Group justify="space-between" mt="xs">
                    <Button
                      variant="light"
                      color="grape"
                      leftSection={
                        selectedDesign.productionStatus === 'completed' ? <RefreshCw size={14} /> : <FileImage size={14} />
                      }
                      size="xs"
                      onClick={() => handleGenerate(selectedDesign.id)}
                      loading={selectedDesign.productionStatus === 'queued' || selectedDesign.productionStatus === 'processing'}
                    >
                      {selectedDesign.productionStatus === 'completed' ? t('Regenerate files') : t('Generate files')}
                    </Button>
                    <Button
                      variant="light"
                      leftSection={<Download size={14} />}
                      size="xs"
                      onClick={() => handleDownloadJson(selectedDesign)}
                    >
                      {t('Download')} JSON
                    </Button>
                  </Group>
                </Stack>
              )}
            </Paper>
            <Group justify="flex-end"><Button variant="default" onClick={() => setSelectedOrder(null)}>{t('Close')}</Button></Group>
          </Stack>
        )}
      </Modal>

      {/* Toolbar */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <Select size="xs" w={140} placeholder={t('Status')} data={[{ value: 'pending', label: t('Pending') }, { value: 'processing', label: t('Processing') }, { value: 'completed', label: t('Completed') }, { value: 'cancelled', label: t('Cancelled') }]} value={filterStatus} onChange={setFilterStatus} clearable leftSection={<Filter size={14} />} />
            <Text size="xs" c="dimmed">{filtered.length} {t('order(s)')}</Text>
          </Group>
          <TextInput size="xs" placeholder={t('Search by ID or customer...')} leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={250} />
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">{t('Loading...')}</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><ShoppingCart size={40} opacity={0.3} /><Text c="dimmed" size="sm">{t('No orders yet')}</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t('Order')}</Table.Th>
                <Table.Th>{t('Customer')}</Table.Th>
                <Table.Th>{t('Product')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
                <Table.Th>{t('Total')}</Table.Th>
                <Table.Th>{t('Date')}</Table.Th>
                <Table.Th w={80}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td><Text size="sm" fw={600}>{o.orderId}</Text></Table.Td>
                  <Table.Td><Text size="sm">{o.customerName}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{o.productName}</Text></Table.Td>
                  <Table.Td><Badge color={STATUS_COLORS[o.status]} variant="light" size="sm">{t(o.status)}</Badge></Table.Td>
                  <Table.Td><Text size="sm" fw={500}>${(o.total / 100).toFixed(2)}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{new Date(o.createdAt).toLocaleDateString()}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => setSelectedOrder(o)} title={t('View details')}><Eye size={16} /></ActionIcon>
                      <ActionIcon variant="subtle" color="gray" title={t('Download design')}><Download size={16} /></ActionIcon>
                    </Group>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
