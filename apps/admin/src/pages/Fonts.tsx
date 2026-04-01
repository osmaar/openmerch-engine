import { useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Switch, FileInput,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, Type, Upload } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';

interface Font {
  id: string;
  name: string;
  description: string;
  fileUrl: string;
  isGoogle: boolean;
  active: boolean;
  createdAt: string;
}

const FAKE_FONTS: Font[] = [
  { id: 'f1', name: 'Oswald', description: 'The quick brown fox', fileUrl: '', isGoogle: true, active: true, createdAt: new Date().toISOString() },
  { id: 'f2', name: 'Bebas Neue', description: 'The quick brown fox', fileUrl: '', isGoogle: true, active: true, createdAt: new Date().toISOString() },
  { id: 'f3', name: 'Pacifico', description: 'The quick brown fox', fileUrl: '', isGoogle: true, active: true, createdAt: new Date().toISOString() },
  { id: 'f4', name: 'Anton', description: 'The quick brown fox', fileUrl: '', isGoogle: true, active: true, createdAt: new Date().toISOString() },
  { id: 'f5', name: 'Custom Font', description: 'Uploaded custom', fileUrl: '', isGoogle: false, active: true, createdAt: new Date().toISOString() },
];

export function Fonts() {
  const [fonts, setFonts] = useState<Font[]>(FAKE_FONTS);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('The quick brown fox jumps over the lazy dog');
  const [newActive, setNewActive] = useState(true);

  const filtered = fonts.filter((f) => !search.trim() || f.name.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    if (!newName.trim()) return;
    setFonts([...fonts, { id: `f-${Date.now()}`, name: newName, description: newDesc, fileUrl: '', isGoogle: false, active: newActive, createdAt: new Date().toISOString() }]);
    notifications.show({ title: 'Font added', message: `"${newName}" has been added successfully`, color: 'green' });
    setNewName(''); setNewDesc('The quick brown fox jumps over the lazy dog'); setNewActive(true); setShowCreate(false);
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Fonts</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add New Font</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => setShowCreate(false)} title="Add New Font" centered>
        <Stack>
          <TextInput label="Name" description="Name of the font for displaying" placeholder="My Custom Font" value={newName} onChange={(e) => setNewName(e.target.value)} required />
          <TextInput label="Preview Text" description="For previewing purpose" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
          {newName && (
            <Paper p="md" radius="md" bg="var(--mantine-color-gray-0)">
              <Text size="lg" style={{ fontFamily: newName }}>{newDesc}</Text>
            </Paper>
          )}
          <FileInput label="Upload Font" description="Select your font file (.ttf, .otf, .woff, .woff2)" placeholder="Select font file" accept=".ttf,.otf,.woff,.woff2" leftSection={<Upload size={14} />} />
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
        {filtered.length === 0 ? (
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
                  <Table.Td><Badge variant="light" color={f.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => setFonts(fonts.map((fo) => fo.id === f.id ? { ...fo, active: !fo.active } : fo))}>{f.active ? 'Active' : 'Inactive'}</Badge></Table.Td>
                  <Table.Td><ActionIcon variant="subtle" color="red" onClick={() => confirm('Delete Font', `Are you sure you want to delete "${f.name}"?`, () => { setFonts(fonts.filter((fo) => fo.id !== f.id)); notifications.show({ title: 'Font deleted', message: 'The font has been deleted', color: 'red' }); })}><Trash2 size={14} /></ActionIcon></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
