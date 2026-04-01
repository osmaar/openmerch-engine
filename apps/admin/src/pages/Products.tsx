import { useEffect, useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Checkbox, Select, Menu, Pagination,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, ExternalLink, ShirtIcon, Search, MoreHorizontal, Filter, Power, Pencil } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { listProducts, createProduct, deleteProduct } from '../services/api.js';
import type { Product } from '../services/api.js';
import { useConfirm } from '../hooks/useConfirm.js';

type SortOrder = 'az' | 'za' | 'newest' | 'oldest';

export function Products() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newSlug, setNewSlug] = useState('');
  const [newDescription, setNewDescription] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Selection
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const load = () => {
    setLoading(true);
    listProducts().then(setProducts).catch(() => setProducts([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  // Filter and sort
  const filtered = products
    .filter((p) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return p.name.toLowerCase().includes(q) || p.slug.toLowerCase().includes(q);
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

  const handleCreate = async () => {
    if (!newName.trim() || !newSlug.trim()) return;
    await createProduct({
      name: newName, slug: newSlug,
      zones: [{
        id: 'front', name: 'Front',
        baseImageWidthMM: 500, baseImageHeightMM: 500,
        printAreaWidthMM: 200, printAreaHeightMM: 300,
        printAreaXMM: 150, printAreaYMM: 105, baseImageUrl: '',
      }],
    });
    setNewName(''); setNewSlug(''); setNewDescription(''); setShowCreate(false);
    notifications.show({ title: 'Product created', message: `"${newName}" has been created successfully`, color: 'green' });
    load();
  };

  const handleDelete = async (id: string) => {
    confirm('Delete Product', 'Are you sure you want to delete this product? This action cannot be undone.', async () => {
      await deleteProduct(id).catch(() => {});
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      notifications.show({ title: 'Product deleted', message: 'The product has been deleted', color: 'red' });
      load();
    });
  };

  const handleBulkDelete = async () => {
    if (selected.size === 0) return;
    confirm('Delete Products', `Are you sure you want to delete ${selected.size} product(s)? This action cannot be undone.`, async () => {
      await Promise.all(Array.from(selected).map((id) => deleteProduct(id).catch(() => {})));
      notifications.show({ title: 'Products deleted', message: `${selected.size} product(s) have been deleted`, color: 'red' });
      setSelected(new Set());
      load();
    });
  };

  const handleToggleStatus = async (_id: string) => {
    // TODO: implement status toggle when API supports it
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(paginated.map((p) => p.id)));
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Products Base</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => navigate('/products/new')}>
          Add New Product Base
        </Button>
      </Group>

      {/* Create modal */}
      <Modal opened={showCreate} onClose={() => setShowCreate(false)} title="New Product Base" centered size="md">
        <Stack>
          <TextInput
            label="Name"
            placeholder="Basic T-Shirt"
            value={newName}
            onChange={(e) => {
              setNewName(e.target.value);
              setNewSlug(e.target.value.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
            }}
            required
          />
          <TextInput
            label="Slug"
            placeholder="basic-tshirt"
            value={newSlug}
            onChange={(e) => setNewSlug(e.target.value)}
            required
          />
          <TextInput
            label="Description"
            placeholder="Short description of this product"
            value={newDescription}
            onChange={(e) => setNewDescription(e.target.value)}
          />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || !newSlug.trim()}>Create Product</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Toolbar: Bulk actions + Filters + Search */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Group gap="sm">
            {/* Bulk actions */}
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="default" size="xs" disabled={selected.size === 0}>
                  Bulk Actions ({selected.size})
                </Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={handleBulkDelete}>
                  Delete Selected
                </Menu.Item>
              </Menu.Dropdown>
            </Menu>

            {/* Sort */}
            <Select
              size="xs"
              w={150}
              value={sortOrder}
              onChange={(v) => { setSortOrder((v as SortOrder) ?? 'newest'); setPage(1); }}
              data={[
                { value: 'az', label: 'Name A→Z' },
                { value: 'za', label: 'Name Z→A' },
                { value: 'newest', label: 'Newest First' },
                { value: 'oldest', label: 'Oldest First' },
              ]}
              leftSection={<Filter size={14} />}
            />

            <Text size="xs" c="dimmed">{filtered.length} product(s)</Text>
          </Group>

          {/* Search */}
          <TextInput
            size="xs"
            placeholder="Search products..."
            leftSection={<Search size={14} />}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            w={220}
          />
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">Loading...</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <ShirtIcon size={40} opacity={0.3} />
            <Text c="dimmed" size="sm">{search ? 'No products match your search' : 'No products yet'}</Text>
            {!search && <Text c="dimmed" size="xs">Click "Add New Product Base" to create one</Text>}
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
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Description</Table.Th>
                  <Table.Th>Stages</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={100}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginated.map((p) => (
                  <Table.Tr
                    key={p.id}
                    bg={selected.has(p.id) ? 'var(--mantine-color-blue-light)' : undefined}
                  >
                    <Table.Td>
                      <Checkbox
                        size="xs"
                        checked={selected.has(p.id)}
                        onChange={() => toggleSelect(p.id)}
                      />
                    </Table.Td>
                    <Table.Td>
                      <Group gap="sm">
                        <div style={{
                          width: 36, height: 36, borderRadius: 6, background: '#f0f0f0',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          <ShirtIcon size={18} color="#888" />
                        </div>
                        <div>
                          <Text size="sm" fw={500}>{p.name}</Text>
                          <Text size="xs" c="dimmed">{p.slug}</Text>
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs" c="dimmed" lineClamp={1}>—</Text>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color="blue" size="sm">
                        {Array.isArray(p.zones) ? p.zones.length : 0} stage(s)
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        color="green"
                        size="sm"
                        styles={{ label: { overflow: 'visible' } }}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleToggleStatus(p.id)}
                      >
                        Active
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <ActionIcon variant="subtle" color="blue" onClick={() => window.open(`http://localhost:3000?product=${p.id}`, '_blank')} title="Open in Editor">
                          <ExternalLink size={16} />
                        </ActionIcon>
                        <Menu shadow="md" width={160} position="bottom-end">
                          <Menu.Target>
                            <ActionIcon variant="subtle" color="gray">
                              <MoreHorizontal size={16} />
                            </ActionIcon>
                          </Menu.Target>
                          <Menu.Dropdown>
                            <Menu.Item leftSection={<Pencil size={14} />} onClick={() => navigate(`/products/${p.id}/edit`)}>
                              Edit Product
                            </Menu.Item>
                            <Menu.Item leftSection={<ExternalLink size={14} />} onClick={() => window.open(`http://localhost:3000?product=${p.id}`, '_blank')}>
                              Open in Editor
                            </Menu.Item>
                            <Menu.Item leftSection={<Power size={14} />} onClick={() => handleToggleStatus(p.id)}>
                              Deactivate
                            </Menu.Item>
                            <Menu.Divider />
                            <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => handleDelete(p.id)}>
                              Delete
                            </Menu.Item>
                          </Menu.Dropdown>
                        </Menu>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>

            {/* Pagination */}
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
