import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Title, Group, Paper, Table, TextInput, Text, Badge, Modal, Stack, Select, ActionIcon, Divider, Button,
} from '@mantine/core';
import { Search, Eye, ShoppingCart, Filter, ExternalLink, AlertTriangle, WifiOff } from 'lucide-react';
import { listOrders, listWooCommerceWebhookLog } from '../services/api.js';
import type { Order, OrderDesignLine, ProductionStatus, WebhookDelivery } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow', processing: 'blue', completed: 'green', cancelled: 'red', refunded: 'orange',
};

/** `total` is integer cents; `currency` is the order's own ISO 4217 code (e.g. "MXN") —
 *  never assume USD/"$", a merchant selling in another currency needs the real symbol. */
function formatMoney(totalCents: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(totalCents / 100);
  } catch {
    // Intl throws on an unrecognized currency code (e.g. a typo from a misbehaving
    // storefront) — fall back to a plain number rather than crashing the page.
    return `${(totalCents / 100).toFixed(2)} ${currency}`;
  }
}

/** True when this order's payment was reversed but at least one linked design's
 *  production files were already queued/generated - the merchant needs to notice this
 *  themselves (see the warning banner below) since nothing here cancels a BullMQ job
 *  already in flight or undoes files that already exist. */
function hasStaleProduction(order: Order): boolean {
  if (order.status !== 'cancelled' && order.status !== 'refunded') return false;
  return order.designs.some((d) => d.productionStatus === 'queued' || d.productionStatus === 'processing' || d.productionStatus === 'completed');
}

/** Human-readable reason for a rejected WooCommerce webhook delivery — the two ways a real
 *  storefront delivery gets rejected before it ever reaches order processing. */
function webhookFailureLabel(reasonCode: string, t: (key: string) => string): string {
  switch (reasonCode) {
    case 'INVALID_SIGNATURE': return t('Signature mismatch (check the webhook secret in both WooCommerce and OpenMerch)');
    case 'NOT_CONFIGURED': return t('OpenMerch has no webhook secret configured (WOOCOMMERCE_WEBHOOK_SECRET unset)');
    default: return reasonCode;
  }
}

