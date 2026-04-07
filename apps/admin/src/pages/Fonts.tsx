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
import { useT } from '../i18n/useTranslation.js';

export function Fonts() {
  const t = useT();
  const [fonts, setFonts] = useState<Font[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const DEFAULT_PREVIEW = t('The quick brown fox jumps over the lazy dog');
  const [newDesc, setNewDesc] = useState(DEFAULT_PREVIEW);
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
        const asset = await uploadAsset(newFile, 'font');
        fileUrl = asset.url;
      }
      await createFont({ name: newName, description: newDesc, fileUrl, isGoogle: !newFile, active: newActive });
      notifications.show({ title: t('Font added'), message: `"${newName}" ${t('has been added successfully')}`, color: 'green' });
      setNewName(''); setNewDesc(DEFAULT_PREVIEW); setNewActive(true); setNewFile(null);
      setShowCreate(false); load();
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    }
  };

  const handleToggleActive = async (f: Font) => {
    await updateFont(f.id, { active: !f.active });
    load();
  };

  const handleDeleteFont = (f: Font) => {
    confirm(t('Delete Font'), `${t('Are you sure you want to delete')} "${f.name}"?`, async () => {
      await deleteFont(f.id);
      notifications.show({ title: t('Font deleted'), message: t('The font has been deleted'), color: 'red' });
      load();
    });
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('Fonts')}</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>{t('Add New Font')}</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setNewDesc(DEFAULT_PREVIEW); setNewActive(true); setNewFile(null); if (previewFontUrl) URL.revokeObjectURL(previewFontUrl); setPreviewFontUrl(null); }} title={t('Add New Font')} centered>
        <Stack>
          <TextInput label={t('Name')} description={t('Name of the font for displaying')} placeholder="My Custom Font" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <TextInput label={t('Preview Text')} description={t('For previewing purpose')} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          {(newName || previewFontUrl) && (
            <Paper p="md" radius="md" withBorder>
              <Text size="lg" style={{ fontFamily: previewFontUrl ? '__preview_font__' : newName }}>{newDesc}</Text>
            </Paper>
          )}
          <FileInput label={t('Upload Font')} description={t('Select your font file (.ttf, .otf, .woff, .woff2)')} placeholder={t('Select font file')} accept=".ttf,.otf,.woff,.woff2" leftSection={<Upload size={14} />} value={newFile} onChange={(file) => {
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
          <Switch label={t('Active')} description={t('Enable/Disable font on front-end')} checked={newActive} onChange={(e) => setNewActive(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>{t('Cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>{t('Save Font')}</Button>
          </Group>
        </Stack>
      </Modal>

      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">{filtered.length} {t('font(s)')}</Text>
          <TextInput size="xs" placeholder={t('Search fonts...')} leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={220} />
        </Group>
      </Paper>

      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">{t('Loading...')}</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><Type size={40} opacity={0.3} /><Text c="dimmed" size="sm">{t('No fonts yet')}</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>{t('Preview')}</Table.Th><Table.Th>{t('Name')}</Table.Th><Table.Th>{t('Source')}</Table.Th><Table.Th>{t('Status')}</Table.Th><Table.Th w={60}></Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {filtered.map((f) => (
                <Table.Tr key={f.id}>
                  <Table.Td><Text size="sm" style={{ fontFamily: f.name }}>{f.description}</Text></Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{f.name}</Text></Table.Td>
                  <Table.Td><Badge size="xs" variant="light" color={f.isGoogle ? 'blue' : 'orange'}>{f.isGoogle ? 'Google' : t('Custom')}</Badge></Table.Td>
                  <Table.Td><Badge variant="light" color={f.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => handleToggleActive(f)}>{f.active ? t('Active') : t('Inactive')}</Badge></Table.Td>
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
