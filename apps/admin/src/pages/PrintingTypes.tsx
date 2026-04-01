import { useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Tabs, Switch, NumberInput, Textarea, FileInput, Select, Checkbox, MultiSelect,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, Printer, Upload } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';

interface PrintingType {
  id: string;
  title: string;
  description: string;
  thumbnailUrl: string;
  active: boolean;
  calculationMethod: string;
  createdAt: string;
}

const CALC_METHODS = [
  { value: 'elements', label: 'Text, Clipart, Images, Upload' },
  { value: 'color', label: 'One color' },
  { value: 'area', label: 'Size of area design (A0-A6)' },
  { value: 'fixed', label: 'Fixed price per stage' },
  { value: 'line', label: 'Per line' },
  { value: 'character', label: 'Per character' },
  { value: 'acreage', label: 'Acreage design (square inch)' },
];

const FAKE_PRINTINGS: PrintingType[] = [
  { id: 'p1', title: 'Sublimation', description: 'Full color printing', thumbnailUrl: '', active: true, calculationMethod: 'area', createdAt: new Date().toISOString() },
  { id: 'p2', title: 'Screen Printing', description: 'Max 8 colors', thumbnailUrl: '', active: true, calculationMethod: 'color', createdAt: new Date().toISOString() },
  { id: 'p3', title: 'Embroidery', description: 'Thread-based, experimental', thumbnailUrl: '', active: false, calculationMethod: 'elements', createdAt: new Date().toISOString() },
];