export function Orders() {
  const t = useT();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [webhookFailures, setWebhookFailures] = useState<WebhookDelivery[]>([]);

  const load = () => {
    setLoading(true);
    listOrders().then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Surfaces rejected WooCommerce webhook deliveries — otherwise nothing on the OpenMerch
  // side would ever tell a self-hosted operator that orders are silently failing to arrive.
  useEffect(() => {
    listWooCommerceWebhookLog()
      .then((log) => setWebhookFailures(log.filter((d) => !d.success)))
      .catch(() => setWebhookFailures([]));
  }, []);

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

  // `o.status` is the raw lowercase value stored in the DB ('processing', not
  // 'Processing') — t() is a plain dictionary lookup, so calling it directly on that
  // value never matched the capitalized translation keys used everywhere else on this
  // page (the status filter's own options, productionStatusLabel, etc.) and always fell
  // back to the untranslated English word.
  const orderStatusLabel = (status: string): string => {
    switch (status) {
      case 'pending': return t('Pending');
      case 'processing': return t('Processing');
      case 'completed': return t('Completed');
      case 'cancelled': return t('Cancelled');
      case 'refunded': return t('Refunded');
      default: return status;
    }
  };

  const sourceLabel = (source: string | null): string => {
    switch (source) {
      case 'woocommerce': return 'WooCommerce';
      case 'shopify': return 'Shopify';
      default: return t('Standalone');
    }
  };

  // Jumps to the Designs page (where all production management already lives —
  // generate/regenerate, per-zone downloads, status polling) pre-filtered to this one
  // design, instead of duplicating that toolset inline here.
  const viewInDesigns = (line: OrderDesignLine) => {
    if (!line.designId) return;
    navigate(`/designs?search=${line.designId}`);
  };

  const productSummary = (o: Order): string => {
    const [first, ...rest] = o.designs;
    if (!first) return t('No linked design');
    return rest.length === 0 ? first.productName : `${first.productName} +${rest.length}`;
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

      {webhookFailures[0] && (
        <Paper p="sm" radius="md" withBorder mb="sm" style={{ background: 'var(--mantine-color-red-light)' }}>
          <Group gap="xs" wrap="nowrap" align="flex-start">
            <WifiOff size={16} color="var(--mantine-color-red-7)" style={{ flexShrink: 0, marginTop: 2 }} />
            <Stack gap={2} style={{ minWidth: 0 }}>
              <Text size="xs" fw={600} c="red.9">
                {webhookFailures.length} {t('WooCommerce webhook delivery(ies) rejected recently — orders may be missing.')}
              </Text>
              <Text size="xs" c="red.8">
                {webhookFailureLabel(webhookFailures[0].reasonCode, t)} ({new Date(webhookFailures[0].createdAt).toLocaleString()})
              </Text>
            </Stack>
          </Group>
        </Paper>
      )}

      {/* Order detail modal — business/status info only. Production management (generate
          files, per-zone downloads, regenerate) lives in Designs, one click away via
          "View in Designs" below, rather than a second, thinner copy of the same controls
          here — especially now that an order can carry more than one design. */}
      <Modal opened={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`${t('Order')} ${selectedOrder?.orderId}`} centered size="md">
        {selectedOrder && (
          <Stack>
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Order ID')}</Text><Text size="sm">{selectedOrder.orderId}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Customer')}</Text><Text size="sm">{selectedOrder.customerName}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Status')}</Text><Badge color={STATUS_COLORS[selectedOrder.status]} variant="light">{orderStatusLabel(selectedOrder.status)}</Badge></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Total')}</Text><Text size="sm" fw={700}>{formatMoney(selectedOrder.total, selectedOrder.currency)}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>{t('Date')}</Text><Text size="sm">{new Date(selectedOrder.createdAt).toLocaleString()}</Text></Group>
            {hasStaleProduction(selectedOrder) && (
              <>
                <Divider />
                <Paper p="sm" radius="md" style={{ background: 'var(--mantine-color-orange-light)' }}>
                  <Group gap="xs" wrap="nowrap" align="flex-start">
                    <AlertTriangle size={16} color="var(--mantine-color-orange-7)" style={{ flexShrink: 0, marginTop: 2 }} />
                    <Text size="xs" c="orange.9">
                      {t('This order was cancelled or refunded, but production files were already generated or are in progress — check before shipping.')}
                    </Text>
                  </Group>
                </Paper>
              </>
            )}
            <Divider />
            <Text size="sm" fw={500}>{t('Customized products')} ({selectedOrder.designs.length})</Text>
            {selectedOrder.designs.length === 0 ? (
              <Text size="xs" c="dimmed" ta="center" p="sm">{t('No design linked to this order')}</Text>
            ) : (
              <Stack gap="xs">
                {selectedOrder.designs.map((line) => (
                  <Paper key={line.id} p="sm" radius="md" withBorder>
                    <Group justify="space-between" wrap="nowrap">
                      <Stack gap={2} style={{ minWidth: 0 }}>
                        <Text size="sm" fw={500} truncate>{line.productName}</Text>
                        <Group gap={6}>
                          <Badge size="xs" variant="light" color="gray">{sourceLabel(line.source)}</Badge>
                          <Badge size="xs" variant="light" color={productionStatusColor(line.productionStatus)}>
                            {productionStatusLabel(line.productionStatus)}
                          </Badge>
                        </Group>
                      </Stack>
                      <ActionIcon variant="subtle" color="blue" onClick={() => viewInDesigns(line)} title={t('View in Designs')} disabled={!line.designId}>
                        <ExternalLink size={16} />
                      </ActionIcon>
                    </Group>
                  </Paper>
                ))}
              </Stack>
            )}
            <Group justify="flex-end"><Button variant="default" onClick={() => setSelectedOrder(null)}>{t('Close')}</Button></Group>
          </Stack>
        )}
      </Modal>

      {/* Toolbar */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <Select size="xs" w={140} placeholder={t('Status')} data={[{ value: 'pending', label: t('Pending') }, { value: 'processing', label: t('Processing') }, { value: 'completed', label: t('Completed') }, { value: 'cancelled', label: t('Cancelled') }, { value: 'refunded', label: t('Refunded') }]} value={filterStatus} onChange={setFilterStatus} clearable leftSection={<Filter size={14} />} />
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
                <Table.Th w={60}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td><Text size="sm" fw={600}>{o.orderId}</Text></Table.Td>
                  <Table.Td><Text size="sm">{o.customerName}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{productSummary(o)}</Text></Table.Td>
                  <Table.Td><Badge color={STATUS_COLORS[o.status]} variant="light" size="sm">{orderStatusLabel(o.status)}</Badge></Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{formatMoney(o.total, o.currency)}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{new Date(o.createdAt).toLocaleDateString()}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4} wrap="nowrap" justify="flex-end">
                      {hasStaleProduction(o) && (
                        <AlertTriangle size={14} color="var(--mantine-color-orange-7)" aria-label={t('Cancelled/refunded with production already generated')} />
                      )}
                      <ActionIcon variant="subtle" color="blue" onClick={() => setSelectedOrder(o)} title={t('View details')}><Eye size={16} /></ActionIcon>
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
