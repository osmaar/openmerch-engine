const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status: number, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = { ...options?.headers as Record<string, string> };
  if (options?.body) headers['Content-Type'] = 'application/json';
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api/v1${path}`, { ...options, headers });
  } catch {
    throw new ApiError('Network error', 0, 'NETWORK_ERROR');
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(err.error ?? `Request failed: ${res.status}`, res.status, err.code);
  }
  return res.json();
}

// Health
export const checkHealth = () => request<{ status: string; version: string }>('/health');

// ─── Products ────────────────────────────────────────────────
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price: number;
  categories: string[];
  printingTechniques: string[];
  active: boolean;
  zones: unknown[];
  createdAt: string;
  updatedAt: string;
}

export const listProducts = () => request<Product[]>('/products');
export const getProduct = (id: string) => request<Product>(`/products/${id}`);
export const createProduct = (data: Partial<Product> & { name: string; slug: string; zones: unknown[] }) =>
  request<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
export const updateProduct = (id: string, data: Partial<Product>) =>
  request<Product>(`/products/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteProduct = (id: string) =>
  request<{ success: boolean }>(`/products/${id}`, { method: 'DELETE' });

// ─── Designs ─────────────────────────────────────────────────
export type ProductionStatus = 'queued' | 'processing' | 'completed' | 'failed' | null;

export interface ProductionZoneFiles {
  print: string;
  mockup?: string;
}

