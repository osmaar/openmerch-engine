import { useEffect, useState } from 'react';
import {
  Title, Button, Group, Paper, Table, TextInput, Text, Badge, Modal, Stack, Select, Switch, ActionIcon,
  Textarea, FileInput, Tabs, Alert,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { Plus, Search, Trash2, Download, Upload, ChevronDown, ChevronUp, AlertTriangle, Copy } from 'lucide-react';
import { useConfirm } from '../hooks/useConfirm.js';
import { listLanguages, createLanguage, updateLanguage, deleteLanguage, getTranslations, updateTranslations } from '../services/api.js';
import type { Language, TranslationEntry } from '../services/api.js';

const AVAILABLE_LANGUAGES = [
  { value: 'es', label: 'Spanish', flag: '\u{1F1EA}\u{1F1F8}' },
  { value: 'fr', label: 'French', flag: '\u{1F1EB}\u{1F1F7}' },
  { value: 'de', label: 'German', flag: '\u{1F1E9}\u{1F1EA}' },
  { value: 'pt', label: 'Portuguese', flag: '\u{1F1E7}\u{1F1F7}' },
  { value: 'it', label: 'Italian', flag: '\u{1F1EE}\u{1F1F9}' },
  { value: 'ja', label: 'Japanese', flag: '\u{1F1EF}\u{1F1F5}' },
  { value: 'ko', label: 'Korean', flag: '\u{1F1F0}\u{1F1F7}' },
  { value: 'zh', label: 'Chinese', flag: '\u{1F1E8}\u{1F1F3}' },
  { value: 'ar', label: 'Arabic', flag: '\u{1F1F8}\u{1F1E6}' },
  { value: 'hi', label: 'Hindi', flag: '\u{1F1EE}\u{1F1F3}' },
  { value: 'ru', label: 'Russian', flag: '\u{1F1F7}\u{1F1FA}' },
  { value: 'nl', label: 'Dutch', flag: '\u{1F1F3}\u{1F1F1}' },
  { value: 'pl', label: 'Polish', flag: '\u{1F1F5}\u{1F1F1}' },
  { value: 'tr', label: 'Turkish', flag: '\u{1F1F9}\u{1F1F7}' },
  { value: 'sv', label: 'Swedish', flag: '\u{1F1F8}\u{1F1EA}' },
  { value: 'da', label: 'Danish', flag: '\u{1F1E9}\u{1F1F0}' },
  { value: 'no', label: 'Norwegian', flag: '\u{1F1F3}\u{1F1F4}' },
  { value: 'fi', label: 'Finnish', flag: '\u{1F1EB}\u{1F1EE}' },
  { value: 'cs', label: 'Czech', flag: '\u{1F1E8}\u{1F1FF}' },
  { value: 'el', label: 'Greek', flag: '\u{1F1EC}\u{1F1F7}' },
  { value: 'he', label: 'Hebrew', flag: '\u{1F1EE}\u{1F1F1}' },
  { value: 'th', label: 'Thai', flag: '\u{1F1F9}\u{1F1ED}' },
  { value: 'vi', label: 'Vietnamese', flag: '\u{1F1FB}\u{1F1F3}' },
  { value: 'id', label: 'Indonesian', flag: '\u{1F1EE}\u{1F1E9}' },
  { value: 'ms', label: 'Malay', flag: '\u{1F1F2}\u{1F1FE}' },
  { value: 'uk', label: 'Ukrainian', flag: '\u{1F1FA}\u{1F1E6}' },
  { value: 'ro', label: 'Romanian', flag: '\u{1F1F7}\u{1F1F4}' },
  { value: 'hu', label: 'Hungarian', flag: '\u{1F1ED}\u{1F1FA}' },
  { value: 'bg', label: 'Bulgarian', flag: '\u{1F1E7}\u{1F1EC}' },
  { value: 'hr', label: 'Croatian', flag: '\u{1F1ED}\u{1F1F7}' },
  { value: 'sk', label: 'Slovak', flag: '\u{1F1F8}\u{1F1F0}' },
  { value: 'ca', label: 'Catalan', flag: '\u{1F3F4}' },
  { value: 'fil', label: 'Filipino', flag: '\u{1F1F5}\u{1F1ED}' },
  { value: 'bn', label: 'Bengali', flag: '\u{1F1E7}\u{1F1E9}' },
  { value: 'sw', label: 'Swahili', flag: '\u{1F1F0}\u{1F1EA}' },
];

// Grouped by section for the JSON download (sections are visual only — flat keys in DB)
const EDITOR_TEXTS_BY_SECTION = {
  'NavBar & Menu': [
    'Print', 'Help', 'Languages', 'Back to Shop', 'My Cart',
    'Add to Cart', 'Adding...', 'Saving...', 'Saved', 'Ctrl+S to save',
    'No additional languages enabled. Activate languages in the admin panel.',
  ],
  'Cart': [
    'Your cart is empty', 'Design a product and click "Add to Cart"',
    'Size', 'Remove from cart',
    'Select at least one size and quantity in the Product tab.',
    'Add at least one element to your design first.',
    'Added to cart!', 'Failed to add to cart. Please try again.',
  ],
  'Print / Download': [
    'Print / Download', 'Format', 'Unit', 'Include base?',
    'Include back?', 'Include front?',
    'Download', 'Exporting...',
  ],
  'Help / Hotkeys': [
    'Hotkeys', 'Delete selected element', 'Copy selected element',
    'Cut selected element', 'Paste element', 'Duplicate selected element',
    'Select last element', 'Clear all elements', 'Undo', 'Redo',
    'Save design', 'Download design (PNG)', 'Print (mockup PNG)',
    'Zoom in', 'Zoom out', 'Reset zoom',
    'Move element 1px', 'Move element 10px', 'Edit text inline',
    'Zoom in/out', 'Pan (when zoomed)',
  ],
  'Top Toolbar / QR': [
    'You can design your product — upload an image or add text to get started',
    'Your QR code text', 'Generate', 'Cancel', 'Create QR Code', 'QR Code',
    'Upload Image', 'Add Text', 'Duplicate', 'Reset', 'Delete',
    'Reset position and scale',
  ],
  'Zoom & View': [
    'Reset view', 'Reset view — center canvas',
    'Hide print zone guides', 'Show print zone guides',
    'Undo (Ctrl+Z)', 'Redo (Ctrl+Shift+Z)',
  ],
  'Text Toolbar': [
    'Edit text', 'Edit Text', 'Text effects', 'Text Effects',
    'Bold', 'Italic', 'Underline', 'Align', 'Case',
    'Arrange layer', 'Object position', 'Transform',
    'Enter your text...', 'Spacing', 'Line H.', 'Update Text',
    'Radius', 'Curve', 'Height', 'Offset',
    'Left', 'Center', 'Right',
    'UPPERCASE', 'lowercase', 'Title Case',
    'Normal', 'Curved', 'Oblique',
  ],
  'Image Toolbar': [
    'Replace image', 'Crop image', 'Remove background', 'Remove Background',
    'Filters', 'Fill color', 'Opacity',
    'Basic removal — AI-powered removal coming soon with backend integration',
    'Mode', 'Light Background', 'Dark Background', 'Deep',
    'Apply', 'Crop Image', 'Center Horizontal', 'Center Vertical',
    'Square', 'Apply Crop',
    'Brightness', 'Contrast', 'Saturation',
  ],
  'Filters': [
    'Original', 'Grayscale', 'Sepia', 'Vivid', 'Punch', 'Pop',
    'Warm', 'Golden', 'Amber', 'Cool', 'Arctic', 'Frost',
    'Hi Contrast', 'Lo Contrast', 'Dramatic', 'Faded', 'Vintage', 'Retro',
    'Muted', 'Soft', 'Pastel', 'Dark', 'Moody', 'Noir', 'Cyberpunk',
    'Emerald', 'Sunset', 'BW Soft', 'BW Hard', 'BW Warm',
    'Invert', 'Solarize', 'X-Ray', 'Kodak', 'Fuji', 'Polaroid',
  ],
  'Shape Toolbar': [
    'Stroke color', 'Stroke', 'Arrange', 'Position',
  ],
  'Transform Popover': [
    'Rotate', 'Skew X', 'Skew Y', 'Flip X', 'Flip Y', 'Reset All Transforms',
  ],
  'Position / Arrange': [
    'Lock Position', 'Unlock Position',
    'Top Left', 'Top Center', 'Top Right',
    'Center Left', 'Center Right',
    'Bottom Left', 'Bottom Center', 'Bottom Right',
    'Bring to Front', 'Bring Forward', 'Send Backward', 'Send to Back',
  ],
  'Fill Color': [
    'Fill Color', 'HEX', 'Intensity', 'Transparent (Clear Tint)',
  ],
  'Sidebar Tabs': [
    'Product', 'Image', 'Photos', 'AI Image', 'Text', 'Cliparts', 'Shapes',
    'Backgrnd', 'Backgrounds', 'Layers',
  ],
  'Product Tab': [
    'Change Product', 'Coming soon — requires product catalog',
    'Product Color', 'Quantity by size',
  ],
  'Product Colors': [
    'White', 'Black', 'Navy', 'Red', 'Royal Blue', 'Forest Green',
    'Gray', 'Yellow', 'Orange', 'Pink', 'Purple', 'Brown',
  ],
  'Image Tab': [
    'Add Image', 'Drag & drop here', 'PNG, JPG, SVG, WebP',
    'Uploaded images', 'Images saved during this session only',
  ],
  'Text Tab': [
    'Text selected — click to change effect/font',
    'Search fonts...', 'Popular for t-shirt design',
  ],
  'Shapes Tab': [
    'Rectangle', 'Rounded', 'Circle', 'Triangle', 'Star', 'Diamond',
    'Pentagon', 'Hexagon', 'Cross', 'Click to add shape to canvas',
  ],
  'Layers Tab': [
    'No layers yet', 'Add an image or text to start',
    'Hide', 'Show', 'Lock', 'Unlock', 'Locked',
    'Drag to reorder · Double-click to rename', 'Double-click to rename',
    'Arrow', 'Line',
  ],
  'Cliparts Tab': [
    'Search icons...', 'Search', 'Basic', 'Material', 'Phosphor',
    'Tabler', 'Gaming', 'Emoji', 'Color', 'Fluent', 'Noto', 'Stream',
    'No icons found', '200,000+ icons · Powered by Iconify',
  ],
  'Photos Tab': [
    'Search photos...', 'Photos by Unsplash',
    'Unsplash API key not configured. Add VITE_UNSPLASH_ACCESS_KEY to your .env file.',
    'trending', 'aesthetic', 'minimal', 'retro', 'graffiti', 'neon',
    'floral', 'geometric', 'animals', 'landscape', 'food', 'music',
  ],
  'Backgrounds Tab': [
    'Gradients', 'Textures', 'Patterns', 'Abstract', 'Grunge',
    'Marble', 'Wood', 'Fabric', 'Space', 'Watercolor',
  ],
  'AI Image Tab': [
    'Image selected — generation will replace it',
    'Pollinations key not configured. Add VITE_POLLINATIONS_KEY to .env',
    'Model', 'Flux (Default)', 'GPT Image', 'Flux Realism', 'Flux Anime', 'Flux 3D',
    'Describe your image', 'A roaring lion with a crown...',
    'Style', 'Auto', 'Photo', 'Art', 'Anime', 'Logo', 'Icon', 'Sticker', 'Tattoo',
    'Generate Image', 'Generating...',
    'Image generation failed. Try a different prompt or model.',
    'Try these prompts',
    'Powered by Pollinations.ai · Generation may take 10-30s',
    'Get your key at enter.pollinations.ai',
  ],
  'Misc': [
    'No zone found', 'Save', 'Free', 'Premium', 'Categories', 'Price',
    'Front', 'Back', 'Quantity', 'No results found', 'Clear All', 'Select All',
    'Choose Product', 'My Designs', 'Save Design', 'Print Zone',
    'Add Clipart', 'Add Shape', 'Font Size', 'Font Family', 'Text Color',
    'Align Left', 'Align Center', 'Align Right',
    'COLLECTION', 'Total', 'units', 'Photos by', 'Remove from gallery', 'Include',
  ],
  'AI Prompt Suggestions': [
    'A roaring lion with crown, bold graphic style',
    'Retro sunset with palm trees, vaporwave aesthetic',
    'Skull with roses, tattoo style, black and white',
    'Abstract geometric wolf head, modern minimal',
    'Vintage motorcycle, distressed texture, americana',
    'Japanese dragon, traditional ink style',
    'Astronaut floating in space with flowers',
    'Graffiti style text art, urban street art',
  ],
};

// Flat list used everywhere else (for state, validation, downloads)
const EDITOR_TEXTS = Object.values(EDITOR_TEXTS_BY_SECTION).flat();

const ADMIN_TEXTS = [
  'Dashboard', 'Products', 'Designs', 'Templates', 'Cliparts', 'Shapes',
  'Fonts', 'Printing', 'Orders', 'Settings', 'Languages', 'Assets',
  'Add New', 'Edit', 'Delete', 'Save', 'Cancel', 'Confirm',
  'Active', 'Inactive', 'Featured', 'Status', 'Actions', 'Name',
  'Description', 'Created', 'Updated', 'Loading...', 'No results',
  'Bulk Actions', 'Delete Selected', 'Search...', 'Filter',
  'General', 'API Keys', 'Store Name', 'Are you sure?',
  'This action cannot be undone', 'Successfully saved', 'Successfully deleted',
];

const MAX_VALUE_LENGTH = 500;

function sanitizeValue(val: string): string {
  return val
    .replace(/<script[^>]*>.*?<\/script>/gi, '')
    .replace(/[<>]/g, '')
    .slice(0, MAX_VALUE_LENGTH);
}

function validateJson(raw: string): { valid: boolean; data?: Record<string, string>; error?: string; warnings: string[] } {
  const warnings: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { valid: false, error: 'Invalid JSON syntax. Check for missing commas, quotes or brackets.', warnings };
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { valid: false, error: 'JSON must be an object with { "Original Text": "Translation" } format.', warnings };
  }
  const obj = parsed as Record<string, unknown>;
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key.startsWith('_')) continue; // Skip instruction fields
    if (typeof value !== 'string') {
      warnings.push(`Skipped "${key}": value must be a string, got ${typeof value}`);
      continue;
    }
    clean[sanitizeValue(key)] = sanitizeValue(value);
  }
  if (Object.keys(clean).length === 0) {
    return { valid: false, error: 'No valid translation entries found.', warnings };
  }
  return { valid: true, data: clean, warnings };
}

