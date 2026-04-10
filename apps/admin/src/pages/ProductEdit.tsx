import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Title, Tabs, Paper, TextInput, Textarea, NumberInput, Select, MultiSelect,
  Switch, Button, Group, Stack, Text, FileInput, Badge, ActionIcon, Divider,
  Checkbox, ColorInput, Table, Modal,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { ArrowLeft, Save, Plus, Trash2, Upload } from 'lucide-react';
import { getProduct, createProduct, updateProduct } from '../services/api.js';

const API_BASE = (typeof window !== 'undefined' && window.location.port !== '3001') ? 'http://localhost:3001' : '';
/** Resolve asset URLs — relative paths need the API base */
function resolveUrl(url: string): string {
  if (!url || url.startsWith('data:') || url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}
import { useT } from '../i18n/useTranslation.js';

interface Stage {
  id: string;
  name: string;
  baseImageUrl: string;
  baseImageWidthMM: number;
  baseImageHeightMM: number;
  printAreaWidthMM: number;
  printAreaHeightMM: number;
  printAreaXMM: number;
  printAreaYMM: number;
  exportIncludeBase: boolean;
  cropMarks: boolean;
  useMaskLayer: boolean;
}

interface Attribute {
  id: string;
  name: string;
  type: 'color' | 'dropdown' | 'input' | 'options' | 'quantity';
  values: AttributeValue[];
  required: boolean;
  usedForVariations: boolean;
}

interface AttributeValue {
  label: string;
  value: string;
  extraPrice: number;
  color?: string;
}

const PRINTING_TECHNIQUES = [
  'Sublimation',
  'Screen Printing',
  'Embroidery',
  'DTG (Direct to Garment)',
  'Heat Transfer',
  'Vinyl',
  'DTF (Direct to Film)',
];

const CATEGORIES = [
  'T-Shirts',
  'Hoodies',
  'Caps',
  'Mugs',
  'Phone Cases',
  'Posters',
  'Tote Bags',
];

const PRINTING_SIZES = [
  'A0 (841 x 1189 mm)',
  'A1 (594 x 841 mm)',
  'A2 (420 x 594 mm)',
  'A3 (297 x 420 mm)',
  'A4 (210 x 297 mm)',
  'A5 (148 x 210 mm)',
  'Custom',
];

export function ProductEdit() {
  const t = useT();
  const { id } = useParams();
  const navigate = useNavigate();
  const isNew = !id || id === 'new';

  // Details
  const [name, setName] = useState('');
  const [price, setPrice] = useState<number>(0);
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [printingTechniques, setPrintingTechniques] = useState<string[]>([]);
  const [active, setActive] = useState(true);

  // Design stages (main product zones)
  const [stages, setStages] = useState<Stage[]>([
    {
      id: 'front', name: 'Front', baseImageUrl: '',
      baseImageWidthMM: 500, baseImageHeightMM: 500,
      printAreaWidthMM: 200, printAreaHeightMM: 300,
      printAreaXMM: 150, printAreaYMM: 105,
      exportIncludeBase: false, cropMarks: false, useMaskLayer: false,
    },
  ]);

  // Variants
  interface VariantData { id: string; name: string; zones?: Stage[] }
  const [variants, setVariants] = useState<VariantData[]>([]);
  const [variantLabel, setVariantLabel] = useState('');
  const [selectedVariantIdx, setSelectedVariantIdx] = useState(-1); // -1 = main zones

  // Attributes
  const [attributes, setAttributes] = useState<Attribute[]>([]);

  const [saving, setSaving] = useState(false);
  const [showMaskInfo, setShowMaskInfo] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(!isNew);

  // Load existing product
  useEffect(() => {
    if (!isNew && id) {
      setLoadingProduct(true);
      getProduct(id).then((p) => {
        setName(p.name);
        setPrice(p.price / 100);
        setDescription(p.description ?? '');
        setCategories(p.categories ?? []);
        setPrintingTechniques(p.printingTechniques ?? []);
        setActive(p.active);
        // Load variants
        if (p.variants && (p.variants as VariantData[]).length > 0) {
          setVariants((p.variants as VariantData[]).map((v) => ({
            id: v.id, name: v.name,
            zones: v.zones ? (v.zones as Stage[]).map((z) => ({
              id: z.id, name: z.name, baseImageUrl: z.baseImageUrl ?? '',
              baseImageWidthMM: z.baseImageWidthMM ?? 500, baseImageHeightMM: z.baseImageHeightMM ?? 500,
              printAreaWidthMM: z.printAreaWidthMM ?? 200, printAreaHeightMM: z.printAreaHeightMM ?? 300,
              printAreaXMM: z.printAreaXMM ?? 150, printAreaYMM: z.printAreaYMM ?? 105,
              exportIncludeBase: false, cropMarks: false, useMaskLayer: false,
            })) : undefined,
          })));
        }
        if (p.variantLabel) setVariantLabel(p.variantLabel as string);
        if (p.zones && (p.zones as Stage[]).length > 0) {
          setStages((p.zones as Stage[]).map((z) => ({
            id: z.id, name: z.name,
            baseImageUrl: z.baseImageUrl ?? '',
            baseImageWidthMM: z.baseImageWidthMM ?? 500, baseImageHeightMM: z.baseImageHeightMM ?? 500,
            printAreaWidthMM: z.printAreaWidthMM ?? 200, printAreaHeightMM: z.printAreaHeightMM ?? 300,
            printAreaXMM: z.printAreaXMM ?? 150, printAreaYMM: z.printAreaYMM ?? 105,
            exportIncludeBase: z.exportIncludeBase ?? false, cropMarks: z.cropMarks ?? false, useMaskLayer: z.useMaskLayer ?? false,
          })));
        }
      }).catch(() => {
        notifications.show({ title: t('Error'), message: t('Product not found'), color: 'red' });
        navigate('/products');
      }).finally(() => setLoadingProduct(false));
    }
  }, [id, isNew, navigate]);

  const handleSave = async () => {
    if (!name.trim()) {
      notifications.show({ title: t('Error'), message: t('Product name is required'), color: 'red' });
      return;
    }
    if (price < 0) {
      notifications.show({ title: t('Error'), message: t('Price must be greater than or equal to 0'), color: 'red' });
      return;
    }
    if (stages.length === 0) {
      notifications.show({ title: t('Error'), message: t('At least one stage is required'), color: 'red' });
      return;
    }
    const missingImage = stages.find((s) => !s.baseImageUrl);
    if (missingImage) {
      notifications.show({ title: t('Error'), message: `${t('Stage image is required')}: ${missingImage.name}`, color: 'red' });
      return;
    }
    setSaving(true);
    try {
      const data = {
        name,
        slug: name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
        description,
        price: Math.round(price * 100),
        categories,
        printingTechniques,
        active,
        zones: stages.map((s) => ({
          id: s.id, name: s.name, baseImageUrl: s.baseImageUrl,
          baseImageWidthMM: s.baseImageWidthMM, baseImageHeightMM: s.baseImageHeightMM,
          printAreaWidthMM: s.printAreaWidthMM, printAreaHeightMM: s.printAreaHeightMM,
          printAreaXMM: s.printAreaXMM, printAreaYMM: s.printAreaYMM,
        })),
        variants: variants.map((v) => ({
          id: v.id, name: v.name,
          zones: v.zones?.map((z) => ({
            id: z.id, name: z.name, baseImageUrl: z.baseImageUrl,
            baseImageWidthMM: z.baseImageWidthMM, baseImageHeightMM: z.baseImageHeightMM,
            printAreaWidthMM: z.printAreaWidthMM, printAreaHeightMM: z.printAreaHeightMM,
            printAreaXMM: z.printAreaXMM, printAreaYMM: z.printAreaYMM,
          })),
        })),
        variantLabel: variantLabel || null,
      };
      if (isNew) {
        await createProduct(data as Parameters<typeof createProduct>[0]);
        notifications.show({ title: t('Product created'), message: `"${name}" ${t('has been created')}`, color: 'green' });
      } else {
        await updateProduct(id!, data);
        notifications.show({ title: t('Product saved'), message: `"${name}" ${t('has been updated')}`, color: 'green' });
      }
      navigate('/products');
    } catch (e) {
      notifications.show({ title: t('Error'), message: t((e as Error).message), color: 'red' });
    } finally {
      setSaving(false);
    }
  };

  const addStage = () => {
    const stageNum = stages.length + 1;
    const names = ['Front', 'Back', 'Left', 'Right', 'Sleeve Left', 'Sleeve Right'];
    setStages([...stages, {
      id: `stage-${stageNum}`,
      name: names[stageNum - 1] ?? `Stage ${stageNum}`,
      baseImageUrl: '',
      baseImageWidthMM: 500, baseImageHeightMM: 500,
      printAreaWidthMM: 200, printAreaHeightMM: 300,
      printAreaXMM: 150, printAreaYMM: 105,
      exportIncludeBase: false, cropMarks: false, useMaskLayer: false,
    }]);
  };

  const removeStage = (idx: number) => {
    if (stages.length <= 1) return;
    setStages(stages.filter((_, i) => i !== idx));
  };

  const updateStage = (idx: number, updates: Partial<Stage>) => {
    if (selectedVariantIdx === -1) {
      setStages(stages.map((s, i) => i === idx ? { ...s, ...updates } : s));
    } else {
      setVariants(variants.map((v, vi) => {
        if (vi !== selectedVariantIdx || !v.zones) return v;
        return { ...v, zones: v.zones.map((z, zi) => zi === idx ? { ...z, ...updates } : z) };
      }));
    }
  };

  // Active stages based on variant selection
  const activeStages = selectedVariantIdx === -1
    ? stages
    : variants[selectedVariantIdx]?.zones ?? stages;

  const addAttribute = () => {
    setAttributes([...attributes, {
      id: `attr-${Date.now()}`, name: '', type: 'dropdown', values: [],
      required: false, usedForVariations: false,
    }]);
  };

  const removeAttribute = (idx: number) => {
    setAttributes(attributes.filter((_, i) => i !== idx));
  };

  const updateAttribute = (idx: number, updates: Partial<Attribute>) => {
    setAttributes(attributes.map((a, i) => i === idx ? { ...a, ...updates } : a));
  };

  if (loadingProduct) {
    return <Text c="dimmed" p="xl">{t('Loading product...')}</Text>;
  }

  return (
    <div>
      <Group mb="lg">
        <ActionIcon variant="subtle" color="gray" onClick={() => navigate('/products')}>
          <ArrowLeft size={20} />
        </ActionIcon>
        <Title order={2}>{isNew ? t('Add New Product Base') : `${t('Edit')}: ${name || t('Product')}`}</Title>
      </Group>

      <Tabs defaultValue="details">
        <Tabs.List mb="md">
          <Tabs.Tab value="details">{t('Details')}</Tabs.Tab>
          <Tabs.Tab value="design">{t('Design')}</Tabs.Tab>
          <Tabs.Tab value="attributes">{t('Attributes')}</Tabs.Tab>
          <Tabs.Tab value="variations">{t('Variations')}</Tabs.Tab>
        </Tabs.List>

        {/* TAB 1: Details */}
        <Tabs.Panel value="details">
          <Paper p="lg" radius="md" withBorder>
            <Stack gap="md">
              <TextInput
                label={t('Name')}
                description={t('The name of the product base displays on the list')}
                placeholder="Basic T-Shirt"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <NumberInput
                label={t('Price')}
                description={t('Base price for products. Total cost depends on base price, attributes, and printing method')}
                placeholder="0.00"
                value={price}
                onChange={(v) => setPrice(Number(v) || 0)}
                prefix="$"
                decimalScale={2}
                min={0}
              />

              <TextInput
                label={t('CMS Product')}
                description={t('Automatically assigned when creating a WooCommerce/Shopify product')}
                placeholder={t('Auto-assigned')}
                disabled
                value=""
              />

              <Textarea
                label={t('Description')}
                description={t('Short description of this product')}
                placeholder={t('Enter product description...')}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                minRows={3}
              />

              <MultiSelect
                label={t('Categories')}
                description={t('Select one or more categories. Helpful for sorting items')}
                placeholder={t('Select categories')}
                data={CATEGORIES.map((c) => ({ value: c, label: t(c) }))}
                value={categories}
                onChange={setCategories}
                searchable
                clearable
              />

              <MultiSelect
                label={t('Printing Techniques')}
                description={t('Printing methods that can apply to this product base')}
                placeholder={t('Select printing methods')}
                data={PRINTING_TECHNIQUES.map((p) => ({ value: p, label: t(p) }))}
                value={printingTechniques}
                onChange={setPrintingTechniques}
                searchable
                clearable
              />

              <Switch
                label={t('Active')}
                description={t('Enable/Disable product base on the switching products')}
                checked={active}
                onChange={(e) => setActive(e.currentTarget.checked)}
                size="md"
              />
            </Stack>
          </Paper>
        </Tabs.Panel>

        {/* TAB 2: Design */}
        <Tabs.Panel value="design">
          <Stack gap="md">
            {/* Variant selector — if product has variants, show tabs to edit each variant's zones */}
            {variants.length > 0 && (
              <Paper p="md" radius="md" withBorder>
                <Text fw={600} size="sm" mb="xs">{variantLabel || t('Variants')} ({variants.length})</Text>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  <button
                    onClick={() => setSelectedVariantIdx(-1)}
                    style={{
                      padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                      borderWidth: 2, borderStyle: 'solid',
                      borderColor: selectedVariantIdx === -1 ? '#4A90D9' : '#e0e0e0',
                      background: selectedVariantIdx === -1 ? '#EBF2FA' : '#fff',
                      color: selectedVariantIdx === -1 ? '#4A90D9' : '#555',
                    }}
                  >
                    {t('Default')}
                  </button>
                  {variants.map((v, vi) => (
                    <button
                      key={v.id}
                      onClick={() => setSelectedVariantIdx(vi)}
                      style={{
                        padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
                        borderWidth: 2, borderStyle: 'solid',
                        borderColor: selectedVariantIdx === vi ? '#4A90D9' : '#e0e0e0',
                        background: selectedVariantIdx === vi ? '#EBF2FA' : '#fff',
                        color: selectedVariantIdx === vi ? '#4A90D9' : '#555',
                      }}
                    >
                      {v.name} {v.zones ? `(${v.zones.length} ${t('zones')})` : `(${t('uses default')})`}
                    </button>
                  ))}
                </div>
                <Text size="xs" c="dimmed" mt={6}>
                  {selectedVariantIdx === -1 ? t('Editing default zones — used when no variant is selected') : `${t('Editing zones for')}: ${variants[selectedVariantIdx]?.name}`}
                </Text>
              </Paper>
            )}

            <Group justify="space-between">
              <Text fw={600} size="sm">{t('Product Stages')}</Text>
              <Button variant="light" size="xs" leftSection={<Plus size={14} />} onClick={addStage}>
                {t('Add Stage')}
              </Button>
            </Group>

            {activeStages.map((stage, idx) => (
              <Paper key={stage.id} p="lg" radius="md" withBorder>
                <Group justify="space-between" mb="md">
                  <Group gap="sm">
                    <Badge size="lg" variant="light">{stage.name}</Badge>
                    <TextInput
                      value={stage.name}
                      onChange={(e) => updateStage(idx, { name: e.target.value })}
                      size="xs"
                      w={120}
                      variant="filled"
                    />
                  </Group>
                  <Group gap="xs">
                    {stages.length > 1 && (
                      <ActionIcon variant="subtle" color="red" onClick={() => removeStage(idx)} title={t('Remove stage')}>
                        <Trash2 size={16} />
                      </ActionIcon>
                    )}
                  </Group>
                </Group>

                <Stack gap="md">
                  {/* Mask + What is this */}
                  <Group justify="space-between">
                    <Switch
                      label={t('Use as a Mask Layer')}
                      description={t('Enable product color change with mask image')}
                      checked={stage.useMaskLayer}
                      onChange={(e) => updateStage(idx, { useMaskLayer: e.currentTarget.checked })}
                      size="sm"
                    />
                    <Button
                      variant="subtle"
                      size="xs"
                      color="gray"
                      onClick={() => setShowMaskInfo(true)}
                    >
                      {t('What is this?')}
                    </Button>
                  </Group>

                  <Divider />

                  {/* Product Image Preview */}
                  <div>
                    <Text size="sm" fw={500} mb={8}>{t('Product Preview & Design Area')}</Text>
                    <Text size="xs" c="dimmed" mb={12}>
                      {t('Drag to set the design area. The dashed rectangle shows where customers can place their design.')}
                    </Text>

                    {/* Mockup preview */}
                    <Paper p="md" radius="md" bg="var(--mantine-color-gray-1)" mb="md">
                      <div style={{
                        position: 'relative',
                        width: '100%',
                        maxWidth: 300,
                        margin: '0 auto',
                        aspectRatio: '1',
                        background: '#e8e8e8',
                        borderRadius: 8,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}>
                        {stage.baseImageUrl ? (
                          <img src={resolveUrl(stage.baseImageUrl)} alt={stage.name} style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
                        ) : (
                          <Stack
                            align="center"
                            gap={4}
                            style={{ cursor: 'pointer' }}
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = 'image/png,image/jpeg,image/svg+xml';
                              input.onchange = () => {
                                const file = input.files?.[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = () => updateStage(idx, { baseImageUrl: reader.result as string });
                                reader.readAsDataURL(file);
                              };
                              input.click();
                            }}
                          >
                            <Upload size={24} color="#aaa" />
                            <Text size="xs" c="dimmed">{t('Click to upload image')}</Text>
                            <Text size="xs" c="dimmed" style={{ fontSize: 10 }}>PNG, JPG, SVG</Text>
                          </Stack>
                        )}

                        {/* Design area overlay */}
                        <div style={{
                          position: 'absolute',
                          left: `${(stage.printAreaXMM / stage.baseImageWidthMM) * 100}%`,
                          top: `${(stage.printAreaYMM / stage.baseImageHeightMM) * 100}%`,
                          width: `${(stage.printAreaWidthMM / stage.baseImageWidthMM) * 100}%`,
                          height: `${(stage.printAreaHeightMM / stage.baseImageHeightMM) * 100}%`,
                          border: '2px dashed #4A90D9',
                          borderRadius: 4,
                          background: 'rgba(74,144,217,0.08)',
                          pointerEvents: 'none',
                        }} />
                      </div>

                      <Group justify="center" mt="sm">
                        <Button
                          variant="subtle"
                          size="xs"
                          onClick={() => updateStage(idx, {
                            printAreaXMM: Math.round((stage.baseImageWidthMM - stage.printAreaWidthMM) / 2),
                            printAreaYMM: Math.round((stage.baseImageHeightMM - stage.printAreaHeightMM) / 2),
                          })}
                        >
                          {t('Update Position (Center)')}
                        </Button>
                      </Group>
                    </Paper>
                  </div>

                  {/* Edit Zone — Size */}
                  <Text size="sm" fw={500}>{t('Edit Zone — Size for Printing')}</Text>

                  <Select
                    label={t('Printing Size')}
                    description={t('Select preset or customize')}
                    data={PRINTING_SIZES.map((s) => ({ value: s, label: s === 'Custom' ? t('Custom') : s }))}
                    defaultValue="Custom"
                    size="sm"
                  />

                  <Group grow>
                    <NumberInput
                      label={t('Width (mm)')}
                      value={stage.printAreaWidthMM}
                      onChange={(v) => { if (typeof v === 'number') updateStage(idx, { printAreaWidthMM: v }); }}
                      size="sm"
                      min={1}
                      step={5}
                    />
                    <NumberInput
                      label={t('Height (mm)')}
                      value={stage.printAreaHeightMM}
                      onChange={(v) => { if (typeof v === 'number') updateStage(idx, { printAreaHeightMM: v }); }}
                      size="sm"
                      min={1}
                      step={5}
                    />
                  </Group>

                  <Group grow>
                    <NumberInput
                      label={t('Offset X (mm)')}
                      value={stage.printAreaXMM}
                      onChange={(v) => { if (typeof v === 'number') updateStage(idx, { printAreaXMM: v }); }}
                      size="sm"
                      min={0}
                      step={5}
                    />
                    <NumberInput
                      label={t('Offset Y (mm)')}
                      value={stage.printAreaYMM}
                      onChange={(v) => { if (typeof v === 'number') updateStage(idx, { printAreaYMM: v }); }}
                      size="sm"
                      min={0}
                      step={5}
                    />
                  </Group>

                  <Divider />

                  {/* Toggles */}
                  <Switch
                    label={t('Export Include Base')}
                    description={t('Export for printing includes product base image')}
                    checked={stage.exportIncludeBase}
                    onChange={(e) => updateStage(idx, { exportIncludeBase: e.currentTarget.checked })}
                    size="sm"
                  />

                  <Switch
                    label={t('Crop Marks & Bleed')}
                    description={t('Show guideline for crop marks & bleed on the editor')}
                    checked={stage.cropMarks}
                    onChange={(e) => updateStage(idx, { cropMarks: e.currentTarget.checked })}
                    size="sm"
                  />

                  <Divider />

                  {/* Image upload + Reset */}
                  <Group>
                    {stage.baseImageUrl ? (
                      <>
                        <Button variant="light" size="xs" leftSection={<Upload size={14} />} onClick={() => {
                          const input = document.createElement('input');
                          input.type = 'file';
                          input.accept = 'image/png,image/jpeg,image/svg+xml';
                          input.onchange = () => {
                            const file = input.files?.[0];
                            if (!file) return;
                            const reader = new FileReader();
                            reader.onload = () => updateStage(idx, { baseImageUrl: reader.result as string });
                            reader.readAsDataURL(file);
                          };
                          input.click();
                        }}>
                          {t('Change Image')}
                        </Button>
                        <Button variant="subtle" size="xs" color="red" onClick={() => updateStage(idx, { baseImageUrl: '' })}>
                          {t('Remove Image')}
                        </Button>
                      </>
                    ) : (
                      <FileInput
                        placeholder={t('Select product image (JPG, PNG, SVG)')}
                        accept="image/png,image/jpeg,image/svg+xml"
                        leftSection={<Upload size={14} />}
                        size="sm"
                        onChange={(file) => {
                          if (!file) return;
                          const reader = new FileReader();
                          reader.onload = () => updateStage(idx, { baseImageUrl: reader.result as string });
                          reader.readAsDataURL(file);
                        }}
                      />
                    )}
                    <Button variant="subtle" size="xs" color="gray" onClick={() => updateStage(idx, {
                      printAreaWidthMM: 200, printAreaHeightMM: 300,
                      printAreaXMM: 150, printAreaYMM: 105,
                      exportIncludeBase: false, cropMarks: false, useMaskLayer: false,
                    })}>
                      {t('Reset All')}
                    </Button>
                  </Group>
                </Stack>
              </Paper>
            ))}
          </Stack>

          {/* Mask info modal */}
          <Modal opened={showMaskInfo} onClose={() => setShowMaskInfo(false)} title={t('What is a Mask Layer?')} centered>
            <Stack gap="sm">
              <Text size="sm">{t('A mask layer is a special product image that enables product color change in the editor.')}</Text>
              <Text size="sm">{t('When enabled, the product image is used as a mask — the white areas of the image will be filled with the selected product color, while keeping shadows, folds, and details visible.')}</Text>
              <Text size="sm" fw={500}>{t('How to use:')}</Text>
              <Text size="sm">{t('1. Upload a product image with a white or light colored product on a transparent or dark background.')}</Text>
              <Text size="sm">{t('2. Enable "Use as a Mask Layer" toggle.')}</Text>
              <Text size="sm">{t('3. In the editor, the product color selector will change the product color in real-time.')}</Text>
              <Button onClick={() => setShowMaskInfo(false)} mt="sm">{t('Got it')}</Button>
            </Stack>
          </Modal>
        </Tabs.Panel>

        {/* TAB 3: Attributes */}
        <Tabs.Panel value="attributes">
          <Stack gap="md">
            <Group justify="space-between">
              <div>
                <Text fw={600} size="sm">{t('Product Attributes')}</Text>
                <Text size="xs" c="dimmed">{t('Config attributes of products to use for add to cart')}</Text>
              </div>
              <Button variant="light" size="xs" leftSection={<Plus size={14} />} onClick={addAttribute}>
                {t('Add New Attribute')}
              </Button>
            </Group>

            {attributes.length === 0 ? (
              <Paper p="xl" radius="md" withBorder>
                <Stack align="center" gap="xs">
                  <Text c="dimmed" size="sm">{t('No attributes yet')}</Text>
                  <Text c="dimmed" size="xs">{t('Add attributes like Product Colors, Sizes, or custom options')}</Text>
                </Stack>
              </Paper>
            ) : (
              attributes.map((attr, idx) => (
                <Paper key={attr.id} p="lg" radius="md" withBorder>
                  <Group justify="space-between" mb="md">
                    <Badge size="md" variant="light">
                      {attr.name || `${t('Attribute')} ${idx + 1}`}
                    </Badge>
                    <ActionIcon variant="subtle" color="red" onClick={() => removeAttribute(idx)}>
                      <Trash2 size={14} />
                    </ActionIcon>
                  </Group>

                  <Stack gap="md">
                    {/* Name + Type */}
                    <Group grow>
                      <TextInput
                        label={t('Name')}
                        placeholder={t('e.g. Color, Size, Material')}
                        value={attr.name}
                        onChange={(e) => updateAttribute(idx, { name: e.target.value })}
                        size="sm"
                      />
                      <Select
                        label={t('Attribute Type')}
                        data={[
                          { value: 'color', label: t('Product Colors') },
                          { value: 'dropdown', label: t('Dropdown') },
                          { value: 'input', label: t('Input Text') },
                          { value: 'options', label: t('Options') },
                          { value: 'quantity', label: t('Quantity') },
                        ]}
                        value={attr.type}
                        onChange={(v) => updateAttribute(idx, { type: (v as Attribute['type']) ?? 'dropdown' })}
                        size="sm"
                      />
                    </Group>

                    {/* Checkboxes */}
                    <Group>
                      <Checkbox
                        label={t('Field Required')}
                        description={t('Set this attribute as required field before adding to cart')}
                        checked={attr.required}
                        onChange={(e) => updateAttribute(idx, { required: e.currentTarget.checked })}
                        size="sm"
                      />
                      <Checkbox
                        label={t('Used for Variations')}
                        description={t('Use to create product variations')}
                        checked={attr.usedForVariations}
                        onChange={(e) => updateAttribute(idx, { usedForVariations: e.currentTarget.checked })}
                        size="sm"
                      />
                    </Group>

                    <Divider />

                    {/* Values — different UI per type */}
                    {attr.type !== 'input' && attr.type !== 'quantity' && (
                      <>
                        <Group justify="space-between">
                          <Text size="sm" fw={500}>{t('Values')}</Text>
                          <Button
                            variant="subtle"
                            size="xs"
                            leftSection={<Plus size={12} />}
                            onClick={() => {
                              const newVal: AttributeValue = {
                                label: '', value: '', extraPrice: 0,
                                ...(attr.type === 'color' ? { color: '#000000' } : {}),
                              };
                              updateAttribute(idx, { values: [...attr.values, newVal] });
                            }}
                          >
                            {t('Add Value')}
                          </Button>
                        </Group>

                        {attr.values.length === 0 ? (
                          <Text size="xs" c="dimmed" ta="center">{t('No values yet — click "Add Value"')}</Text>
                        ) : (
                          <Table withTableBorder withColumnBorders>
                            <Table.Thead>
                              <Table.Tr>
                                {attr.type === 'color' && <Table.Th w={60}>{t('Color')}</Table.Th>}
                                <Table.Th>{t('Label')}</Table.Th>
                                <Table.Th w={100}>{t('Extra Price')}</Table.Th>
                                <Table.Th w={40}></Table.Th>
                              </Table.Tr>
                            </Table.Thead>
                            <Table.Tbody>
                              {attr.values.map((val, vIdx) => (
                                <Table.Tr key={vIdx}>
                                  {attr.type === 'color' && (
                                    <Table.Td>
                                      <ColorInput
                                        value={val.color ?? '#000000'}
                                        onChange={(c) => {
                                          const newVals = [...attr.values];
                                          newVals[vIdx] = { ...val, color: c };
                                          updateAttribute(idx, { values: newVals });
                                        }}
                                        size="xs"
                                        withEyeDropper={false}
                                        swatches={['#FFFFFF', '#222222', '#1B2A4A', '#C62828', '#1565C0', '#2E7D32', '#757575', '#F9A825', '#E65100', '#EC407A', '#7B1FA2', '#5D4037']}
                                      />
                                    </Table.Td>
                                  )}
                                  <Table.Td>
                                    <TextInput
                                      value={val.label}
                                      onChange={(e) => {
                                        const newVals = [...attr.values];
                                        newVals[vIdx] = { ...val, label: e.target.value, value: e.target.value.toLowerCase().replace(/\s+/g, '-') };
                                        updateAttribute(idx, { values: newVals });
                                      }}
                                      placeholder={attr.type === 'color' ? t('e.g. Navy Blue') : t('e.g. Small')}
                                      size="xs"
                                      variant="unstyled"
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <NumberInput
                                      value={val.extraPrice}
                                      onChange={(v) => {
                                        const newVals = [...attr.values];
                                        newVals[vIdx] = { ...val, extraPrice: Number(v) || 0 };
                                        updateAttribute(idx, { values: newVals });
                                      }}
                                      prefix="$"
                                      decimalScale={2}
                                      min={0}
                                      size="xs"
                                      variant="unstyled"
                                    />
                                  </Table.Td>
                                  <Table.Td>
                                    <ActionIcon
                                      variant="subtle"
                                      color="red"
                                      size="xs"
                                      onClick={() => {
                                        const newVals = attr.values.filter((_, i) => i !== vIdx);
                                        updateAttribute(idx, { values: newVals });
                                      }}
                                    >
                                      <Trash2 size={12} />
                                    </ActionIcon>
                                  </Table.Td>
                                </Table.Tr>
                              ))}
                            </Table.Tbody>
                          </Table>
                        )}
                      </>
                    )}

                    {attr.type === 'input' && (
                      <Text size="xs" c="dimmed">
                        {t('This attribute shows a text input field. Users can enter custom text when adding to cart.')}
                      </Text>
                    )}

                    {attr.type === 'quantity' && (
                      <Group grow>
                        <NumberInput label={t('Min Quantity')} placeholder="1" min={1} size="sm" />
                        <NumberInput label={t('Max Quantity')} placeholder="100" min={1} size="sm" />
                        <NumberInput label={t('Price per unit ($)')} prefix="$" decimalScale={2} min={0} size="sm" />
                      </Group>
                    )}
                  </Stack>
                </Paper>
              ))
            )}

            <Text size="xs" c="dimmed">
              {t('You can add an extra price for each attribute value. The product total will depend on base price + attributes + printing method.')}
            </Text>
          </Stack>
        </Tabs.Panel>

        {/* TAB 4: Variations */}
        <Tabs.Panel value="variations">
          <VariationsTab attributes={attributes} />
        </Tabs.Panel>
      </Tabs>

      {/* Save button — fixed at bottom */}
      <Paper p="md" radius="md" withBorder mt="lg" style={{ position: 'sticky', bottom: 16 }}>
        <Group justify="flex-end">
          <Button variant="default" onClick={() => navigate('/products')}>{t('Cancel')}</Button>
          <Button
            onClick={handleSave}
            leftSection={<Save size={16} />}
            loading={saving}
          >
            {isNew ? t('Create Product') : t('Save Product')}
          </Button>
        </Group>
      </Paper>
    </div>
  );
}

// === Variations Tab ===
interface Variation {
  id: string;
  combination: Record<string, string>;
  sku: string;
  regularPrice: number;
  minQuantity: number;
  maxQuantity: number;
  description: string;
  printingTechniques: boolean;
  customDesign: boolean;
  expanded: boolean;
}

function VariationsTab({ attributes }: { attributes: Attribute[] }) {
  const t = useT();
  const [variations, setVariations] = useState<Variation[]>([]);

  const variationAttrs = attributes.filter((a) => a.usedForVariations && a.values.length > 0);
  const canGenerate = variationAttrs.length > 0;

  const generateVariations = () => {
    if (!canGenerate) return;

    // Generate cartesian product of all variation attribute values
    const combos = cartesianProduct(variationAttrs.map((a) => a.values.map((v) => ({ attrName: a.name, value: v.label }))));

    const newVariations: Variation[] = combos.map((combo, idx) => {
      const combination: Record<string, string> = {};
      combo.forEach((c) => { combination[c.attrName] = c.value; });
      const sku = combo.map((c) => c.value.substring(0, 3).toUpperCase()).join('-');

      return {
        id: `var-${idx}`,
        combination,
        sku,
        regularPrice: 0,
        minQuantity: 1,
        maxQuantity: 100,
        description: '',
        printingTechniques: true,
        customDesign: true,
        expanded: false,
      };
    });

    setVariations(newVariations);
  };

  const updateVariation = (idx: number, updates: Partial<Variation>) => {
    setVariations(variations.map((v, i) => i === idx ? { ...v, ...updates } : v));
  };

  const removeVariation = (idx: number) => {
    setVariations(variations.filter((_, i) => i !== idx));
  };

  const toggleExpand = (idx: number) => {
    updateVariation(idx, { expanded: !variations[idx]!.expanded });
  };

  const bulkEdit = () => {
    // Expand all
    setVariations(variations.map((v) => ({ ...v, expanded: true })));
  };

  return (
    <Stack gap="md">
      <Group justify="space-between">
        <div>
          <Text fw={600} size="sm">{t('Product Variations')}</Text>
          <Text size="xs" c="dimmed">
            {canGenerate
              ? t('Based on your attributes, create all available variations')
              : t('Mark attributes as "Used for Variations" to generate combinations')}
          </Text>
        </div>
        <Group gap="xs">
          {variations.length > 0 && (
            <Button variant="light" size="xs" onClick={bulkEdit}>
              {t('Bulk Edit Variations')}
            </Button>
          )}
          <Button
            size="xs"
            leftSection={<Plus size={14} />}
            onClick={generateVariations}
            disabled={!canGenerate}
          >
            {variations.length > 0 ? t('Regenerate') : t('Add New Variation')}
          </Button>
        </Group>
      </Group>

      {!canGenerate && variations.length === 0 && (
        <Paper p="xl" radius="md" withBorder>
          <Stack align="center" gap="xs">
            <Text c="dimmed" size="sm">{t('No variations yet')}</Text>
            <Text c="dimmed" size="xs">
              {t('Go to the Attributes tab, add attributes with values, and check "Used for Variations"')}
            </Text>
          </Stack>
        </Paper>
      )}

      {variations.length > 0 && (
        <>
          <Text size="xs" c="dimmed">{variations.length} {t('variation(s) generated. Click "Expand" to edit details.')}</Text>

          <Table withTableBorder>
            <Table.Thead>
              <Table.Tr>
                <Table.Th w={40}>#</Table.Th>
                {variationAttrs.map((a) => (
                  <Table.Th key={a.id}>{a.name}</Table.Th>
                ))}
                <Table.Th>SKU</Table.Th>
                <Table.Th>{t('Price')}</Table.Th>
                <Table.Th w={120}></Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {variations.map((v, idx) => (
                <>
                  <Table.Tr key={v.id}>
                    <Table.Td><Text size="xs" c="dimmed">{idx + 1}</Text></Table.Td>
                    {variationAttrs.map((a) => (
                      <Table.Td key={a.id}>
                        <Badge size="sm" variant="light" styles={{ label: { overflow: 'visible' } }}>
                          {v.combination[a.name] ?? '—'}
                        </Badge>
                      </Table.Td>
                    ))}
                    <Table.Td>
                      <Text size="xs" ff="monospace">{v.sku}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Text size="xs">${v.regularPrice.toFixed(2)}</Text>
                    </Table.Td>
                    <Table.Td>
                      <Group gap={4} justify="flex-end">
                        <Button variant="subtle" size="xs" onClick={() => toggleExpand(idx)}>
                          {v.expanded ? t('Collapse') : t('Expand')}
                        </Button>
                        <ActionIcon variant="subtle" color="red" size="sm" onClick={() => removeVariation(idx)}>
                          <Trash2 size={14} />
                        </ActionIcon>
                      </Group>
                    </Table.Td>
                  </Table.Tr>

                  {/* Expanded detail */}
                  {v.expanded && (
                    <Table.Tr key={`${v.id}-detail`}>
                      <Table.Td colSpan={variationAttrs.length + 4}>
                        <Paper p="md" bg="var(--mantine-color-gray-0)">
                          <Stack gap="sm">
                            <Group grow>
                              <NumberInput
                                label={t('Regular Price ($)')}
                                value={v.regularPrice}
                                onChange={(val) => updateVariation(idx, { regularPrice: Number(val) || 0 })}
                                prefix="$"
                                decimalScale={2}
                                min={0}
                                size="xs"
                              />
                              <NumberInput
                                label={t('Min Quantity')}
                                value={v.minQuantity}
                                onChange={(val) => updateVariation(idx, { minQuantity: Number(val) || 1 })}
                                min={1}
                                size="xs"
                              />
                              <NumberInput
                                label={t('Max Quantity')}
                                value={v.maxQuantity}
                                onChange={(val) => updateVariation(idx, { maxQuantity: Number(val) || 100 })}
                                min={1}
                                size="xs"
                              />
                            </Group>

                            <TextInput
                              label={t('Description')}
                              placeholder={t('Optional description for this variation')}
                              value={v.description}
                              onChange={(e) => updateVariation(idx, { description: e.target.value })}
                              size="xs"
                            />

                            <Group>
                              <Switch
                                label={t('Configure Printing Techniques')}
                                checked={v.printingTechniques}
                                onChange={(e) => updateVariation(idx, { printingTechniques: e.currentTarget.checked })}
                                size="xs"
                              />
                              <Switch
                                label={t('Custom Design Configuration')}
                                checked={v.customDesign}
                                onChange={(e) => updateVariation(idx, { customDesign: e.currentTarget.checked })}
                                size="xs"
                              />
                            </Group>
                          </Stack>
                        </Paper>
                      </Table.Td>
                    </Table.Tr>
                  )}
                </>
              ))}
            </Table.Tbody>
          </Table>
        </>
      )}
    </Stack>
  );
}

// Helper: cartesian product of arrays
function cartesianProduct<T>(arrays: T[][]): T[][] {
  if (arrays.length === 0) return [[]];
  return arrays.reduce<T[][]>(
    (acc, curr) => acc.flatMap((a) => curr.map((c) => [...a, c])),
    [[]],
  );
}