export interface Design {
  id: string;
  productId: string;
  name: string;
  designData: unknown;
  thumbnailUrl: string | null;
  status: string;
  sizes: Record<string, number>;
  productColor: string | null;
  productionFiles: Record<string, ProductionZoneFiles> | null;
  productionStatus: ProductionStatus;
  productionError: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listDesigns = () => request<Design[]>('/designs');
export const getDesign = (id: string) => request<Design>(`/designs/${id}`);
export const deleteDesign = (id: string) =>
  request<{ success: boolean }>(`/designs/${id}`, { method: 'DELETE' });
export const generateProductionFiles = (id: string) =>
  request<{ jobId: string; status: 'queued'; designId: string }>(
    `/designs/${id}/generate-files`,
    { method: 'POST' },
  );

// ─── Templates ───────────────────────────────────────────────
export interface Template {
  id: string;
  name: string;
  categories: string[];
  tags: string[];
  fileUrl: string | null;
  fileName: string | null;
  price: number;
  featured: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listTemplates = () => request<Template[]>('/templates');
export const createTemplate = (data: Partial<Template> & { name: string }) =>
  request<Template>('/templates', { method: 'POST', body: JSON.stringify(data) });
export const updateTemplate = (id: string, data: Partial<Template>) =>
  request<Template>(`/templates/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteTemplate = (id: string) =>
  request<{ success: boolean }>(`/templates/${id}`, { method: 'DELETE' });

// ─── Cliparts ────────────────────────────────────────────────
export interface Clipart {
  id: string;
  name: string;
  categories: string[];
  tags: string[];
  fileUrl: string | null;
  price: number;
  featured: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listCliparts = () => request<Clipart[]>('/cliparts');
export const createClipart = (data: Partial<Clipart> & { name: string }) =>
  request<Clipart>('/cliparts', { method: 'POST', body: JSON.stringify(data) });
export const bulkCreateCliparts = (cliparts: Partial<Clipart>[]) =>
  request<Clipart[]>('/cliparts/bulk', { method: 'POST', body: JSON.stringify({ cliparts }) });
export const updateClipart = (id: string, data: Partial<Clipart>) =>
  request<Clipart>(`/cliparts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteClipart = (id: string) =>
  request<{ success: boolean }>(`/cliparts/${id}`, { method: 'DELETE' });

// ─── Shapes ──────────────────────────────────────────────────
export interface Shape {
  id: string;
  name: string;
  svgContent: string;
  sortOrder: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listShapes = () => request<Shape[]>('/shapes');
export const createShape = (data: Partial<Shape> & { name: string }) =>
  request<Shape>('/shapes', { method: 'POST', body: JSON.stringify(data) });
export const updateShape = (id: string, data: Partial<Shape>) =>
  request<Shape>(`/shapes/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteShape = (id: string) =>
  request<{ success: boolean }>(`/shapes/${id}`, { method: 'DELETE' });

// ─── Fonts ───────────────────────────────────────────────────
export interface Font {
  id: string;
  name: string;
  description: string;
  fileUrl: string | null;
  isGoogle: boolean;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const listFonts = () => request<Font[]>('/fonts');
export const createFont = (data: Partial<Font> & { name: string }) =>
  request<Font>('/fonts', { method: 'POST', body: JSON.stringify(data) });
export const updateFont = (id: string, data: Partial<Font>) =>
  request<Font>(`/fonts/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteFont = (id: string) =>
  request<{ success: boolean }>(`/fonts/${id}`, { method: 'DELETE' });

// ─── Printing Types ──────────────────────────────────────────
export interface PrintingType {
  id: string;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  active: boolean;
  calculationMethod: string;
  pricingConfig: unknown;
  resourcePermissions: unknown;
  layoutConfig: unknown;
  createdAt: string;
  updatedAt: string;
}

export const listPrintingTypes = () => request<PrintingType[]>('/printing-types');
export const createPrintingType = (data: Partial<PrintingType> & { title: string }) =>
  request<PrintingType>('/printing-types', { method: 'POST', body: JSON.stringify(data) });
export const updatePrintingType = (id: string, data: Partial<PrintingType>) =>
  request<PrintingType>(`/printing-types/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deletePrintingType = (id: string) =>
  request<{ success: boolean }>(`/printing-types/${id}`, { method: 'DELETE' });

// ─── Orders ──────────────────────────────────────────────────
export interface Order {
  id: string;
  orderId: string;
  customerName: string;
  productName: string;
  designId: string | null;
  status: string;
  total: number;
  designFiles: unknown;
  createdAt: string;
  updatedAt: string;
}

export const listOrders = () => request<Order[]>('/orders');
export const getOrder = (id: string) => request<Order>(`/orders/${id}`);
export const updateOrderStatus = (id: string, status: string) =>
  request<Order>(`/orders/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) });
export const deleteOrder = (id: string) =>
  request<{ success: boolean }>(`/orders/${id}`, { method: 'DELETE' });

// ─── Languages ───────────────────────────────────────────────
export interface Language {
  id: string;
  code: string;
  name: string;
  flag: string;
  active: boolean;
  createdAt: string;
}

export interface TranslationEntry {
  id?: string;
  languageCode: string;
  originalText: string;
  translatedText: string;
}

export const listLanguages = () => request<Language[]>('/languages');
export const createLanguage = (data: { code: string; name: string; flag: string; active?: boolean }) =>
  request<Language>('/languages', { method: 'POST', body: JSON.stringify(data) });
export const updateLanguage = (id: string, data: Partial<Language>) =>
  request<Language>(`/languages/${id}`, { method: 'PUT', body: JSON.stringify(data) });
export const deleteLanguage = (id: string) =>
  request<{ success: boolean }>(`/languages/${id}`, { method: 'DELETE' });
export const getTranslations = (code: string) =>
  request<TranslationEntry[]>(`/languages/${code}/translations`);
export const updateTranslations = (code: string, entries: { originalText: string; translatedText: string }[]) =>
  request<TranslationEntry[]>(`/languages/${code}/translations`, { method: 'PUT', body: JSON.stringify({ entries }) });

// ─── Settings ────────────────────────────────────────────────
export interface Setting {
  key: string;
  value: string;
  isSecret: boolean;
  updatedAt: string;
}

export const getSettings = () => request<Setting[]>('/settings');
export const updateSettings = (entries: { key: string; value: string; isSecret?: boolean }[]) =>
  request<Setting[]>('/settings', { method: 'PUT', body: JSON.stringify({ entries }) });

// ─── Assets ──────────────────────────────────────────────────
export const uploadAsset = async (file: File, category?: 'clipart' | 'font' | 'template' | 'product' | 'upload') => {
  const formData = new FormData();
  formData.append('file', file);
  const query = category ? `?category=${category}` : '';
  const res = await fetch(`${API_BASE}/api/v1/assets/upload${query}`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};