function buildDownloadJson(translations: TranslationEntry[], section: string): string {
  const map = new Map(translations.map((t) => [t.originalText, t.translatedText]));
  const lines: string[] = [];
  lines.push('{');
  lines.push(`  "_instructions": "OpenMerch Engine — ${section} Translations",`);
  lines.push('  "_format": "Each key is the original English text, the value is your translation.",');
  lines.push('  "_rules": "Do NOT change the keys (left side). Only translate the values (right side). Do NOT add HTML, scripts, or SQL. Keys starting with _ are ignored on import. Unknown keys will be skipped.",');
  lines.push('  "_example": "\\"Add to Cart\\": \\"Agregar al Carrito\\"",');

  if (section.startsWith('Editor')) {
    // Group by section for readability
    const sectionEntries = Object.entries(EDITOR_TEXTS_BY_SECTION);
    sectionEntries.forEach(([sectionName, keys], idx) => {
      lines.push(`  "_section_${idx}": "═══ ${sectionName} ═══",`);
      keys.forEach((key) => {
        const value = map.get(key) ?? '';
        const escKey = JSON.stringify(key);
        const escVal = JSON.stringify(value);
        lines.push(`  ${escKey}: ${escVal},`);
      });
    });
  } else {
    // Flat for admin
    translations.forEach((t) => {
      lines.push(`  ${JSON.stringify(t.originalText)}: ${JSON.stringify(t.translatedText)},`);
    });
  }

  // Remove trailing comma from last entry
  const last = lines[lines.length - 1];
  if (last && last.endsWith(',')) {
    lines[lines.length - 1] = last.slice(0, -1);
  }
  lines.push('}');
  return lines.join('\n');
}

