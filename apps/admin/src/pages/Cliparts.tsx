import { useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Checkbox, Select, Menu, Pagination, MultiSelect, NumberInput, Switch, TagsInput, SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, MoreHorizontal, Filter, Star, StarOff, Palette, Upload, X, Image } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';

interface Clipart {
  id: string;
  name: string;
  categories: string[];
  tags: string[];
  fileUrl: string;
  price: number;
  featured: boolean;
  active: boolean;
  createdAt: string;
}

const CLIPART_CATEGORIES = [
  'Animals', 'Sports', 'Music', 'Food', 'Nature', 'Abstract',
  'Skulls', 'Flames', 'Stars', 'Hearts', 'Arrows', 'Badges',
  'Vintage', 'Tribal', 'Floral', 'Geometric',
];

// Fake cliparts
const FAKE_CLIPARTS: Clipart[] = Array.from({ length: 12 }, (_, i) => ({
  id: `clip-${i + 1}`,
  name: `Clipart ${i + 1}`,
  categories: [CLIPART_CATEGORIES[i % CLIPART_CATEGORIES.length]!],
  tags: ['svg', 'vector'],
  fileUrl: '',
  price: i % 3 === 0 ? 0 : Math.round(Math.random() * 5 * 100) / 100,
  featured: i < 4,
  active: true,
  createdAt: new Date(Date.now() - i * 86400000).toISOString(),
}));

type SortOrder = 'az' | 'za' | 'newest' | 'oldest';

