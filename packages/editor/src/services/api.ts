const API_BASE = '/api/v1';

function getBaseUrl(): string {
  // In development, API runs on a different port
  if (typeof window !== 'undefined' && window.location.port === '3000') {
    return 'http://localhost:3001';
  }
  return '';
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const url = `${getBaseUrl()}${API_BASE}${path}`;
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

// Health
export async function checkHealth(): Promise<{ status: string; version: string }> {
  return request('/health');
}

// Products
export async function getProducts(): Promise<unknown[]> {
  return request('/products');
}

export async function getProduct(id: string): Promise<unknown> {
  return request(`/products/${id}`);
}

// Designs
export interface SavedDesign {
  id: string;
  productId: string;
  name: string;
  designData: unknown;
  thumbnailUrl: string | null;
  status: string;
  sizes: Record<string, number>;
  productColor: string | null;
  createdAt: string;
  updatedAt: string;
}

export async function saveDesign(data: {
  productId: string;
  name?: string;
  designData: unknown;
  status?: string;
  sizes?: Record<string, number>;
  productColor?: string;
}): Promise<SavedDesign> {
  return request('/designs', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function updateDesign(id: string, data: {
  name?: string;
  designData?: unknown;
  thumbnailUrl?: string;
  status?: string;
  sizes?: Record<string, number>;
  productColor?: string;
}): Promise<SavedDesign> {
  return request(`/designs/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getDesign(id: string): Promise<SavedDesign> {
  return request(`/designs/${id}`);
}

export async function listDesigns(): Promise<SavedDesign[]> {
  return request('/designs');
}

export async function deleteDesign(id: string): Promise<void> {
  return request(`/designs/${id}`, { method: 'DELETE' });
}

// Assets
export interface UploadedAsset {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
  storageKey: string;
  createdAt: string;
}

export async function uploadAsset(file: File): Promise<UploadedAsset> {
  const formData = new FormData();
  formData.append('file', file);

  const url = `${getBaseUrl()}${API_BASE}/assets/upload`;
  const res = await fetch(url, {
    method: 'POST',
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Upload failed: ${res.status}`);
  }

  return res.json();
}

export function getAssetUrl(path: string): string {
  return `${getBaseUrl()}${path}`;
}
