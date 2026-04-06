import { useEffect, useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Switch, FileInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, Type, Upload } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';
import { listFonts, createFont, updateFont, deleteFont, uploadAsset } from '../services/api.js';
import type { Font } from '../services/api.js';

export function Fonts() {
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('The quick brown fox jumps over the lazy dog');
  const [newActive, setNewActive] = useState(true);
  const [newFile, setNewFile] = useState<File | null>(null);
  const [previewFontUrl, setPreviewFontUrl] = useState<string | null>(null);

  const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

  const loadFontFace = (f: Font) => {
    if (f.fileUrl && !f.isGoogle) {
      const url = f.fileUrl.startsWith('/') ? `${API_BASE}${f.fileUrl}` : f.fileUrl;
      const face = new FontFace(f.name, `url(${url})`);
      face.load().then((loaded) => { document.fonts.add(loaded); }).catch(() => {});
    }
  };

  const load = () => {
    setLoading(true);
    listFonts().then((data) => {
      setFonts(data);
      data.forEach(loadFontFace);
    }).catch(() => setFonts([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = fonts.filter((f) => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      let fileUrl: string | null = null;
      if (newFile) {
        const asset = await uploadAsset(newFile);
        fileUrl = asset.url;
      }
      await createFont({ name: newName, description: newDesc, fileUrl, isGoogle: !newFile, active: newActive });
      notifications.show({ title: 'Font added', message: `"${newName}" has been added successfully`, color: 'green' });
      setNewName(''); setNewDesc('The quick brown fox jumps over the lazy dog'); setNewActive(true); setNewFile(null);
      setShowCreate(false); load();
    } catch (e) {
      notifications.show({ title: 'Error', message: (e as Error).message, color: 'red' });
    }
  };

  const handleToggleActive = async (f: Font) => {
    await updateFont(f.id, { active: !f.active });
    load();
  };

  const handleDeleteFont = (f: Font) => {
    confirm('Delete Font', `Are you sure you want to delete "${f.name}"?`, async () => {
      await deleteFont(f.id);
      notifications.show({ title: 'Font deleted', message: 'The font has been deleted', color: 'red' });
      load();
    });
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Fonts</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add New Font</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setNewDesc('The quick brown fox jumps over the lazy dog'); setNewActive(true); setNewFile(null); if (previewFontUrl) URL.revokeObjectURL(previewFontUrl); setPreviewFontUrl(null); }} title="Add New Font" centered>
        <Stack>
          <TextInput label="Name" description="Name of the font for displaying" placeholder="My Custom Font" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <TextInput label="Preview Text" description="For previewing purpose" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          {(newName || previewFontUrl) && (
            <Paper p="md" radius="md" withBorder>
              <Text size="lg" style={{ fontFamily: previewFontUrl ? '__preview_font__' : newName }}>{newDesc}</Text>
            </Paper>
          )}
          <FileInput label="Upload Font" description="Select your font file (.ttf, .otf, .woff, .woff2)" placeholder="Select font file" accept=".ttf,.otf,.woff,.woff2" leftSection={<Upload size={14} />} value={newFile} onChange={(file) => {
            setNewFile(file);
            if (previewFontUrl) URL.revokeObjectURL(previewFontUrl);
            if (file) {
              const url = URL.createObjectURL(file);
              setPreviewFontUrl(url);
              const face = new FontFace('__preview_font__', `url(${url})`);
              face.load().then((loaded) => { document.fonts.add(loaded); });
            } else {
              setPreviewFontUrl(null);
            }
          }} />
          <Switch label="Active" description="Enable/Disable font on front-end" checked={newActive} onChange={(e) => setNewActive(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Save Font</Button>
          </Group>
        </Stack>
      </Modal>

      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">{filtered.length} font(s)</Text>
          <TextInput size="xs" placeholder="Search fonts..." leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={220} />
        </Group>
      </Paper>

      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">Loading...</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><Type size={40} opacity={0.3} /><Text c="dimmed" size="sm">No fonts yet</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Preview</Table.Th><Table.Th>Name</Table.Th><Table.Th>Source</Table.Th><Table.Th>Status</Table.Th><Table.Th w={60}></Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {filtered.map((f) => (
                <Table.Tr key={f.id}>
                  <Table.Td><Text size="sm" style={{ fontFamily: f.name }}>{f.description}</Text></Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{f.name}</Text></Table.Td>
                  <Table.Td><Badge size="xs" variant="light" color={f.isGoogle ? 'blue' : 'orange'}>{f.isGoogle ? 'Google' : 'Custom'}</Badge></Table.Td>
                  <Table.Td><Badge variant="light" color={f.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => handleToggleActive(f)}>{f.active ? 'Active' : 'Inactive'}</Badge></Table.Td>
                  <Table.Td><ActionIcon variant="subtle" color="red" onClick={() => handleDeleteFont(f)}><Trash2 size={14} /></ActionIcon></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
