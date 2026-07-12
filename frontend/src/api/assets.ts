/**
 * Assets API module (Phase 5)
 */

import { api } from './client';

export interface AssetDocument {
  id: number;
  asset_id: number;
  file_path: string;
  doc_type: 'photo' | 'document';
  created_at: string;
}

export type AssetCondition = 'new' | 'good' | 'fair' | 'poor';
export type AssetStatus = 'available' | 'allocated' | 'reserved' | 'under_maintenance' | 'lost' | 'retired' | 'disposed';

export interface Asset {
  id: number;
  asset_tag: string;
  name: string;
  category_id: number;
  category_name: string | null;
  serial_number: string | null;
  acquisition_date: string | null;
  acquisition_cost: number | null;
  condition: AssetCondition;
  location: string | null;
  is_bookable: boolean;
  qr_code_path: string | null;
  status: AssetStatus;
  created_at: string;
  updated_at: string;
}

export interface AssetListParams {
  search?: string;
  category_id?: number;
  status?: string;
  location?: string;
}

export const assetsApi = {
  list: (params?: AssetListParams) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.category_id) qs.set('category_id', String(params.category_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.location) qs.set('location', params.location);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ assets: Asset[] }>(`/assets${query}`);
  },

  get: (id: number) => api.get<{ asset: Asset }>(`/assets/${id}`),

  getByTag: (tag: string) => api.get<{ asset: Asset }>(`/assets/tag/${tag}`),

  create: (payload: {
    name: string;
    category_id: number;
    serial_number?: string | null;
    acquisition_date?: string | null;
    acquisition_cost?: string | number | null;
    condition: string;
    location?: string | null;
    is_bookable: boolean;
  }) => api.post<{ asset: Asset }>('/assets', payload),

  update: (id: number, payload: Partial<Asset>) =>
    api.patch<{ asset: Asset }>(`/assets/${id}`, payload),

  getDocuments: (id: number) => api.get<{ documents: AssetDocument[] }>(`/assets/${id}/documents`),

  uploadDocument: async (id: number, file: File, docType: 'photo' | 'document') => {
    // We cannot use the standard api.post because it sets Content-Type to application/json.
    // So we use standard fetch for multipart/form-data.
    const token = localStorage.getItem('af_token');
    const formData = new FormData();
    formData.append('file', file);
    formData.append('doc_type', docType);

    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const response = await fetch(`/api/assets/${id}/documents`, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error?.message || 'Upload failed');
    }
    return data.data as { document: AssetDocument };
  },
};
