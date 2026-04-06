import { useEffect, useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Checkbox, Select, Menu, Pagination, MultiSelect, NumberInput, Switch, TagsInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, MoreHorizontal, Filter, Star, StarOff, Package, Upload } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';
import { listTemplates, createTemplate, updateTemplate, deleteTemplate } from '../services/api.js';
import type { Template } from '../services/api.js';

const TEMPLATE_CATEGORIES = [
  'T-Shirts', 'Sports', 'Music', 'Vintage', 'Typography',
  'Animals', 'Abstract', 'Holidays', 'Business', 'Funny',
];

type SortOrder = 'az' | 'za' | 'newest' | 'oldest';

export function Templates() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const perPage = 20;

  // New template form
  const [newName, setNewName] = useState('');
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newFeatured, setNewFeatured] = useState(false);
  const [newActive, setNewActive] = useState(true);
  const [newFilePreview, setNewFilePreview] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');

  const load = () => {
    setLoading(true);
    listTemplates().then(setTemplates).catch(() => setTemplates([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = templates
    .filter((t) => {
      if (search.trim() && !t.name.toLowerCase().includes(search.toLowerCase()) && !t.tags.some((tag: string) => tag.toLowerCase().includes(search.toLowerCase()))) return false;
      if (filterCategory && !t.categories.includes(filterCategory)) return false;
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createTemplate({
        name: newName, categories: newCategories, tags: newTags,
        price: newPrice, featured: newFeatured, active: newActive,
        fileName: newFileName || null,
      });
      notifications.show({ title: 'Template created', message: `"${newName}" has been created successfully`, color: 'green' });
      setNewName(''); setNewCategories([]); setNewTags([]); setNewPrice(0);
      setNewFeatured(false); setNewActive(true); setNewFilePreview(null); setNewFileName(''); setShowCreate(false);
      load();
    } catch (e) {
      notifications.show({ title: 'Error', message: (e as Error).message, color: 'red' });
    }
  };

  const handleDelete = (id: string) => {
    confirm('Delete Template', 'Are you sure you want to delete this template? This action cannot be undone.', async () => {
      await deleteTemplate(id);
      notifications.show({ title: 'Template deleted', message: 'The template has been deleted', color: 'red' });
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      load();
    });
  };

  const toggleFeatured = async (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    await updateTemplate(id, { featured: !t.featured });
    load();
  };

  const toggleActive = async (id: string) => {
    const t = templates.find((x) => x.id === id);
    if (!t) return;
    await updateTemplate(id, { active: !t.active });
    load();
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    confirm('Delete Templates', `Are you sure you want to delete ${selected.size} template(s)? This action cannot be undone.`, async () => {
      await Promise.all(Array.from(selected).map((id) => deleteTemplate(id).catch(() => {})));
      notifications.show({ title: 'Templates deleted', message: `${selected.size} template(s) have been deleted`, color: 'red' });
      setSelected(new Set());
      load();
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((t) => t.id)));
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Design Templates</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>
          Add New Template
        </Button>
      </Group>

      {/* Create modal */}
      <Modal opened={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setNewCategories([]); setNewTags([]); setNewPrice(0); setNewFeatured(false); setNewActive(true); setNewFilePreview(null); setNewFileName(''); }} title="Add New Template" centered size="md">
        <Stack>
          <TextInput label="Name" description="The name of template for displaying" placeholder="Summer Vibes Design" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <MultiSelect label="Categories" description="Select one or more relevant categories" placeholder="Select categories" data={TEMPLATE_CATEGORIES} value={newCategories} onChange={setNewCategories} searchable clearable />
          <TagsInput label="Tags" description="Add related tags for the template" placeholder="Type and press Enter" value={newTags} onChange={setNewTags} />
          <div>
            <Text size="sm" fw={500} mb={4}>Upload design file</Text>
            <Text size="xs" c="dimmed" mb={8}>We support .json and image files (PNG, JPG, SVG) for preview</Text>
            {newFilePreview ? (
              <Stack gap="xs">
                <Paper p="sm" radius="md" withBorder style={{ display: 'flex', justifyContent: 'center' }}>
                  <img src={newFilePreview} alt="Template preview" style={{ maxWidth: '100%', maxHeight: 200, objectFit: 'contain', borderRadius: 6 }} />
                </Paper>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">{newFileName}</Text>
                  <Button variant="subtle" size="xs" color="red" onClick={() => { setNewFilePreview(null); setNewFileName(''); }}>Remove</Button>
                </Group>
              </Stack>
            ) : (
              <Paper p="lg" radius="md" style={{ border: '2px dashed var(--mantine-color-gray-3)', cursor: 'pointer', textAlign: 'center' }} onClick={() => {
                const input = document.createElement('input');
                input.type = 'file'; input.accept = '.json,image/png,image/jpeg,image/svg+xml';
                input.onchange = () => {
                  const file = input.files?.[0]; if (!file) return;
                  setNewFileName(file.name);
                  if (file.type.startsWith('image/')) { const reader = new FileReader(); reader.onload = () => setNewFilePreview(reader.result as string); reader.readAsDataURL(file); }
                }; input.click();
              }}>
                <Stack align="center" gap={4}>
                  <Upload size={24} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">Click to upload or drag file here</Text>
                  <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>JSON, PNG, JPG, SVG</Text>
                </Stack>
              </Paper>
            )}
          </div>
          <NumberInput label="Price ($)" description="Base price for this template" value={newPrice} onChange={(v) => setNewPrice(Number(v) || 0)} prefix="$" decimalScale={2} min={0} />
          <Switch label="Featured" description="Put template into the featured items list" checked={newFeatured} onChange={(e) => setNewFeatured(e.currentTarget.checked)} />
          <Switch label="Active" description="Enable/Disable template on front-end" checked={newActive} onChange={(e) => setNewActive(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Save Template</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Toolbar */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <Menu shadow="md" width={200}>
              <Menu.Target><Button variant="default" size="xs" disabled={selected.size === 0}>Bulk Actions ({selected.size})</Button></Menu.Target>
              <Menu.Dropdown><Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={handleBulkDelete}>Delete Selected</Menu.Item></Menu.Dropdown>
            </Menu>
            <Select size="xs" w={150} value={sortOrder} onChange={(v) => { setSortOrder((v as SortOrder) ?? 'newest'); setPage(1); }} data={[{ value: 'az', label: 'Name A→Z' }, { value: 'za', label: 'Name Z→A' }, { value: 'newest', label: 'Newest First' }, { value: 'oldest', label: 'Oldest First' }]} leftSection={<Filter size={14} />} />
            <Select size="xs" w={140} placeholder="Category" data={TEMPLATE_CATEGORIES} value={filterCategory} onChange={(v) => { setFilterCategory(v); setPage(1); }} clearable />
            <Text size="xs" c="dimmed">{filtered.length} template(s)</Text>
          </Group>
          <TextInput size="xs" placeholder="Search templates..." leftSection={<Search size={14} />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} w={220} />
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">Loading...</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Package size={40} opacity={0.3} />
            <Text c="dimmed" size="sm">{search || filterCategory ? 'No templates match your filter' : 'No templates yet'}</Text>
          </Stack>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}><Checkbox size="xs" checked={selected.size === paginated.length && paginated.length > 0} indeterminate={selected.size > 0 && selected.size < paginated.length} onChange={toggleSelectAll} /></Table.Th>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Categories</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Featured</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={80}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginated.map((t) => (
                  <Table.Tr key={t.id} bg={selected.has(t.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                    <Table.Td><Checkbox size="xs" checked={selected.has(t.id)} onChange={() => toggleSelect(t.id)} /></Table.Td>
                    <Table.Td>
                      <Text size="sm" fw={500}>{t.name}</Text>
                      {t.tags.length > 0 && <Group gap={4} mt={2}>{t.tags.slice(0, 3).map((tag: string) => <Badge key={tag} size="xs" variant="outline" color="gray" styles={{ label: { overflow: 'visible' } }}>{tag}</Badge>)}</Group>}
                    </Table.Td>
                    <Table.Td><Group gap={4}>{t.categories.map((c: string) => <Badge key={c} size="xs" variant="light" styles={{ label: { overflow: 'visible' } }}>{c}</Badge>)}</Group></Table.Td>
                    <Table.Td><Text size="sm">{t.price > 0 ? `$${(t.price / 100).toFixed(2)}` : 'Free'}</Text></Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color={t.featured ? 'yellow' : 'gray'} onClick={() => toggleFeatured(t.id)} title={t.featured ? 'Remove from featured' : 'Add to featured'}>
                        {t.featured ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={t.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} styles={{ label: { overflow: 'visible' } }} onClick={() => toggleActive(t.id)}>
                        {t.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={160} position="bottom-end">
                        <Menu.Target><ActionIcon variant="subtle" color="gray"><MoreHorizontal size={16} /></ActionIcon></Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={t.featured ? <StarOff size={14} /> : <Star size={14} />} onClick={() => toggleFeatured(t.id)}>{t.featured ? 'Unfeature' : 'Feature'}</Menu.Item>
                          <Menu.Item onClick={() => toggleActive(t.id)}>{t.active ? 'Deactivate' : 'Activate'}</Menu.Item>
                          <Menu.Divider />
                          <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => handleDelete(t.id)}>Delete</Menu.Item>
                        </Menu.Dropdown>
                      </Menu>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
            {totalPages > 1 && <Group justify="center" p="md"><Pagination total={totalPages} value={page} onChange={setPage} size="sm" /></Group>}
          </>
        )}
      </Paper>
    </div>
  );
}
