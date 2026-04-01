import { useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, Text, Badge, Modal, Stack, Select, Switch, ActionIcon,
} from '@mantine/core';
import { Plus, Search, Trash2 } from 'lucide-react';

interface Language {
  id: string;
  code: string;
  name: string;
  flag: string;
  translated: number;
  total: number;
  active: boolean;
}

interface TranslationEntry {
  original: string;
  translated: string;
}

const AVAILABLE_LANGUAGES = [
  { value: 'es', label: 'Spanish', flag: '🇪🇸' },
  { value: 'fr', label: 'French', flag: '🇫🇷' },
  { value: 'de', label: 'German', flag: '🇩🇪' },
  { value: 'pt', label: 'Portuguese', flag: '🇧🇷' },
  { value: 'it', label: 'Italian', flag: '🇮🇹' },
  { value: 'ja', label: 'Japanese', flag: '🇯🇵' },
  { value: 'ko', label: 'Korean', flag: '🇰🇷' },
  { value: 'zh', label: 'Chinese', flag: '🇨🇳' },
  { value: 'ar', label: 'Arabic', flag: '🇸🇦' },
  { value: 'hi', label: 'Hindi', flag: '🇮🇳' },
];

const SAMPLE_TRANSLATIONS: TranslationEntry[] = [
  { original: 'Add to Cart', translated: '' },
  { original: 'Upload Image', translated: '' },
  { original: 'Add Text', translated: '' },
  { original: 'Download', translated: '' },
  { original: 'Save Design', translated: '' },
  { original: 'Product Color', translated: '' },
  { original: 'Print Zone', translated: '' },
  { original: 'Quantity', translated: '' },
];

