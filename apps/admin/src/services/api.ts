const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}/api/v1${path}`, {
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
export const checkHealth = () => request<{ status: string; version: string }>('/health');

// Products
export interface Product {
  id: string;
  name: string;
  slug: string;
  zones: unknown[];
  createdAt: string;
  updatedAt: string;
}

export const listProducts = () => request<Product[]>('/products');
export const getProduct = (id: string) => request<Product>(`/products/${id}`);
export const createProduct = (data: { name: string; slug: string; zones: unknown[] }) =>
  request<Product>('/products', { method: 'POST', body: JSON.stringify(data) });
export const deleteProduct = (id: string) =>
  request<{ success: boolean }>(`/products/${id}`, { method: 'DELETE' });

// Designs
export interface Design {
  id: string;
  productId: string;
  name: string;
  designData: unknown;
  thumbnailUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export const listDesigns = () => request<Design[]>('/designs');
export const getDesign = (id: string) => request<Design>(`/designs/${id}`);
export const deleteDesign = (id: string) =>
  request<{ success: boolean }>(`/designs/${id}`, { method: 'DELETE' });

// Assets
export const uploadAsset = async (file: File) => {
  const formData = new FormData();
  formData.append('file', file);
  const res = await fetch(`${API_BASE}/api/v1/assets/upload`, { method: 'POST', body: formData });
  if (!res.ok) throw new Error('Upload failed');
  return res.json();
};