export function Languages() {
  const [languages, setLanguages] = useState<Language[]>([]);
  const [loading, setLoading] = useState(true);
  const confirm = useConfirm();
  const [showAdd, setShowAdd] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importLang, setImportLang] = useState<string | null>(null);
  const [importSection, setImportSection] = useState<string>('editor');
  const [importJson, setImportJson] = useState('');
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [importWarnings, setImportWarnings] = useState<string[]>([]);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [newLangCode, setNewLangCode] = useState<string | null>(null);
  const [editorTranslations, setEditorTranslations] = useState<TranslationEntry[]>([]);
  const [adminTranslations, setAdminTranslations] = useState<TranslationEntry[]>([]);
  const [activeTab, setActiveTab] = useState<string | null>('editor');
  const [search, setSearch] = useState('');
  const [allowUserChange, setAllowUserChange] = useState(true);

  const load = () => {
    setLoading(true);
    listLanguages().then(setLanguages).catch(() => setLanguages([])).finally(() => setLoading(false));
  };

  useEffect(load, []);

  useEffect(() => {
    if (selectedLang) {
      getTranslations(selectedLang).then((t) => {
        const translationMap = new Map(t.map((entry) => [entry.originalText, entry.translatedText]));

        setEditorTranslations(EDITOR_TEXTS.map((o) => ({
          languageCode: selectedLang, originalText: o, translatedText: translationMap.get(o) ?? '',
        })));

        setAdminTranslations(ADMIN_TEXTS.map((o) => ({
          languageCode: selectedLang, originalText: o, translatedText: translationMap.get(o) ?? '',
        })));
      }).catch(() => {
        setEditorTranslations(EDITOR_TEXTS.map((o) => ({ languageCode: selectedLang, originalText: o, translatedText: '' })));
        setAdminTranslations(ADMIN_TEXTS.map((o) => ({ languageCode: selectedLang, originalText: o, translatedText: '' })));
      });
    }
  }, [selectedLang]);

  const handleAddLanguage = async () => {
    if (!newLangCode) return;
    const lang = AVAILABLE_LANGUAGES.find((l) => l.value === newLangCode);
    if (!lang) return;
    try {
      await createLanguage({ code: newLangCode, name: lang.label, flag: lang.flag });
      notifications.show({ title: 'Language added', message: `${lang.label} has been added`, color: 'green' });
      setNewLangCode(null); setShowAdd(false); load();
    } catch (e) {
      notifications.show({ title: 'Error', message: (e as Error).message, color: 'red' });
    }
  };

  const handleToggleActive = async (l: Language) => {
    await updateLanguage(l.id, { active: !l.active });
    load();
  };

  const handleDeleteLang = (l: Language) => {
    confirm('Delete Language', `Are you sure you want to delete ${l.name}? All translations will be lost.`, () => {
      deleteLanguage(l.id).then(() => {
        notifications.show({ title: 'Language deleted', message: `${l.name} has been removed`, color: 'red' });
        if (selectedLang === l.code) setSelectedLang(null);
        load();
      });
    });
  };

  const handleSaveTranslations = async () => {
    if (!selectedLang) return;
    try {
      const allEntries = [...editorTranslations, ...adminTranslations].map((t) => ({
        originalText: t.originalText,
        translatedText: sanitizeValue(t.translatedText),
      }));
      await updateTranslations(selectedLang, allEntries);
      notifications.show({ title: 'Translations saved', message: 'All translations have been saved', color: 'green' });
      setSelectedLang(null);
    } catch (e) {
      notifications.show({ title: 'Error', message: (e as Error).message, color: 'red' });
    }
  };

  const getJsonString = () => {
    if (!selectedLang) return '';
    const data = activeTab === 'admin' ? adminTranslations : editorTranslations;
    const label = activeTab === 'admin' ? 'Admin Panel' : 'Editor (Frontend)';
    return buildDownloadJson(data, label);
  };

  const handleDownloadJson = () => {
    if (!selectedLang) return;
    const blob = new Blob([getJsonString()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `openmerch_${activeTab}_${selectedLang}.json`; a.click();
    URL.revokeObjectURL(url);
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(getJsonString()).then(() => {
      notifications.show({ title: 'Copied', message: 'JSON copied to clipboard', color: 'green' });
    });
  };

  const processImport = (raw: string) => {
    setImportError(null); setImportWarnings([]);
    const result = validateJson(raw);
    if (!result.valid) {
      setImportError(result.error!);
      setImportWarnings(result.warnings);
      return;
    }
    if (!importLang || !result.data) return;
    const allowedKeys = new Set([...EDITOR_TEXTS, ...ADMIN_TEXTS]);
    const entries: { originalText: string; translatedText: string }[] = [];
    const warnings = [...result.warnings];
    for (const [key, value] of Object.entries(result.data)) {
      if (allowedKeys.has(key)) {
        entries.push({ originalText: key, translatedText: value });
      } else {
        warnings.push(`Skipped unknown key: "${key}"`);
      }
    }
    setImportWarnings(warnings);
    if (entries.length === 0) {
      setImportError('No valid translation keys found. Make sure the keys match the original English texts exactly.');
      return;
    }
    if (warnings.length > 0) {
      setImportError(`Found ${warnings.length} issue(s). Fix them before importing. Only clean JSON files are accepted.`);
      return;
    }
    updateTranslations(importLang, entries).then(() => {
      notifications.show({ title: 'Imported', message: `${entries.length} translations imported successfully`, color: 'green' });
      if (selectedLang === importLang) {
        setSelectedLang(null);
        setTimeout(() => setSelectedLang(importLang), 100);
      }
      setShowImport(false); setImportJson(''); setImportFile(null); setImportLang(null);
      setImportError(null); setImportWarnings([]);
    }).catch((e) => {
      setImportError((e as Error).message);
    });
  };

  const handleImportSubmit = () => {
    if (importFile) {
      const reader = new FileReader();
      reader.onload = () => processImport(reader.result as string);
      reader.readAsText(importFile);
    } else if (importJson.trim()) {
      processImport(importJson);
    }
  };

  const handleImportFileChange = (file: File | null) => {
    setImportFile(file);
    setImportError(null); setImportWarnings([]);
    if (file) {
      if (!file.name.endsWith('.json')) {
        setImportError('Only .json files are accepted.');
        setImportFile(null);
        return;
      }
      if (file.size > 1024 * 1024) {
        setImportError('File too large. Maximum 1MB.');
        setImportFile(null);
        return;
      }
    }
  };

  const currentTranslations = activeTab === 'admin' ? adminTranslations : editorTranslations;
  const setCurrentTranslations = activeTab === 'admin' ? setAdminTranslations : setEditorTranslations;
  const translatedCount = currentTranslations.filter((t) => t.translatedText.trim()).length;
  const filteredTranslations = currentTranslations.filter((t) => !search.trim() || t.originalText.toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Group justify="space-between" mb="lg">
        <Title order={2}>Languages</Title>
        <Group gap="xs">
          <Button variant="light" leftSection={<Upload size={16} />} onClick={() => setShowImport(true)}>Import JSON</Button>
          <Button leftSection={<Plus size={16} />} onClick={() => setShowAdd(true)}>Add New Language</Button>
        </Group>
      </Group>

      {/* Add language modal */}
      <Modal opened={showAdd} onClose={() => { setShowAdd(false); setNewLangCode(null); }} title="Add New Language" centered>
        <Stack>
          <Select label="Select Language" placeholder="Choose a language" data={AVAILABLE_LANGUAGES.filter((l) => !languages.find((ll) => ll.code === l.value)).map((l) => ({ value: l.value, label: `${l.flag} ${l.label}` }))} value={newLangCode} onChange={setNewLangCode} searchable />
          <Text size="xs" c="dimmed">The language will be added as inactive. Activate it when translations are ready.</Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setShowAdd(false); setNewLangCode(null); }}>Cancel</Button>
            <Button onClick={handleAddLanguage} disabled={!newLangCode}>Add Language</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Import JSON modal */}
      <Modal opened={showImport} onClose={() => { setShowImport(false); setImportJson(''); setImportFile(null); setImportLang(null); setImportError(null); setImportWarnings([]); setImportSection('editor'); }} title="Import Translations" centered size="lg">
        <Stack>
          <Select label="Language" placeholder="Select language to import into" data={languages.filter((l) => l.code !== 'en').map((l) => ({ value: l.code, label: `${l.flag} ${l.name}` }))} value={importLang} onChange={setImportLang} />
          <Select label="Section" description="Which part of the app are these translations for?" data={[{ value: 'editor', label: 'OpenMerch Editor (Frontend — what customers see)' }, { value: 'admin', label: 'Admin Panel (Backend — what merchants see)' }]} value={importSection} onChange={(v) => setImportSection(v ?? 'editor')} />

          <Text size="sm" fw={500}>Upload JSON file or paste content</Text>
          <FileInput label="Upload .json file" placeholder="Select a .json file" accept=".json" leftSection={<Upload size={14} />} value={importFile} onChange={handleImportFileChange} />
          <Text size="xs" c="dimmed" ta="center">— or —</Text>
          <Textarea label="Paste JSON content" description='Format: { "Original Text": "Translation" }. Keys starting with _ are ignored.' placeholder='{ "Add to Cart": "Agregar al Carrito" }' value={importJson} onChange={(e) => { setImportJson(e.target.value); setImportError(null); }} minRows={6} disabled={!!importFile} />

          {importError && (
            <Alert color="red" icon={<AlertTriangle size={16} />} title="Validation Error">
              {importError}
            </Alert>
          )}
          {importWarnings.length > 0 && (
            <Alert color="yellow" icon={<AlertTriangle size={16} />} title="Warnings">
              {importWarnings.map((w, i) => <Text key={i} size="xs">{w}</Text>)}
            </Alert>
          )}

          <Text size="xs" c="dimmed">
            Tip: Download translations from the table below, edit the JSON file externally, then re-import here. Unknown keys will be added as new translation entries. HTML and scripts are stripped for security.
          </Text>
          <Group justify="flex-end">
            <Button variant="default" onClick={() => { setShowImport(false); setImportJson(''); setImportFile(null); setImportLang(null); setImportError(null); setImportWarnings([]); }}>Cancel</Button>
            <Button onClick={handleImportSubmit} disabled={!importLang || (!importJson.trim() && !importFile)}>Validate & Import</Button>
          </Group>
        </Stack>
      </Modal>

      {/* Language Settings */}
      <Paper p="md" radius="md" withBorder mb="md">
        <Group justify="space-between">
          <div>
            <Text size="sm" fw={500}>Language Selector in Editor</Text>
            <Text size="xs" c="dimmed">When enabled, customers can switch language from the design editor. When disabled, the editor uses English only.</Text>
          </div>
          <Switch checked={allowUserChange} onChange={(e) => setAllowUserChange(e.currentTarget.checked)} />
        </Group>
      </Paper>

      {/* Languages list */}
      <Paper radius="md" withBorder mb="md" style={{ overflow: 'visible' }}>
        {loading ? (
          <Text c="dimmed" ta="center" p="xl" size="sm">Loading...</Text>
        ) : languages.length === 0 ? (
          <Stack align="center" p="xl" gap="xs">
            <Text c="dimmed" size="sm">No languages added yet. English is used by default.</Text>
          </Stack>
        ) : (
          <Table striped highlightOnHover>
            <Table.Thead><Table.Tr><Table.Th>Language</Table.Th><Table.Th>Status</Table.Th><Table.Th w={200}></Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {languages.map((l) => (
                <Table.Tr key={l.id}>
                  <Table.Td>
                    <Group gap="sm">
                      <Text size="lg">{l.flag}</Text>
                      <div><Text size="sm" fw={500}>{l.name}</Text><Text size="xs" c="dimmed">{l.code}</Text></div>
                    </Group>
                  </Table.Td>
                  <Table.Td>
                    {l.code === 'en' ? (
                      <Badge variant="light" color="green" size="sm">Default</Badge>
                    ) : (
                      <Switch size="xs" checked={l.active} onChange={() => handleToggleActive(l)} label={l.active ? 'Active' : 'Inactive'} />
                    )}
                  </Table.Td>
                  <Table.Td>
                    {l.code !== 'en' && (
                      <Group gap="xs">
                        <Button
                          variant={selectedLang === l.code ? 'filled' : 'light'}
                          size="xs"
                          onClick={() => setSelectedLang(selectedLang === l.code ? null : l.code)}
                          rightSection={selectedLang === l.code ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        >
                          Translations
                        </Button>
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => handleDeleteLang(l)}><Trash2 size={14} /></ActionIcon>
                      </Group>
                    )}
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}
      </Paper>

      {/* Translation panel */}
      {selectedLang && (
        <Paper radius="md" withBorder style={{ overflow: 'visible' }}>
          <Tabs value={activeTab} onChange={setActiveTab}>
            <Group p="md" justify="space-between">
              <div>
                <Text fw={500} size="sm">
                  {languages.find((l) => l.code === selectedLang)?.flag} {languages.find((l) => l.code === selectedLang)?.name} — Translations
                </Text>
                <Text size="xs" c="dimmed">{translatedCount}/{currentTranslations.length} translated</Text>
              </div>
              <Group gap="xs">
                <Button variant="subtle" size="xs" leftSection={<Copy size={14} />} onClick={handleCopyJson}>Copy JSON</Button>
              <Button variant="subtle" size="xs" leftSection={<Download size={14} />} onClick={handleDownloadJson}>Download JSON</Button>
                <TextInput size="xs" placeholder="Search..." leftSection={<Search size={14} />} value={search} onChange={(e) => setSearch(e.target.value)} w={180} />
              </Group>
            </Group>

            <Tabs.List px="md">
              <Tabs.Tab value="editor">OpenMerch Editor</Tabs.Tab>
              <Tabs.Tab value="admin">Admin Panel</Tabs.Tab>
            </Tabs.List>

            <Tabs.Panel value="editor">
              <Text size="xs" c="dimmed" px="md" pt="sm">Texts that your customers see in the product design editor (buttons, labels, messages).</Text>
            </Tabs.Panel>
            <Tabs.Panel value="admin">
              <Text size="xs" c="dimmed" px="md" pt="sm">Texts that merchants see in this admin dashboard (navigation, actions, labels).</Text>
            </Tabs.Panel>
          </Tabs>

          <Table striped>
            <Table.Thead><Table.Tr><Table.Th>Original (English)</Table.Th><Table.Th>Translation</Table.Th></Table.Tr></Table.Thead>
            <Table.Tbody>
              {filteredTranslations.map((t) => {
                const idx = currentTranslations.indexOf(t);
                return (
                  <Table.Tr key={t.originalText}>
                    <Table.Td><Text size="sm">{t.originalText}</Text></Table.Td>
                    <Table.Td>
                      <TextInput size="xs" placeholder="Enter translation..." value={t.translatedText} onChange={(e) => {
                        const nt = [...currentTranslations];
                        nt[idx] = { ...t, translatedText: e.target.value };
                        setCurrentTranslations(nt);
                      }} />
                    </Table.Td>
                  </Table.Tr>
                );
              })}
            </Table.Tbody>
          </Table>
          <Group p="md" justify="flex-end">
            <Button variant="default" onClick={() => setSelectedLang(null)}>Cancel</Button>
            <Button onClick={handleSaveTranslations}>Save All Translations</Button>
          </Group>
        </Paper>
      )}
    </div>
  );
}