export function Languages() {
  const [languages, setLanguages] = useState<Language[]>([
    { id: 'en', code: 'en', name: 'English', flag: '🇺🇸', translated: 50, total: 50, active: true },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [showTranslate, setShowTranslate] = useState(false);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [newLangCode, setNewLangCode] = useState<string | null>(null);
  const [translations, setTranslations] = useState<TranslationEntry[]>(SAMPLE_TRANSLATIONS);
  const [search, setSearch] = useState('');
  const [allowUserChange, setAllowUserChange] = useState(true);

  const handleAddLanguage = () => {
    if (!newLangCode) return;
    const lang = AVAILABLE_LANGUAGES.find((l) => l.value === newLangCode);
    if (!lang) return;
    setLanguages([...languages, { id: newLangCode, code: newLangCode, name: lang.label, flag: lang.flag, translated: 0, total: 50, active: false }]);
    setNewLangCode(null); setShowAdd(false);
  };

  const filteredTranslations = translations.filter((t) => !search.trim() || t.original.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Languages</Title>
        <Group gap="xs">
          <Button variant="light" leftSection={<Plus size={16} />} onClick={() => setShowTranslate(true)}>Add Translate Text</Button>
          <Button leftSection={<Plus size={16} />} onClick={() => setShowAdd(true)}>Add New Language</Button>
        </Group>
      </Group>

      {/* Add language modal */}
      <Modal opened={showAdd} onClose={() => setShowAdd(false)} title="Add New Language" centered>
        <Stack>
          <Select label="Select Language" placeholder="Choose a language" data={AVAILABLE_LANGUAGES.filter((l) => !languages.find((ll) => ll.code === l.value)).map((l) => ({ value: l.value, label: `${l.flag} ${l.label}` }))} value={newLangCode} onChange={setNewLangCode} searchable />
          <Text size="xs" c="dimmed">The application will scan text and add entries to your selected language. You can then translate them manually or use auto-translate.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setShowAdd(false)}>Cancel</Button>
            <Button onClick={handleAddLanguage} disabled={!newLangCode}>Confirm</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Add translate text modal */}
      <Modal opened={showTranslate} onClose={() => setShowTranslate(false)} title="Add Translate Text" centered>
        <Stack>
          <TextInput label="Original Text" placeholder="Enter the original text" />
          <TextInput label="Translated Text" placeholder="Enter the translated text" />
          <Select label="Language" placeholder="Select language" data={languages.filter((l) => l.code !== 'en').map((l) => ({ value: l.code, label: `${l.flag} ${l.name}` }))} />
          <Group justify="flex-end">
            <Button variant="default" onClick={() => setShowTranslate(false)}>Cancel</Button>
            <Button>Save Translate Text</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Settings */}
      <Paper p="md" radius="md" withBorder mb="md">
        <Group justify="space-between">
          <div>
            <Text size="sm" fw={500}>Language Settings</Text>
            <Text size="xs" c="dimmed">Allow users to switch language from the editor</Text>
          </div>
          <Switch label="Allow User Change" checked={allowUserChange} onChange={(e) => setAllowUserChange(e.currentTarget.checked)} />
        </Group>
      </Paper>

      {/* Languages list */}
      <Paper radius="md" withBorder mb="md" style={{ overflow: 'visible' }}>
        <Table striped highlightOnHover>
          <Table.Thead><Table.Tr><Table.Th>Language</Table.Th><Table.Th>Progress</Table.Th><Table.Th>Status</Table.Th><Table.Th w={80}></Table.Th></Table.Tr></Table.Thead>
          <Table.Tbody>
            {languages.map((l) => (
              <Table.Tr key={l.id}>
                <Table.Td>
                  <Group gap="sm">
                    <Text size="lg">{l.flag}</Text>
                    <div>
                      <Text size="sm" fw={500}>{l.name}</Text>
                      <Text size="xs" c="dimmed">{l.code}</Text>
                    </div>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    <Text size="xs">{l.translated}/{l.total}</Text>
                    <Badge size="xs" variant="light" color={l.translated === l.total ? 'green' : 'orange'}>
                      {Math.round((l.translated / l.total) * 100)}%
                    </Badge>
                  </Group>
                </Table.Td>
                <Table.Td>
                  <Badge variant="light" color={l.active ? 'green' : 'gray'} size="sm" style={{ cursor: l.code === 'en' ? 'default' : 'pointer' }} onClick={() => l.code !== 'en' && setLanguages(languages.map((ll) => ll.id === l.id ? { ...ll, active: !ll.active } : ll))}>
                    {l.active ? 'Active' : 'Inactive'}
                  </Badge>
                </Table.Td>
                <Table.Td>
                  {l.code !== 'en' && (
                    <Group gap={4}>
                      <Button variant="subtle" size="xs" onClick={() => { setSelectedLang(l.code); }}>Translate</Button>
                      <ActionIcon variant="subtle" color="red" size="sm" onClick={() => setLanguages(languages.filter((ll) => ll.id !== l.id))}><Trash2 size={14} /></ActionIcon>
                    </Group>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
      </Paper>

      {/* Translation table */}
      {selectedLang && (
        <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
          <Group p="md" justify="space-between">
            <Text fw={500} size="sm">Translations — {languages.find((l) => l.code === selectedLang)?.flag} {languages.find((l) => l.code === selectedLang)?.name}</Text>
            <Group gap="xs">
              <Button variant="light" size="xs">Auto Translate</Button>
              <TextInput size="xs" placeholder="Search..." leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={180} />
            </Group>
          </Group>
          <Table striped>
            <Table.Thead><Table.Tr><Table.Th>Original</Table.Th><Table.Th>Translation</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {filteredTranslations.map((t, i) => (
                <Table.Tr key={i}>
                  <Table.Td><Text size="sm">{t.original}</Text></Table.Td>
                  <Table.Td>
                    <TextInput size="xs" placeholder="Enter translation..." value={t.translated} onChange={(e) => { const nt = [...translations]; nt[i] = { ...t, translated: e.target.value }; setTranslations(nt); }} variant="unstyled" />
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        </Paper>
      )}
    </div>
  );
}
