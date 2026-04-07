import { useEffect, useState } from 'react';
import {
  Title, Paper, Table, ActionIcon, Group, Text, Stack, Badge, Checkbox, Select, Menu, Pagination, TextInput, Button,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Trash2, Download, PenTool, Search, Filter, Calendar } from 'lucide-react';
import { listDesigns, deleteDesign, listProducts } from '../services/api.js';
import type { Design, Product } from '../services/api.js';
import { useConfirm } from '../hooks/useConfirm.js';
import { useT } from '../i18n/useTranslation.js';

type SortOrder = 'newest' | 'oldest' | 'az' | 'za';

export function Designs() {
  const t = useT();
  const [designs, setDesigns] = useState<Design[]>([]);
  const [products, setProducts] = useState<Map<string, Product>>(new Map());
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const perPage = 20;

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      notifications.show({ title: t('Copied'), message: `${label}: ${text}`, color: 'green' });
    });
  };

  const load = () => {
    setLoading(true);
    Promise.all([
      listDesigns().catch(() => []),
      listProducts().catch(() => []),
    ]).then(([d, p]) => {
      setDesigns(d);
      setProducts(new Map(p.map((prod) => [prod.id, prod])));
    }).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const getProductName = (productId: string): string => {
    return products.get(productId)?.name ?? productId.substring(0, 8) + '...';
  };

  const filtered = designs
    .filter((d) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const productName = getProductName(d.productId).toLowerCase();
        if (!d.name.toLowerCase().includes(q) && !d.productId.toLowerCase().includes(q) && !productName.includes(q)) return false;
      }
      if (dateFrom) {
        if (new Date(d.createdAt) < new Date(dateFrom)) return false;
      }
      if (dateTo) {
        const end = new Date(dateTo);
        end.setHours(23, 59, 59, 999);
        if (new Date(d.createdAt) > end) return false;
      }
      return true;
    })
    .sort((a, b) => {
      switch (sortOrder) {
        case 'az': return a.name.localeCompare(b.name);
        case 'za': return b.name.localeCompare(a.name);
        case 'newest': return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case 'oldest': return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default: return 0;
      }
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const handleDelete = async (id: string) => {
    confirm(t('Delete Design'), t('Are you sure you want to delete this design? This action cannot be undone.'), async () => {
      await deleteDesign(id).catch(() => {});
      notifications.show({ title: t('Design deleted'), message: t('The design has been deleted'), color: 'red' });
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      load();
    });
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    confirm(t('Delete Designs'), `${t('Are you sure you want to delete')} ${selected.size} ${t('design(s)?')} ${t('This action cannot be undone.')}`, async () => {
      await Promise.all(Array.from(selected).map((id) => deleteDesign(id).catch(() => {})));
      notifications.show({ title: t('Designs deleted'), message: `${selected.size} ${t('design(s) have been deleted')}`, color: 'red' });
      setSelected(new Set());
      load();
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((d) => d.id)));
  };

  const handleDownload = (d: Design) => {
    const blob = new Blob([JSON.stringify(d.designData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${d.name}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <Group justify="space-between" mb="xs">
        <Title order={2}>{t('Customer Designs')}</Title>
      </Group>
      <Text size="sm" c="dimmed" mb="md">
        {t('Designs created by customers using the OpenMerch Editor. These are saved when a customer adds an item to cart or completes their design.')}
      </Text>

      {/* Toolbar — single row */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group gap="xs" wrap="nowrap">
          <Menu shadow="md" width={200}>
            <Menu.Target>
              <Button variant="default" size="xs" disabled={selected.size === 0}>
                {t('Bulk Actions')} ({selected.size})
              </Button>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={handleBulkDelete}>
                {t('Delete Selected')}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
          <Select
            size="xs"
            w={140}
            value={sortOrder}
            onChange={(v) => { setSortOrder((v as SortOrder) ?? 'newest'); setPage(1); }}
            data={[
              { value: 'newest', label: t('Newest First') },
              { value: 'oldest', label: t('Oldest First') },
              { value: 'az', label: t('Name A→Z') },
              { value: 'za', label: t('Name Z→A') },
            ]}
            leftSection={<Filter size={14} />}
          />
          <TextInput
            type="date"
            size="xs"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            leftSection={<Calendar size={14} />}
            title={t('From')}
            w={150}
          />
          <TextInput
            type="date"
            size="xs"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            leftSection={<Calendar size={14} />}
            title={t('To')}
            w={150}
          />
          {(dateFrom || dateTo) && (
            <ActionIcon variant="subtle" color="gray" size="sm" onClick={() => { setDateFrom(''); setDateTo(''); setPage(1); }} title={t('Clear dates')}>
              <Trash2 size={14} />
            </ActionIcon>
          )}
          <TextInput
            size="xs"
            placeholder={t('Search by name or product...')}
            leftSection={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1 }}
          />
          <Text size="xs" c="dimmed" style={{ whiteSpace: 'nowrap' }}>{filtered.length} {t('design(s)')}</Text>
        </Group>
      </Paper>

      <Paper radius="md" withBorder>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">{t('Loading...')}</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <PenTool size={40} opacity={0.3} />
            <Text c="dimmed" size="sm">{search ? t('No designs match your search') : t('No designs yet')}</Text>
            <Text c="dimmed" size="xs">{t('Designs appear here when users save from the editor')}</Text>
          </Stack>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}>
                    <Checkbox
                      size="xs"
                      checked={selected.size === paginated.length && paginated.length > 0}
                      indeterminate={selected.size > 0 && selected.size < paginated.length}
                      onChange={toggleSelectAll}
                    />
                  </Table.Th>
                  <Table.Th>{t('Name')}</Table.Th>
                  <Table.Th>{t('Product')}</Table.Th>
                  <Table.Th>{t('Created')}</Table.Th>
                  <Table.Th>{t('Updated')}</Table.Th>
                  <Table.Th w={100}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginated.map((d) => (
                  <Table.Tr key={d.id} bg={selected.has(d.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                    <Table.Td>
                      <Checkbox size="xs" checked={selected.has(d.id)} onChange={() => toggleSelect(d.id)} />
                    </Table.Td>
                    <Table.Td fw={500}>{d.name}</Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color="blue"
                        size="sm"
                        style={{ cursor: 'pointer' }}
                        title={`${t('Click to copy ID')}: ${d.productId}`}
                        onClick={() => copyToClipboard(d.productId, t('Product ID'))}
                      >
                        {getProductName(d.productId)}
                      </Badge>
                    </Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{new Date(d.createdAt).toLocaleString()}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{new Date(d.updatedAt).toLocaleString()}</Text></Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <ActionIcon variant="subtle" color="blue" onClick={() => handleDownload(d)} title={t('Download JSON')}>
                          <Download size={16} />
                        </ActionIcon>
                        <ActionIcon variant="subtle" color="red" onClick={() => handleDelete(d.id)} title={t('Delete')}>
                          <Trash2 size={16} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {totalPages > 1 && (
              <Group justify="center" p="md">
                <Pagination total={totalPages} value={page} onChange={setPage} size="sm" />
              </Group>
            )}
          </>
        )}
      </Paper>
    </div>
  );
}
