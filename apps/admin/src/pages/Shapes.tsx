import { useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  NumberInput, Switch, Textarea,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, Hexagon } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';

interface Shape {
  id: string;
  name: string;
  svgContent: string;
  order: number;
  active: boolean;
  createdAt: string;
}

const FAKE_SHAPES: Shape[] = [
  { id: 's1', name: 'Circle', svgContent: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2"/></svg>', order: 1, active: true, createdAt: new Date().toISOString() },
  { id: 's2', name: 'Star', svgContent: '<svg viewBox="0 0 24 24"><polygon points="12,2 15,9 22,9 17,14 19,22 12,17 5,22 7,14 2,9 9,9" fill="none" stroke="currentColor" stroke-width="2"/></svg>', order: 2, active: true, createdAt: new Date().toISOString() },
  { id: 's3', name: 'Heart', svgContent: '<svg viewBox="0 0 24 24"><path d="M12 21s-8-5-8-11a4 4 0 0 1 8 0 4 4 0 0 1 8 0c0 6-8 11-8 11z" fill="none" stroke="currentColor" stroke-width="2"/></svg>', order: 3, active: true, createdAt: new Date().toISOString() },
];

export function Shapes() {
  const [shapes, setShapes] = useState<Shape[]>(FAKE_SHAPES);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newSvg, setNewSvg] = useState('');
  const [newOrder, setNewOrder] = useState(0);
  const [newActive, setNewActive] = useState(true);

  const filtered = shapes.filter((s) => !search.trim() || s.name.toLowerCase().includes(search.toLowerCase())).sort((a, b) => a.order - b.order);

  const handleCreate = () => {
    if (!newName.trim()) return;
    setShapes([...shapes, { id: `s-${Date.now()}`, name: newName, svgContent: newSvg, order: newOrder, active: newActive, createdAt: new Date().toISOString() }]);
    notifications.show({ title: 'Shape created', message: `"${newName}" has been created successfully`, color: 'green' });
    setNewName(''); setNewSvg(''); setNewOrder(0); setNewActive(true); setShowCreate(false);
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Shapes</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add New Shape</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => setShowCreate(false)} title="Add New Shape" centered size="md">
        <Stack>
          <TextInput label="Name" placeholder="Circle" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <Textarea label="SVG Content" description="Paste your SVG content here for preview" placeholder="<svg>...</svg>" value={newSvg} onChange={(e) => setNewSvg(e.target.value)} minRows={4} />
          {newSvg && (
            <Paper p="md" radius="md" bg="var(--mantine-color-gray-0)" style={{ display: 'flex', justifyContent: 'center' }}>
              <div style={{ width: 80, height: 80 }} dangerouslySetInnerHTML={{ __html: newSvg }} />
            </Paper>
          )}
          <NumberInput label="Order" description="Ordering of shape in the list" value={newOrder} onChange={(v) => setNewOrder(Number(v) || 0)} min={0} />
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
        {filtered.length === 0 ? (
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
                    <div style={{ width: 32, height: 32 }} dangerouslySetInnerHTML={{ __html: s.svgContent }} />
                  </Table.Td>
                  <Table.Td><Text size="sm" fw={500}>{s.name}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{s.order}</Text></Table.Td>
                  <Table.Td>
                    <Badge variant="light" color={s.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => setShapes(shapes.map((sh) => sh.id === s.id ? { ...sh, active: !sh.active } : sh))}>
                      {s.active ? 'Active' : 'Inactive'}
                    </Badge>
                  </Table.Td>
                  <Table.Td>
                    <ActionIcon variant="subtle" color="red" onClick={() => confirm('Delete Shape', `Are you sure you want to delete "${s.name}"?`, () => { setShapes(shapes.filter((sh) => sh.id !== s.id)); notifications.show({ title: 'Shape deleted', message: 'The shape has been deleted', color: 'red' }); })}><Trash2 size={14} /></ActionIcon>
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