export function Cliparts() {
  const [cliparts, setCliparts] = useState<Clipart[]>(FAKE_CLIPARTS);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [search, setSearch] = useState('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('newest');
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const perPage = 20;

  // Single create form
  const [newName, setNewName] = useState('');
  const [newCategories, setNewCategories] = useState<string[]>([]);
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newPrice, setNewPrice] = useState<number>(0);
  const [newFeatured, setNewFeatured] = useState(false);
  const [newActive, setNewActive] = useState(true);
  const [newPreview, setNewPreview] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState('');

  // Bulk upload
  const [bulkCategories, setBulkCategories] = useState<string[]>([]);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [bulkFiles, setBulkFiles] = useState<{ name: string; preview: string }[]>([]);

  const filtered = cliparts
    .filter((c) => {
      if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.tags.some((t) => t.toLowerCase().includes(search.toLowerCase()))) return false;
      if (filterCategory && !c.categories.includes(filterCategory)) return false;
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

  const handleCreate = () => {
    if (!newName.trim()) return;
    setCliparts([{
      id: `clip-${Date.now()}`, name: newName, categories: newCategories, tags: newTags,
      fileUrl: newPreview ?? '', price: newPrice, featured: newFeatured, active: newActive,
      createdAt: new Date().toISOString(),
    }, ...cliparts]);
    notifications.show({ title: 'Clipart created', message: `"${newName}" has been created successfully`, color: 'green' });
    setNewName(''); setNewCategories([]); setNewTags([]); setNewPrice(0);
    setNewFeatured(false); setNewActive(true); setNewPreview(null); setNewFileName('');
    setShowCreate(false);
  };

  const handleBulkUpload = () => {
    const newCliparts = bulkFiles.map((f, i) => ({
      id: `clip-bulk-${Date.now()}-${i}`,
      name: f.name.replace(/\.[^/.]+$/, ''),
      categories: bulkCategories,
      tags: bulkTags,
      fileUrl: f.preview,
      price: bulkPrice,
      featured: false,
      active: true,
      createdAt: new Date().toISOString(),
    }));
    setCliparts([...newCliparts, ...cliparts]);
    notifications.show({ title: 'Cliparts uploaded', message: `${bulkFiles.length} clipart(s) have been uploaded`, color: 'green' });
    setBulkFiles([]); setBulkCategories([]); setBulkTags([]); setBulkPrice(0);
    setShowBulkUpload(false);
  };

  const handleDelete = (id: string) => {
    confirm('Delete Clipart', 'Are you sure you want to delete this clipart? This action cannot be undone.', () => {
      setCliparts(cliparts.filter((c) => c.id !== id));
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      notifications.show({ title: 'Clipart deleted', message: 'The clipart has been deleted', color: 'red' });
    });
  };

  const toggleFeatured = (id: string) => {
    setCliparts(cliparts.map((c) => c.id === id ? { ...c, featured: !c.featured } : c));
  };

  const toggleActive = (id: string) => {
    setCliparts(cliparts.map((c) => c.id === id ? { ...c, active: !c.active } : c));
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    confirm('Delete Cliparts', `Are you sure you want to delete ${selected.size} clipart(s)? This action cannot be undone.`, () => {
      setCliparts(cliparts.filter((c) => !selected.has(c.id)));
      notifications.show({ title: 'Cliparts deleted', message: `${selected.size} clipart(s) have been deleted`, color: 'red' });
      setSelected(new Set());
    });
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  };

  const toggleSelectAll = () => {
    if (selected.size === paginated.length) setSelected(new Set());
    else setSelected(new Set(paginated.map((c) => c.id)));
  };

  const handleFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml';
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setNewFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => setNewPreview(reader.result as string);
      reader.readAsDataURL(file);
    };
    input.click();
  };

  const handleBulkFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/png,image/jpeg,image/svg+xml';
    input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          setBulkFiles((prev) => [...prev, { name: file.name, preview: reader.result as string }]);
        };
        reader.readAsDataURL(file);
      });
    };
    input.click();
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Cliparts</Title>
        <Group gap="xs">
          <Button variant="light" leftSection={<Plus size={16} />} onClick={() => setShowBulkUpload(true)}>
            Add Multiple
          </Button>
          <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>
            Add New Clipart
          </Button>
        </Group>
      </Group>

      {/* Single create modal */}
      <Modal opened={showCreate} onClose={() => setShowCreate(false)} title="Add New Clipart" centered size="md">
        <Stack>
          <TextInput label="Name" placeholder="Lion Badge" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <MultiSelect label="Categories" data={CLIPART_CATEGORIES} value={newCategories} onChange={setNewCategories} searchable clearable />
          <TagsInput label="Tags" placeholder="Type and press Enter" value={newTags} onChange={setNewTags} />

          {/* Upload with preview */}
          <div>
            <Text size="sm" fw={500} mb={4}>Upload clipart file</Text>
            <Text size="xs" c="dimmed" mb={8}>All media and SVG supported</Text>
            {newPreview ? (
              <Stack gap="xs">
                <Paper p="sm" radius="md" bg="var(--mantine-color-gray-0)" style={{ display: 'flex', justifyContent: 'center' }}>
                  <img src={newPreview} alt="Preview" style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 6 }} />
                </Paper>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">{newFileName}</Text>
                  <Button variant="subtle" size="xs" color="red" onClick={() => { setNewPreview(null); setNewFileName(''); }}>Remove</Button>
                </Group>
              </Stack>
            ) : (
              <Paper p="lg" radius="md" style={{ border: '2px dashed var(--mantine-color-gray-3)', cursor: 'pointer', textAlign: 'center' }} onClick={handleFileSelect}>
                <Stack align="center" gap={4}>
                  <Upload size={24} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">Click to upload</Text>
                  <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>PNG, JPG, SVG</Text>
                </Stack>
              </Paper>
            )}
          </div>

          <NumberInput label="Price ($)" value={newPrice} onChange={(v) => setNewPrice(Number(v) || 0)} prefix="$" decimalScale={2} min={0} />
          <Switch label="Featured" checked={newFeatured} onChange={(e) => setNewFeatured(e.currentTarget.checked)} />
          <Switch label="Active" checked={newActive} onChange={(e) => setNewActive(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Save Clipart</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Bulk upload modal */}
      <Modal opened={showBulkUpload} onClose={() => setShowBulkUpload(false)} title="Add Multiple Cliparts" centered size="lg">
        <Stack>
          <MultiSelect label="Categories" description="Apply to all uploaded cliparts" data={CLIPART_CATEGORIES} value={bulkCategories} onChange={setBulkCategories} searchable />
          <TagsInput label="Tags" description="Apply to all uploaded cliparts" value={bulkTags} onChange={setBulkTags} />
          <NumberInput label="Price ($)" description="Apply to all uploaded cliparts" value={bulkPrice} onChange={(v) => setBulkPrice(Number(v) || 0)} prefix="$" decimalScale={2} min={0} />

          {/* Upload zone */}
          <div>
            <Text size="sm" fw={500} mb={8}>Upload Cliparts</Text>
            <Paper p="lg" radius="md" style={{ border: '2px dashed var(--mantine-color-gray-3)', cursor: 'pointer', textAlign: 'center' }} onClick={handleBulkFileSelect}>
              <Stack align="center" gap={4}>
                <Upload size={28} color="var(--mantine-color-gray-5)" />
                <Text size="sm" c="dimmed">Click to select files or drag them here</Text>
                <Text size="xs" c="dimmed">PNG, JPG, SVG — select multiple files</Text>
              </Stack>
            </Paper>
          </div>

          {/* Preview grid */}
          {bulkFiles.length > 0 && (
            <>
              <Text size="xs" c="dimmed">{bulkFiles.length} file(s) selected</Text>
              <SimpleGrid cols={4} spacing="xs">
                {bulkFiles.map((f, i) => (
                  <Paper key={i} p="xs" radius="md" bg="var(--mantine-color-gray-0)" style={{ position: 'relative' }}>
                    <img src={f.preview} alt={f.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', borderRadius: 4 }} />
                    <ActionIcon
                      variant="filled"
                      color="red"
                      size="xs"
                      radius="xl"
                      style={{ position: 'absolute', top: 4, right: 4 }}
                      onClick={() => setBulkFiles(bulkFiles.filter((_, j) => j !== i))}
                    >
                      <X size={10} />
                    </ActionIcon>
                    <Text size="xs" c="dimmed" ta="center" mt={4} lineClamp={1}>{f.name}</Text>
                  </Paper>
                ))}
              </SimpleGrid>
            </>
          )}

          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowBulkUpload(false)}>Cancel</Button>
            <Button onClick={handleBulkUpload} disabled={bulkFiles.length === 0}>
              Upload {bulkFiles.length} Clipart(s)
            </Button>
          </Group>
        </Stack>
      </Modal>

      {/* Toolbar */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <Menu shadow="md" width={200}>
              <Menu.Target>
                <Button variant="default" size="xs" disabled={selected.size === 0}>Bulk Actions ({selected.size})</Button>
              </Menu.Target>
              <Menu.Dropdown>
                <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={handleBulkDelete}>Delete Selected</Menu.Item>
              </Menu.Dropdown>
            </Menu>
            <Select size="xs" w={150} value={sortOrder} onChange={(v) => { setSortOrder((v as SortOrder) ?? 'newest'); setPage(1); }}
              data={[{ value: 'az', label: 'Name A→Z' }, { value: 'za', label: 'Name Z→A' }, { value: 'newest', label: 'Newest First' }, { value: 'oldest', label: 'Oldest First' }]}
              leftSection={<Filter size={14} />}
            />
            <Select size="xs" w={140} placeholder="Category" data={CLIPART_CATEGORIES} value={filterCategory} onChange={(v) => { setFilterCategory(v); setPage(1); }} clearable />
            <Text size="xs" c="dimmed">{filtered.length} clipart(s)</Text>
          </Group>
          <TextInput size="xs" placeholder="Search cliparts..." leftSection={<Search size={14} />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} w={220} />
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Palette size={40} opacity={0.3} />
            <Text c="dimmed" size="sm">{search || filterCategory ? 'No cliparts match' : 'No cliparts yet'}</Text>
          </Stack>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}><Checkbox size="xs" checked={selected.size === paginated.length && paginated.length > 0} indeterminate={selected.size > 0 && selected.size < paginated.length} onChange={toggleSelectAll} /></Table.Th>
                  <Table.Th>Clipart</Table.Th>
                  <Table.Th>Categories</Table.Th>
                  <Table.Th>Price</Table.Th>
                  <Table.Th>Featured</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th w={80}></Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {paginated.map((c) => (
                  <Table.Tr key={c.id} bg={selected.has(c.id) ? 'var(--mantine-color-blue-light)' : undefined}>
                    <Table.Td><Checkbox size="xs" checked={selected.has(c.id)} onChange={() => toggleSelect(c.id)} /></Table.Td>
                    <Table.Td>
                      <Group gap="sm">
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: '#f0f0f0', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                          {c.fileUrl ? (
                            <img src={c.fileUrl} alt={c.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                          ) : (
                            <Image size={16} color="#ccc" />
                          )}
                        </div>
                        <div>
                          <Text size="sm" fw={500}>{c.name}</Text>
                          {c.tags.length > 0 && <Group gap={4} mt={2}>{c.tags.slice(0, 2).map((t) => <Badge key={t} size="xs" variant="outline" color="gray">{t}</Badge>)}</Group>}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td><Group gap={4}>{c.categories.map((cat) => <Badge key={cat} size="xs" variant="light">{cat}</Badge>)}</Group></Table.Td>
                    <Table.Td><Text size="sm">{c.price > 0 ? `$${c.price.toFixed(2)}` : 'Free'}</Text></Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color={c.featured ? 'yellow' : 'gray'} onClick={() => toggleFeatured(c.id)}>
                        {c.featured ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={c.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => toggleActive(c.id)}>
                        {c.active ? 'Active' : 'Inactive'}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={160} position="bottom-end">
                        <Menu.Target><ActionIcon variant="subtle" color="gray"><MoreHorizontal size={16} /></ActionIcon></Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={c.featured ? <StarOff size={14} /> : <Star size={14} />} onClick={() => toggleFeatured(c.id)}>{c.featured ? 'Unfeature' : 'Feature'}</Menu.Item>
                          <Menu.Item onClick={() => toggleActive(c.id)}>{c.active ? 'Deactivate' : 'Activate'}</Menu.Item>
                          <Menu.Divider />
                          <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => handleDelete(c.id)}>Delete</Menu.Item>
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
