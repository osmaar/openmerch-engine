import { useEffect, useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  NumberInput, Switch, Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, Hexagon } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';
import { listShapes, createShape, updateShape, deleteShape } from '../services/api.js';
import type { Shape } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';
import { sanitizeSvgMarkup } from '../utils/sanitizeSvg.js';

export function Shapes() {
  const t = useT();
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newSvg, setNewSvg] = useState('');
  const [newOrder, setNewOrder] = useState(0);
  const [newActive, setNewActive] = useState(true);

  const load = () => {
    setLoading(true);
    listShapes().then(setShapes).catch(() => setShapes([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = shapes.filter((s) => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.sortOrder - b.sortOrder);

  const isValidSvg = (svg: string): boolean => {
    const trimmed = svg.trim();
    if (!trimmed) return false;
    if (!trimmed.startsWith('<svg') && !trimmed.startsWith('<?xml')) return false;
    if (!trimmed.includes('</svg>')) return false;
    return true;
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      notifications.show({ title: t('Error'), message: t('Name is required'), color: 'red' });
      return;
    }
    if (!newSvg.trim()) {
      notifications.show({ title: t('Error'), message: t('SVG content is required'), color: 'red' });
      return;
    }
    if (!isValidSvg(newSvg)) {
      notifications.show({ title: t('Error'), message: t('Invalid SVG. Must start with <svg> and end with </svg>'), color: 'red' });
      return;
    }
    try {
      await createShape({ name: newName, svgContent: newSvg, sortOrder: newOrder, active: newActive });
      notifications.show({ title: t('Shape created'), message: `"${newName}" ${t('has been created successfully')}`, color: 'green' });
      setNewName(''); setNewSvg(''); setNewOrder(0); setNewActive(true); setShowCreate(false);
      load();
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    }
  };

  const handleToggleActive = (s: Shape) => {
    updateShape(s.id, { active: !s.active }).then(() => load());
  };

  const handleDeleteShape = (s: Shape) => {
    confirm(t('Delete Shape'), `${t('Are you sure you want to delete')} "${s.name}"?`, () => {
      deleteShape(s.id).then(() => {
        notifications.show({ title: t('Shape deleted'), message: t('The shape has been deleted'), color: 'red' });
        load();
      });
    });
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('Shapes')}</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>{t('Add New Shape')}</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setNewSvg(''); setNewOrder(0); setNewActive(true); }} title={t('Add New Shape')} centered size="md">
        <Stack>
          <TextInput label={t('Name')} placeholder="Circle" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Textarea label={t('SVG Content')} description={t('Paste your SVG content here for preview')} placeholder="<svg>...</svg>" value={newSvg} onChange={(e) => setNewSvg(e.target.value)} minRows={4} required />
          {newSvg && (
            <Paper p="lg" radius="md" withBorder style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: 100, height: 100 }} dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup((() => { let svg = newSvg; const wm = svg.match(/width="(\d+)"/); const hm = svg.match(/height="(\d+)"/); if (wm && hm && !svg.includes('viewBox')) svg = svg.replace(/<svg/, `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`); return svg.replace(/<svg([^>]*)>/, (_, a) => `<svg${a.replace(/width="[^"]*"/g, '').replace(/height="[^"]*"/g, '')} width="100" height="100" style="display:block">`); })()) }} />
            </Paper>
          )}
          <NumberInput label={t('Order')} description={t('Controls the position of this shape in the editor list. Lower numbers appear first.')} value={newOrder} onChange={(v) => setNewOrder(Number(v) || 0)} min={0} />
          <Switch label={t('Active')} checked={newActive} onChange={(e) => setNewActive(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>{t('Cancel')}</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>{t('Save Shape')}</Button>
          </Group>
        </Stack>
      </Modal>

      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">{filtered.length} {t('shape(s)')}</Text>
          <TextInput size="xs" placeholder={t('Search shapes...')} leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={220} />
        </Group>
      </Paper>

      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">{t('Loading...')}</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><Hexagon size={40} opacity={0.3} /><Text c="dimmed" size="sm">{t('No shapes yet')}</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>{t('Preview')}</Table.Th>
                <Table.Th>{t('Name')}</Table.Th>
                <Table.Th w={80}>{t('Order')}</Table.Th>
                <Table.Th>{t('Status')}</Table.Th>
                <Table.Th w={80}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <div style={{ width: 32, height: 32 }} dangerouslySetInnerHTML={{ __html: sanitizeSvgMarkup((() => { let svg = s.svgContent; const wm = svg.match(/width="(\d+)"/); const hm = svg.match(/height="(\d+)"/); if (wm && hm && !svg.includes('viewBox')) svg = svg.replace(/<svg/, `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`); return svg.replace(/<svg([^>]*)>/, (_, a) => `<svg${a.replace(/width="[^"]*"/g, '').replace(/height="[^"]*"/g, '')} width="32" height="32" style="display:block">`); })()) }} />
                  </Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{s.name}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{s.sortOrder}</Text></Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={s.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => handleToggleActive(s)}>
                      {s.active ? t('Active') : t('Inactive')}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" onClick={() => handleDeleteShape(s)}><Trash2 size={14} /></ActionIcon>
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
