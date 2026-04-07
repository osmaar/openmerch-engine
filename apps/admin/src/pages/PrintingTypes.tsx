import { useEffect, useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, ActionIcon, Text, Badge, Modal, Stack,
  Tabs, Switch, NumberInput, Textarea, FileInput, Select, Checkbox, MultiSelect,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Trash2, Search, Printer, Upload } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';
import { listPrintingTypes, createPrintingType, updatePrintingType, deletePrintingType } from '../services/api.js';
import type { PrintingType } from '../services/api.js';
import { useT } from '../i18n/useTranslation.js';

const CALC_METHODS_KEYS = [
  { value: 'elements', key: 'Text, Clipart, Images, Upload' },
  { value: 'color', key: 'One color' },
  { value: 'area', key: 'Size of area design (A0-A6)' },
  { value: 'fixed', key: 'Fixed price per stage' },
  { value: 'line', key: 'Per line' },
  { value: 'character', key: 'Per character' },
  { value: 'acreage', key: 'Acreage design (square inch)' },
];

export function PrintingTypes() {
  const t = useT();
  const [printings, setPrintings] = useState<PrintingType[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState('');

  // Form
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [calcMethod, setCalcMethod] = useState('elements');
  const [active, setActive] = useState(true);
  const [calcScope, setCalcScope] = useState('all');

  const load = () => {
    setLoading(true);
    listPrintingTypes().then(setPrintings).catch(() => setPrintings([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  const filtered = printings.filter((p) => !search.trim() || p.title.toLowerCase().includes(search.toLowerCase()));

  const handleCreate = async () => {
    if (!title.trim()) return;
    try {
      await createPrintingType({ title, description, calculationMethod: calcMethod, active });
      notifications.show({ title: t('Printing type created'), message: `"${title}" ${t('has been created successfully')}`, color: 'green' });
      setTitle(''); setDescription(''); setCalcMethod('elements'); setActive(true); setShowCreate(false);
      load();
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    }
  };

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>{t('Printing Types')}</Title>
        <Button leftSection={<Plus size={16} />} onClick={() => setShowCreate(true)}>{t('Add New Printing')}</Button>
      </Group>

      <Modal opened={showCreate} onClose={() => { setShowCreate(false); setTitle(''); setDescription(''); setCalcMethod('elements'); setActive(true); }} title={t('Add New Printing Type')} centered size="lg">
        <Tabs defaultValue="general">
          <Tabs.List mb="md">
            <Tabs.Tab value="general">{t('General')}</Tabs.Tab>
            <Tabs.Tab value="price">{t('Price Ruler')}</Tabs.Tab>
            <Tabs.Tab value="resources">{t('Resources')}</Tabs.Tab>
            <Tabs.Tab value="layout">{t('Layout')}</Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="general">
            <Stack>
              <TextInput label={t('Printing Title')} placeholder="Sublimation" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <FileInput label={t('Printing Thumbnail')} placeholder={t('Upload preview image')} accept="image/png,image/jpeg,image/svg+xml" leftSection={<Upload size={14} />} />
              <Textarea label={t('Description')} placeholder={t('Describe this printing method')} value={description} onChange={(e) => setDescription(e.target.value)} minRows={3} />
              <Switch label={t('Active')} description={t('Enable/Disable printing type on the design editor')} checked={active} onChange={(e) => setActive(e.currentTarget.checked)} />
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="price">
            <Stack>
              <Select label={t('Calculation Scope')} description={t('Calculate price based on all stages or stage by stage')} data={[{ value: 'all', label: t('All stages') }, { value: 'stage', label: t('Stage by stage') }]} value={calcScope} onChange={(v) => setCalcScope(v ?? 'all')} />
              <Select label={t('Calculation Method')} description={t('How to calculate the printing price')} data={CALC_METHODS_KEYS.map((m) => ({ value: m.value, label: t(m.key) }))} value={calcMethod} onChange={(v) => setCalcMethod(v ?? 'elements')} />

              {calcMethod === 'elements' && (
                <Paper p="md" radius="md" withBorder>
                  <Text size="sm" fw={500} mb="sm">{t('Price per element type')}</Text>
                  <Stack gap="xs">
                    {[
                      { key: 'Text', label: t('Text') },
                      { key: 'Clipart', label: t('Clipart') },
                      { key: 'Image', label: t('Image') },
                      { key: 'Upload', label: t('Upload') },
                      { key: 'Vector SVG', label: t('Vector SVG') },
                    ].map((item) => (
                      <Group key={item.key} justify="space-between">
                        <Text size="xs">{item.label}</Text>
                        <NumberInput size="xs" w={100} prefix="$" decimalScale={2} min={0} defaultValue={0} />
                      </Group>
                    ))}
                  </Stack>
                </Paper>
              )}

              {calcMethod === 'color' && (
                <NumberInput label={t('Price per color ($)')} description={t('Price of printing = Price per color × number of colors')} prefix="$" decimalScale={2} min={0} />
              )}

              {calcMethod === 'area' && (
                <Paper p="md" radius="md" withBorder>
                  <Text size="sm" fw={500} mb="sm">{t('Price per paper size')}</Text>
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

              {calcMethod === 'fixed' && <NumberInput label={t('Fixed price per stage ($)')} prefix="$" decimalScale={2} min={0} />}
              {calcMethod === 'line' && <NumberInput label={t('Price per line ($)')} prefix="$" decimalScale={2} min={0} />}
              {calcMethod === 'character' && <NumberInput label={t('Price per character ($)')} prefix="$" decimalScale={2} min={0} />}
              {calcMethod === 'acreage' && <NumberInput label={t('Price per square inch ($)')} prefix="$" decimalScale={2} min={0} />}
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="resources">
            <Stack>
              <Text size="sm" fw={500}>{t('Resource Permissions')}</Text>
              <Text size="xs" c="dimmed">{t('Configure what resources are available for this printing method')}</Text>
              {[
                { key: 'Font', label: t('Font') },
                { key: 'Clipart', label: t('Clipart') },
                { key: 'Template', label: t('Template') },
                { key: 'Image Upload', label: t('Image Upload') },
                { key: 'Shape', label: t('Shape') },
                { key: 'Background', label: t('Background') },
              ].map((resource) => (
                <Paper key={resource.key} p="sm" radius="md" withBorder>
                  <Group justify="space-between" mb="xs">
                    <Text size="sm" fw={500}>{resource.label}</Text>
                    <Switch size="xs" defaultChecked />
                  </Group>
                  <Group gap="xs">
                    <Checkbox size="xs" label={t('Show color picker')} defaultChecked />
                    <Checkbox size="xs" label={t('Advanced options')} />
                  </Group>
                </Paper>
              ))}

              <Paper p="md" radius="md" withBorder>
                <Text size="sm" fw={500} mb="sm">{t('Advanced Options (when enabled)')}</Text>
                <Stack gap="xs">
                  <Group grow>
                    <NumberInput label={t('Min font size')} size="xs" min={1} />
                    <NumberInput label={t('Max font size')} size="xs" min={1} />
                  </Group>
                  <Group grow>
                    <NumberInput label={t('Min text lines')} size="xs" min={1} />
                    <NumberInput label={t('Max text lines')} size="xs" min={1} />
                  </Group>
                  <Group grow>
                    <NumberInput label={t('Min letters')} size="xs" min={1} />
                    <NumberInput label={t('Max letters')} size="xs" min={1} />
                  </Group>
                  <Group>
                    <Checkbox size="xs" label={t('Editable')} defaultChecked />
                    <Checkbox size="xs" label={t('Movable')} defaultChecked />
                    <Checkbox size="xs" label={t('Scalable')} defaultChecked />
                    <Checkbox size="xs" label={t('Removable')} defaultChecked />
                    <Checkbox size="xs" label={t('Rotatable')} defaultChecked />
                    <Checkbox size="xs" label={t('Duplicate')} defaultChecked />
                  </Group>
                </Stack>
              </Paper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="layout">
            <Stack>
              <MultiSelect label={t('Select Components')} description={t('Components to display per product')} data={[
                { value: 'Text', label: t('Text') },
                { value: 'Clipart', label: t('Clipart') },
                { value: 'Template', label: t('Template') },
                { value: 'Image', label: t('Image') },
                { value: 'Shape', label: t('Shape') },
                { value: 'Background', label: t('Background') },
                { value: 'QR Code', label: t('QR Code') },
              ]} defaultValue={['Text', 'Clipart', 'Image']} />
              <MultiSelect label={t('Select Actions')} description={t('Actions on the editor menu tab')} data={[
                { value: 'Upload', label: t('Upload') },
                { value: 'Download', label: t('Download') },
                { value: 'Print', label: t('Print') },
                { value: 'Save', label: t('Save') },
                { value: 'Share', label: t('Share') },
                { value: 'Undo', label: t('Undo') },
                { value: 'Redo', label: t('Redo') },
              ]} defaultValue={['Upload', 'Download', 'Print', 'Save']} />
              <MultiSelect label={t('Select Toolbars')} description={t('Toolbars for each component')} data={[
                { value: 'Fill', label: t('Fill') },
                { value: 'Stroke', label: t('Stroke') },
                { value: 'Font', label: t('Font') },
                { value: 'Align', label: t('Align') },
                { value: 'Transform', label: t('Transform') },
                { value: 'Arrange', label: t('Arrange') },
                { value: 'Position', label: t('Position') },
                { value: 'Effects', label: t('Effects') },
              ]} defaultValue={['Fill', 'Font', 'Align', 'Transform']} />
            </Stack>
          </Tabs.Panel>
        </Tabs>

        <Group justify="flex-end" mt="lg">
          <Button variant="default" onClick={() => setShowCreate(false)}>{t('Cancel')}</Button>
          <Button onClick={handleCreate} disabled={!title.trim()}>{t('Save Printing')}</Button>
        </Group>
      </Modal>

      <Paper p="sm" radius="md" withBorder mb="sm">
        <Group justify="space-between">
          <Text size="xs" c="dimmed">{filtered.length} {t('printing type(s)')}</Text>
          <TextInput size="xs" placeholder={t('Search...')} leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={220} />
        </Group>
      </Paper>

      <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">{t('Loading...')}</Text>
        ) : filtered.length === 0 ? (
          <Stack align="center" p="xl" gap="xs"><Printer size={40} opacity={0.3} /><Text c="dimmed" size="sm">{t('No printing types yet')}</Text></Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>{t('Name')}</Table.Th><Table.Th>{t('Description')}</Table.Th><Table.Th>{t('Method')}</Table.Th><Table.Th>{t('Status')}</Table.Th><Table.Th w={60}></Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {filtered.map((p) => {
                const methodEntry = CALC_METHODS_KEYS.find((m) => m.value === p.calculationMethod);
                return (
                  <Table.Tr key={p.id}>
                    <Table.Td><Text size="sm" fw={500}>{p.title}</Text></Table.Td>
                    <Table.Td><Text size="xs" c="dimmed">{p.description}</Text></Table.Td>
                    <Table.Td><Badge size="xs" variant="light">{methodEntry ? t(methodEntry.key) : p.calculationMethod}</Badge></Table.Td>
                    <Table.Td><Badge variant="light" color={p.active ? 'green' : 'gray'} size="sm" style={{ cursor: 'pointer' }} onClick={async () => { await updatePrintingType(p.id, { active: !p.active }); load(); }}>{p.active ? t('Active') : t('Inactive')}</Badge></Table.Td>
                    <Table.Td><ActionIcon variant="subtle" color="red" onClick={() => confirm(t('Delete Printing Type'), `${t('Are you sure you want to delete')} "${p.title}"?`, async () => { await deletePrintingType(p.id); notifications.show({ title: t('Printing type deleted'), message: t('The printing type has been deleted'), color: 'red' }); load(); })}><Trash2 size={14} /></ActionIcon></Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
        )}
      </Paper>
    </div>
  );
}