export function PrintingTypes() {
  const [printings, setPrintings] = useState<PrintingType[]>(FAKE_PRINTINGS);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [calcMethod, setCalcMethod] = useState('elements');
  const [active, setActive] = useState(true);
  const [calcScope, setCalcScope] = useState('all'); // all | stage

  const filtered = printings.filter((p) => !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = () => {
    if (!title.trim()) return;
    setPrintings([...printings, { id: `p-${Date.now()}`, title, description, thumbnailUrl: '', active, calculationMethod: calcMethod, createdAt: new Date().toISOString() }]);
    notifications.show({ title: 'Printing type created', message: `"${title}" has been created successfully`, color: 'green' });
    setTitle(''); setDescription(''); setCalcMethod('elements'); setActive(true); setShowCreate(false);
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Printing Types</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>Add New Printing</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => setShowCreate(false)} title="Add New Printing Type" centered size="lg">
        <Tabs defaultValue="general">
          <Tabs.List mb="md">
            <Tabs.Tab value="general">General</Tabs.Tab>
            <Tabs.Tab value="price">Price Ruler</Tabs.Tab>
            <Tabs.Tab value="resources">Resources</Tabs.Tab>
            <Tabs.Tab value="layout">Layout</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general">
            <Stack>
              <TextInput label="Printing Title" placeholder="Sublimation" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <FileInput label="Printing Thumbnail" placeholder="Upload preview image" accept="image/png,image/jpeg,image/svg+xml" leftSection={<Upload size={14} />} />
              <Textarea label="Description" placeholder="Describe this printing method" value={description} onChange={(e) => setDescription(e.target.value)} minRows={3} />
              <Switch label="Active" description="Enable/Disable printing type on the design editor" checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="price">
            <Stack>
              <Select label="Calculation Scope" description="Calculate price based on all stages or stage by stage" data={[{ value: 'all', label: 'All stages' }, { value: 'stage', label: 'Stage by stage' }]} value={calcScope} onChange={(v) => setCalcScope(v ?? 'all')} />
              <Select label="Calculation Method" description="How to calculate the printing price" data={CALC_METHODS} value={calcMethod} onChange={(v) => setCalcMethod(v ?? 'elements')} />

              {calcMethod === 'elements' && (
                <Paper p="md" radius="md" withBorder>
                  <Text size="sm" fw={500} mb="sm">Price per element type</Text>
                  <Stack gap="xs">
                    {['Text', 'Clipart', 'Image', 'Upload', 'Vector SVG'].map((type) => (
                      <Group key={type} justify="space-between">
                        <Text size="xs">{type}</Text>
                        <NumberInput size="xs" w={100} prefix="$" decimalScale={2} min={0} defaultValue={0} />
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}

              {calcMethod === 'color' && (
                <NumberInput label="Price per color ($)" description="Price of printing = Price per color × number of colors" prefix="$" decimalScale={2} min={0} />
              )}

              {calcMethod === 'area' && (
                <Paper p="md" radius="md" withBorder>
                  <Text size="sm" fw={500} mb="sm">Price per paper size</Text>
                  <Stack gap="xs">
                    {['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6'].map((size) => (
                      <Group key={size} justify="space-between">
                        <Text size="xs">{size}</Text>
                        <NumberInput size="xs" w={100} prefix="$" decimalScale={2} min={0} defaultValue={0} />
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}

              {calcMethod === 'fixed' && <NumberInput label="Fixed price per stage ($)" prefix="$" decimalScale={2} min={0} />}
              {calcMethod === 'line' && <NumberInput label="Price per line ($)" prefix="$" decimalScale={2} min={0} />}
              {calcMethod === 'character' && <NumberInput label="Price per character ($)" prefix="$" decimalScale={2} min={0} />}
              {calcMethod === 'acreage' && <NumberInput label="Price per square inch ($)" prefix="$" decimalScale={2} min={0} />}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="resources">
            <Stack>
              <Text size="sm" fw={500}>Resource Permissions</Text>
              <Text size="xs" c="dimmed">Configure what resources are available for this printing method</Text>
              {['Font', 'Clipart', 'Template', 'Image Upload', 'Shape', 'Background'].map((resource) => (
                <Paper key={resource} p="sm" radius="md" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>{resource}</Text>
                    <Switch size="xs" defaultChecked />
                  </Group>
                  <Group gap="xs">
                    <Checkbox size="xs" label="Show color picker" defaultChecked />
                    <Checkbox size="xs" label="Advanced options" />
                  </Group>
                </Paper>
              ))}

              <Paper p="md" radius="md" withBorder>
                <Text size="sm" fw={500} mb="sm">Advanced Options (when enabled)</Text>
                <Stack gap="xs">
                  <Group grow>
                    <NumberInput label="Min font size" size="xs" min={1} />
                    <NumberInput label="Max font size" size="xs" min={1} />
                  </Group>
                  <Group grow>
                    <NumberInput label="Min text lines" size="xs" min={1} />
                    <NumberInput label="Max text lines" size="xs" min={1} />
                  </Group>
                  <Group grow>
                    <NumberInput label="Min letters" size="xs" min={1} />
                    <NumberInput label="Max letters" size="xs" min={1} />
                  </Group>
                  <Group>
                    <Checkbox size="xs" label="Editable" defaultChecked />
                    <Checkbox size="xs" label="Movable" defaultChecked />
                    <Checkbox size="xs" label="Scalable" defaultChecked />
                    <Checkbox size="xs" label="Removable" defaultChecked />
                    <Checkbox size="xs" label="Rotatable" defaultChecked />
                    <Checkbox size="xs" label="Duplicate" defaultChecked />
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="layout">
            <Stack>
              <MultiSelect label="Select Components" description="Components to display per product" data={['Text', 'Clipart', 'Template', 'Image', 'Shape', 'Background', 'QR Code']} defaultValue={['Text', 'Clipart', 'Image']} />
              <MultiSelect label="Select Actions" description="Actions on the editor menu tab" data={['Upload', 'Download', 'Print', 'Save', 'Share', 'Undo', 'Redo']} defaultValue={['Upload', 'Download', 'Print', 'Save']} />
              <MultiSelect label="Select Toolbars" description="Toolbars for each component" data={['Fill', 'Stroke', 'Font', 'Align', 'Transform', 'Arrange', 'Position', 'Effects']} defaultValue={['Fill', 'Font', 'Align', 'Transform']} />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setShowCreate(false)}>Cancel</Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>Save Printing</Button>
        </Group>
      </Modal>

      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">{filtered.length} printing type(s)</Text>
          <TextInput size="xs" placeholder="Search..." leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={220} />
        </Group>
      </Paper>

      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><Printer size={40} opacity={0.3} /><Text c="dimmed" size="sm">No printing types yet</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Name</Table.Th><Table.Th>Description</Table.Th><Table.Th>Method</Table.Th><Table.Th>Status</Table.Th><Table.Th w={60}></Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {filtered.map((p) => (
                <Table.Tr key={p.id}>
                  <Table.Td><Text size="sm" fw={500}>{p.title}</Text></Table.Td>
                  <Table.Td><Text size="xs" c="dimmed">{p.description}</Text></Table.Td>
                  <Table.Td><Badge size="xs" variant="light">{CALC_METHODS.find((m) => m.value === p.calculationMethod)?.label ?? p.calculationMethod}</Badge></Table.Td>
                  <Table.Td><Badge variant="light" color={p.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={() => setPrintings(printings.map((pr) => pr.id === p.id ? { ...pr, active: !pr.active } : pr))}>{p.active ? 'Active' : 'Inactive'}</Badge></Table.Td>
                  <Table.Td><ActionIcon variant="subtle" color="red" onClick={() => confirm('Delete Printing Type', `Are you sure you want to delete "${p.title}"?`, () => { setPrintings(printings.filter((pr) => pr.id !== p.id)); notifications.show({ title: 'Printing type deleted', message: 'The printing type has been deleted', color: 'red' }); })}><Trash2 size={14} /></ActionIcon></Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
