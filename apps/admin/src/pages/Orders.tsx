import { useEffect, useState } from 'react';
import {
  Title, Group, Paper, Table, TextInput, Text, Badge, Modal, Stack, Select, ActionIcon, Divider, Button,
} from '@mantine/core';
import { Search, Download, Eye, ShoppingCart, Filter } from 'lucide-react';
import { listOrders } from '../services/api.js';
import type { Order } from '../services/api.js';

const STATUS_COLORS: Record<string, string> = {
  pending: 'yellow', processing: 'blue', completed: 'green', cancelled: 'red',
};

export function Orders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  const load = () => {
    setLoading(true);
    listOrders().then(setOrders).catch(() => setOrders([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

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
        <Title order={2}>Orders</Title>
      </Group>

      {/* Order detail modal */}
      <Modal opened={!!selectedOrder} onClose={() => setSelectedOrder(null)} title={`Order ${selectedOrder?.orderId}`} centered size="md">
        {selectedOrder && (
          <Stack>
            <Group justify="space-between"><Text size="sm" fw={500}>Order ID</Text><Text size="sm">{selectedOrder.orderId}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>Customer</Text><Text size="sm">{selectedOrder.customerName}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>Product</Text><Text size="sm">{selectedOrder.productName}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>Status</Text><Badge color={STATUS_COLORS[selectedOrder.status]} variant="light">{selectedOrder.status}</Badge></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>Total</Text><Text size="sm" fw={700}>${(selectedOrder.total / 100).toFixed(2)}</Text></Group>
            <Divider />
            <Group justify="space-between"><Text size="sm" fw={500}>Date</Text><Text size="sm">{new Date(selectedOrder.createdAt).toLocaleString()}</Text></Group>
            <Divider />
            <Text size="sm" fw={500}>Design Files</Text>
            <Paper p="md" radius="md" withBorder>
              <Group justify="center" gap="md">
                <Button variant="light" leftSection={<Download size={14} />} size="xs">Download PNG</Button>
                <Button variant="light" leftSection={<Download size={14} />} size="xs">Download SVG</Button>
                <Button variant="light" leftSection={<Download size={14} />} size="xs">Download JSON</Button>
              </Group>
            </Paper>
            <Group justify="flex-end"><Button variant="default" onClick={() => setSelectedOrder(null)}>Close</Button></Group>
          </Stack>
        )}
      </Modal>

      {/* Toolbar */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <Select size="xs" w={140} placeholder="Status" data={[{ value: 'pending', label: 'Pending' }, { value: 'processing', label: 'Processing' }, { value: 'completed', label: 'Completed' }, { value: 'cancelled', label: 'Cancelled' }]} value={filterStatus} onChange={setFilterStatus} clearable leftSection={<Filter size={14} />} />
            <Text size="xs" c="dimmed">{filtered.length} order(s)</Text>
          </Group>
          <TextInput size="xs" placeholder="Search by ID or customer..." leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={250} />
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">Loading...</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><ShoppingCart size={40} opacity={0.3} /><Text c="dimmed" size="sm">No orders yet</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th>Order</Table.Th>
                <Table.Th>Customer</Table.Th>
                <Table.Th>Product</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th>Total</Table.Th>
                <Table.Th>Date</Table.Th>
                <Table.Th w={80}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((o) => (
                <Table.Tr key={o.id}>
                  <Table.Td><Text size="sm" fw={600}>{o.orderId}</Text></Table.Td>
                  <Table.Td><Text size="sm">{o.customerName}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{o.productName}</Text></Table.Td>
                  <Table.Td><Badge color={STATUS_COLORS[o.status]} variant="light" size="sm">{o.status}</Badge></Table.Td>
                  <Table.Td><Text size="sm" fw={500}>${(o.total / 100).toFixed(2)}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{new Date(o.createdAt).toLocaleDateString()}</Text></Table.Td>
                  <Table.Td>
                    <Group gap={4}>
                      <ActionIcon variant="subtle" color="blue" onClick={() => setSelectedOrder(o)} title="View details"><Eye size={16} /></ActionIcon>
                      <ActionIcon variant="subtle" color="gray" title="Download design"><Download size={16} /></ActionIcon>
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
