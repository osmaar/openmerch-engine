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

export function Shapes() {
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

  const handleCreate = async () => {
    if (!newName.trim()) return;
    try {
      await createShape({ name: newName, svgContent: newSvg, sortOrder: newOrder, active: newActive });
      notifications.show({ title: 'Shape created', message: `"${newName}" has been created successfully`, color: 'green' });
      setNewName(''); setNewSvg(''); setNewOrder(0); setNewActive(true); setShowCreate(false);
      load();
    } catch (e) {
      notifications.show({ title: 'Error', message: (e as Error).message, color: 'red' });
    }
  };

  const handleToggleActive = (s: Shape) => {
    updateShape(s.id, { active: !s.active }).then(() => load());
  };

  const handleDeleteShape = (s: Shape) => {
    confirm('Delete Shape', `Are you sure you want to delete "${s.name}"?`, () => {
      deleteShape(s.id).then(() => {
        notifications.show({ title: 'Shape deleted', message: 'The shape has been deleted', color: 'red' });
        load();
      });
    });
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Shapes</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add New Shape</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => { setShowCreate(false); setNewName(''); setNewSvg(''); setNewOrder(0); setNewActive(true); }} title="Add New Shape" centered size="md">
        <Stack>
          <TextInput label="Name" placeholder="Circle" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Textarea label="SVG Content" description="Paste your SVG content here for preview" placeholder="<svg>...</svg>" value={newSvg} onChange={(e) => setNewSvg(e.target.value)} minRows={4} />
          {newSvg && (
            <Paper p="lg" radius="md" withBorder style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              <div style={{ width: 100, height: 100 }} dangerouslySetInnerHTML={{ __html: (() => { let svg = newSvg; const wm = svg.match(/width="(\d+)"/); const hm = svg.match(/height="(\d+)"/); if (wm && hm && !svg.includes('viewBox')) svg = svg.replace(/<svg/, `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`); return svg.replace(/<svg([^>]*)>/, (_, a) => `<svg${a.replace(/width="[^"]*"/g, '').replace(/height="[^"]*"/g, '')} width="100" height="100" style="display:block">`); })() }} />
            </Paper>
          )}
          <NumberInput label="Order" description="Controls the position of this shape in the editor's shape list. Lower numbers appear first." value={newOrder} onChange={(v) => setNewOrder(Number(v) || 0)} min={0} />
          <Switch label="Active" checked={newActive} onChange={(e) => setNewActive(e.currentTarget.checked)} />
          <Group justify="flex-end" mt="sm">
            <Button variant="default" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim()}>Save Shape</Button>
          </Group>
        </Stack>
      </Modal>

      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">{filtered.length} shape(s)</Text>
          <TextInput size="xs" placeholder="Search shapes..." leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={220} />
        </Group>
      </Paper>

      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">Loading...</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><Hexagon size={40} opacity={0.3} /><Text c="dimmed" size="sm">No shapes yet</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={60}>Preview</Table.Th>
                <Table.Th>Name</Table.Th>
                <Table.Th w={80}>Order</Table.Th>
                <Table.Th>Status</Table.Th>
                <Table.Th w={80}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {filtered.map((s) => (
                <Table.Tr key={s.id}>
                  <Table.Td>
                    <div style={{ width: 32, height: 32 }} dangerouslySetInnerHTML={{ __html: (() => { let svg = s.svgContent; const wm = svg.match(/width="(\d+)"/); const hm = svg.match(/height="(\d+)"/); if (wm && hm && !svg.includes('viewBox')) svg = svg.replace(/<svg/, `<svg viewBox="0 0 ${wm[1]} ${hm[1]}"`); return svg.replace(/<svg([^>]*)>/, (_, a) => `<svg${a.replace(/width="[^"]*"/g, '').replace(/height="[^"]*"/g, '')} width="32" height="32" style="display:block">`); })() }} />
                  </Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{s.name}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{s.sortOrder}</Text></Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={s.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => handleToggleActive(s)}>
                      {s.active ? 'Active' : 'Inactive'}
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
