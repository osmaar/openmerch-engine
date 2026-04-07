import { useEffect, useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Checkbox, Select, Menu, Pagination, MultiSelect, NumberInput, Switch, TagsInput, SimpleGrid,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, MoreHorizontal, Filter, Star, StarOff, Palette, Upload, X, Image } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';
import { listCliparts, createClipart, updateClipart, deleteClipart, bulkCreateCliparts, uploadAsset } from '../services/api.js';
import type { Clipart } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';

const CLIPART_CATEGORIES = [
  'Animals', 'Sports', 'Music', 'Food', 'Nature', 'Abstract',
  'Skulls', 'Flames', 'Stars', 'Hearts', 'Arrows', 'Badges',
  'Vintage', 'Tribal', 'Floral', 'Geometric',
];

type SortOrder = 'az' | 'za' | 'newest' | 'oldest';

export function Cliparts() {
  const t = useT();
  const [cliparts, setCliparts] = useState<Clipart[]>([]);
  const [loading, setLoading] = useState(true);
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
  const [newFile, setNewFile] = useState<File | null>(null);

  // Bulk upload
  const [bulkCategories, setBulkCategories] = useState<string[]>([]);
  const [bulkTags, setBulkTags] = useState<string[]>([]);
  const [bulkPrice, setBulkPrice] = useState<number>(0);
  const [bulkFiles, setBulkFiles] = useState<{ name: string; preview: string; file: File }[]>([]);

  const load = () => {
    setLoading(true);
    listCliparts().then(setCliparts).catch(() => setCliparts([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = cliparts
    .filter((c) => {
      if (search.trim() && !c.name.toLowerCase().includes(search.toLowerCase()) && !c.tags.some((t: string) => t.toLowerCase().includes(search.toLowerCase()))) return false;
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

  const handleCreate = async () => {
    if (!newName.trim()) {
      notifications.show({ title: t('Error'), message: t('Name is required'), color: 'red' });
      return;
    }
    if (!newFile) {
      notifications.show({ title: t('Error'), message: t('File is required'), color: 'red' });
      return;
    }
    try {
      const asset = await uploadAsset(newFile, 'clipart');
      const fileUrl = asset.url;
      await createClipart({
        name: newName, categories: newCategories, tags: newTags,
        fileUrl, price: newPrice, featured: newFeatured, active: newActive,
      });
      notifications.show({ title: t('Clipart created'), message: `"${newName}" ${t('has been created successfully')}`, color: 'green' });
      setNewName(''); setNewCategories([]); setNewTags([]); setNewPrice(0);
      setNewFeatured(false); setNewActive(true); setNewPreview(null); setNewFileName(''); setNewFile(null);
      setShowCreate(false); load();
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    }
  };

  const handleBulkUpload = async () => {
    if (bulkFiles.length === 0) {
      notifications.show({ title: t('Error'), message: t('At least one file is required'), color: 'red' });
      return;
    }
    try {
      const items = [];
      for (const f of bulkFiles) {
        const asset = await uploadAsset(f.file, 'clipart');
        items.push({ name: f.name.replace(/\.[^/.]+$/, ''), categories: bulkCategories, tags: bulkTags, fileUrl: asset.url, price: bulkPrice });
      }
      await bulkCreateCliparts(items);
      notifications.show({ title: t('Cliparts uploaded'), message: `${bulkFiles.length} ${t('clipart(s) have been uploaded')}`, color: 'green' });
      setBulkFiles([]); setBulkCategories([]); setBulkTags([]); setBulkPrice(0);
      setShowBulkUpload(false); load();
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    }
  };

  const handleDelete = (id: string) => {
    confirm(t('Delete Clipart'), t('Are you sure you want to delete this clipart? This action cannot be undone.'), async () => {
      await deleteClipart(id);
      notifications.show({ title: t('Clipart deleted'), message: t('The clipart has been deleted'), color: 'red' });
      setSelected((prev) => { const n = new Set(prev); n.delete(id); return n; });
      load();
    });
  };

  const toggleFeatured = async (id: string) => {
    const c = cliparts.find((x) => x.id === id);
    if (!c) return;
    await updateClipart(id, { featured: !c.featured });
    load();
  };

  const toggleActive = async (id: string) => {
    const c = cliparts.find((x) => x.id === id);
    if (!c) return;
    await updateClipart(id, { active: !c.active });
    load();
  };

  const handleBulkDelete = () => {
    if (selected.size === 0) return;
    confirm(t('Delete Cliparts'), `${t('Are you sure you want to delete')} ${selected.size} ${t('clipart(s)?')} ${t('This action cannot be undone.')}`, async () => {
      await Promise.all(Array.from(selected).map((id) => deleteClipart(id).catch(() => {})));
      notifications.show({ title: t('Cliparts deleted'), message: `${selected.size} ${t('clipart(s) have been deleted')}`, color: 'red' });
      setSelected(new Set()); load();
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
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/svg+xml';
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      setNewFileName(file.name); setNewFile(file);
      const reader = new FileReader();
      reader.onload = () => setNewPreview(reader.result as string);
      reader.readAsDataURL(file);
    }; input.click();
  };

  const handleBulkFileSelect = () => {
    const input = document.createElement('input');
    input.type = 'file'; input.accept = 'image/png,image/jpeg,image/svg+xml'; input.multiple = true;
    input.onchange = () => {
      const files = Array.from(input.files ?? []);
      files.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => setBulkFiles((prev) => [...prev, { name: file.name, preview: reader.result as string, file }]);
        reader.readAsDataURL(file);
      });
    }; input.click();
  };

  const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

  const ClipartThumb = ({ url, alt }: { url: string; alt: string }) => {
    const fullUrl = url.startsWith('/') ? `${API_BASE}${url}` : url;
    const isSvg = url.toLowerCase().endsWith('.svg');
    const [svgContent, setSvgContent] = useState<string | null>(null);

    useEffect(() => {
      if (!isSvg) return;
      fetch(fullUrl)
        .then((r) => r.text())
        .then((text) => {
          // Normalize: replace currentColor and ensure viewBox if missing
          let normalized = text.replace(/currentColor/g, '#000000');
          const wm = normalized.match(/width="(\d+)"/);
          const hm = normalized.match(/height="(\d+)"/);
          if (wm && hm && !normalized.includes('viewBox')) {
            normalized = normalized.replace(/<svg/, `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`);
          }
          setSvgContent(normalized);
        })
        .catch(() => setSvgContent(null));
    }, [fullUrl, isSvg]);

    if (isSvg && svgContent) {
      return <div style={{ width: '100%', height: '100%', display: 'flex' }} dangerouslySetInnerHTML={{ __html: svgContent.replace(/<svg([^>]*)>/, '<svg$1 width="36" height="36" style="display:block;margin:auto">') }} />;
    }
    return <img src={fullUrl} alt={alt} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />;
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('Cliparts')}</Title>
        <Group gap="xs">
          <Button variant="light" leftSection={<Plus size={16} />} onClick={() => setShowBulkUpload(true)}>{t('Add Multiple')}</Button>
          <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>{t('Add New Clipart')}</Button>
        </Group>
      </Group>

      {/* Single create modal */}
      <Modal opened={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setNewCategories([]); setNewTags([]); setNewPrice(0); setNewFeatured(false); setNewActive(true); setNewPreview(null); setNewFileName(''); setNewFile(null); }} title={t('Add New Clipart')} centered size="md">
        <Stack>
          <TextInput label={t('Name')} placeholder="Lion Badge" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <MultiSelect label={t('Categories')} data={CLIPART_CATEGORIES.map((c) => ({ value: c, label: t(c) }))} value={newCategories} onChange={setNewCategories} searchable clearable />
          <TagsInput label={t('Tags')} placeholder={t('Type and press Enter')} value={newTags} onChange={setNewTags} />
          <div>
            <Text size="sm" fw={500} mb={4}>{t('Upload clipart file')} <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></Text>
            <Text size="xs" c="dimmed" mb={8}>{t('All media and SVG supported')}</Text>
            {newPreview ? (
              <Stack gap="xs">
                <Paper p="sm" radius="md" withBorder style={{ display: 'flex', justifyContent: 'center' }}>
                  <img src={newPreview} alt={t('Preview')} style={{ maxWidth: '100%', maxHeight: 150, objectFit: 'contain', borderRadius: 6 }} />
                </Paper>
                <Group gap="xs">
                  <Text size="xs" c="dimmed">{newFileName}</Text>
                  <Button variant="subtle" size="xs" color="red" onClick={() => { setNewPreview(null); setNewFileName(''); setNewFile(null); }}>{t('Remove')}</Button>
                </Group>
              </Stack>
            ) : (
              <Paper p="lg" radius="md" style={{ border: '2px dashed var(--mantine-color-gray-3)', cursor: 'pointer', textAlign: 'center' }} onClick={handleFileSelect}>
                <Stack align="center" gap={4}>
                  <Upload size={24} color="var(--mantine-color-gray-5)" />
                  <Text size="xs" c="dimmed">{t('Click to upload')}</Text>
                  <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>PNG, JPG, SVG</Text>
                </Stack>
              </Paper>
            )}
          </div>
          <NumberInput label={t('Price ($)')} value={newPrice} onChange={(v) => setNewPrice(Number(v) || 0)} prefix="$" decimalScale={2} min={0} />
          <Switch label={t('Featured')} checked={newFeatured} onChange={(e) => setNewFeatured(e.currentTarget.checked)} />
          <Switch label={t('Active')} checked={newActive} onChange={(e) => setNewActive(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>{t('Cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>{t('Save Clipart')}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Bulk upload modal */}
      <Modal opened={showBulkUpload} onClose={() => { setShowBulkUpload(false); setBulkFiles([]); setBulkCategories([]); setBulkTags([]); setBulkPrice(0); }} title={t('Add Multiple Cliparts')} centered size="lg">
        <Stack>
          <MultiSelect label={t('Categories')} description={t('Apply to all uploaded cliparts')} data={CLIPART_CATEGORIES.map((c) => ({ value: c, label: t(c) }))} value={bulkCategories} onChange={setBulkCategories} searchable />
          <TagsInput label={t('Tags')} description={t('Apply to all uploaded cliparts')} value={bulkTags} onChange={setBulkTags} />
          <NumberInput label={t('Price ($)')} description={t('Apply to all uploaded cliparts')} value={bulkPrice} onChange={(v) => setBulkPrice(Number(v) || 0)} prefix="$" decimalScale={2} min={0} />
          <div>
            <Text size="sm" fw={500} mb={8}>{t('Upload Cliparts')} <span style={{ color: 'var(--mantine-color-red-6)' }}>*</span></Text>
            <Paper p="lg" radius="md" style={{ border: '2px dashed var(--mantine-color-gray-3)', cursor: 'pointer', textAlign: 'center' }} onClick={handleBulkFileSelect}>
              <Stack align="center" gap={4}>
                <Upload size={28} color="var(--mantine-color-gray-5)" />
                <Text size="sm" c="dimmed">{t('Click to select files or drag them here')}</Text>
                <Text size="xs" c="dimmed">{t('PNG, JPG, SVG — select multiple files')}</Text>
              </Stack>
            </Paper>
          </div>
          {bulkFiles.length > 0 && (
            <>
              <Text size="xs" c="dimmed">{bulkFiles.length} {t('file(s) selected')}</Text>
              <SimpleGrid cols={4} spacing="xs">
                {bulkFiles.map((f, i) => (
                  <Paper key={i} p="xs" radius="md" withBorder style={{ position: 'relative' }}>
                    <img src={f.preview} alt={f.name} style={{ width: '100%', aspectRatio: '1', objectFit: 'contain', borderRadius: 4 }} />
                    <ActionIcon variant="filled" color="red" size="xs" radius="xl" style={{ position: 'absolute', top: 4, right: 4 }} onClick={() => setBulkFiles(bulkFiles.filter((_, j) => j !== i))}><X size={10} /></ActionIcon>
                    <Text size="xs" c="dimmed" ta="center" mt={4} lineClamp={1}>{f.name}</Text>
                  </Paper>
                ))}
              </SimpleGrid>
            </>
          )}
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowBulkUpload(false)}>{t('Cancel')}</Button>
            <Button onClick={handleBulkUpload} disabled={bulkFiles.length === 0}>{t('Upload')} {bulkFiles.length} {t('Clipart(s)')}</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Toolbar */}
      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Group gap="sm">
            <Menu shadow="md" width={200}>
              <Menu.Target><Button variant="default" size="xs" disabled={selected.size === 0}>{t('Bulk Actions')} ({selected.size})</Button></Menu.Target>
              <Menu.Dropdown><Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={handleBulkDelete}>{t('Delete Selected')}</Menu.Item></Menu.Dropdown>
            </Menu>
            <Select size="xs" w={150} value={sortOrder} onChange={(v) => { setSortOrder((v as SortOrder) ?? 'newest'); setPage(1); }} data={[{ value: 'az', label: t('Name A→Z') }, { value: 'za', label: t('Name Z→A') }, { value: 'newest', label: t('Newest First') }, { value: 'oldest', label: t('Oldest First') }]} leftSection={<Filter size={14} />} />
            <Select size="xs" w={140} placeholder={t('Category')} data={CLIPART_CATEGORIES.map((c) => ({ value: c, label: t(c) }))} value={filterCategory} onChange={(v) => { setFilterCategory(v); setPage(1); }} clearable />
            <Text size="xs" c="dimmed">{filtered.length} {t('clipart(s)')}</Text>
          </Group>
          <TextInput size="xs" placeholder={t('Search cliparts...')} leftSection={<Search size={14} />} value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} w={220} />
        </Group>
      </Paper>

      {/* Table */}
      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">{t('Loading...')}</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Palette size={40} opacity={0.3} />
            <Text c="dimmed" size="sm">{search || filterCategory ? t('No cliparts match') : t('No cliparts yet')}</Text>
          </Stack>
        ) : (
          <>
            <Table striped highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th w={40}><Checkbox size="xs" checked={selected.size === paginated.length && paginated.length > 0} indeterminate={selected.size > 0 && selected.size < paginated.length} onChange={toggleSelectAll} /></Table.Th>
                  <Table.Th>{t('Clipart')}</Table.Th>
                  <Table.Th>{t('Categories')}</Table.Th>
                  <Table.Th>{t('Price')}</Table.Th>
                  <Table.Th>{t('Featured')}</Table.Th>
                  <Table.Th>{t('Status')}</Table.Th>
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
                          {c.fileUrl ? <ClipartThumb url={c.fileUrl} alt={c.name} /> : <Image size={16} color="#ccc" />}
                        </div>
                        <div>
                          <Text size="sm" fw={500}>{c.name}</Text>
                          {c.tags.length > 0 && <Group gap={4} mt={2}>{c.tags.slice(0, 2).map((tag: string) => <Badge key={tag} size="xs" variant="outline" color="gray">{tag}</Badge>)}</Group>}
                        </div>
                      </Group>
                    </Table.Td>
                    <Table.Td><Group gap={4}>{c.categories.map((cat: string) => <Badge key={cat} size="xs" variant="light">{t(cat)}</Badge>)}</Group></Table.Td>
                    <Table.Td><Text size="sm">{c.price > 0 ? `$${(c.price / 100).toFixed(2)}` : t('Free')}</Text></Table.Td>
                    <Table.Td>
                      <ActionIcon variant="subtle" color={c.featured ? 'yellow' : 'gray'} onClick={() => toggleFeatured(c.id)}>
                        {c.featured ? <Star size={16} fill="currentColor" /> : <StarOff size={16} />}
                      </ActionIcon>
                    </Table.Td>
                    <Table.Td>
                      <Badge variant="light" color={c.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => toggleActive(c.id)}>
                        {c.active ? t('Active') : t('Inactive')}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Menu shadow="md" width={160} position="bottom-end">
                        <Menu.Target><ActionIcon variant="subtle" color="gray"><MoreHorizontal size={16} /></ActionIcon></Menu.Target>
                        <Menu.Dropdown>
                          <Menu.Item leftSection={c.featured ? <StarOff size={14} /> : <Star size={14} />} onClick={() => toggleFeatured(c.id)}>{c.featured ? t('Unfeature') : t('Feature')}</Menu.Item>
                          <Menu.Item onClick={() => toggleActive(c.id)}>{c.active ? t('Deactivate') : t('Activate')}</Menu.Item>
                          <Menu.Divider />
                          <Menu.Item color="red" leftSection={<Trash2 size={14} />} onClick={() => handleDelete(c.id)}>{t('Delete')}</Menu.Item>
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
