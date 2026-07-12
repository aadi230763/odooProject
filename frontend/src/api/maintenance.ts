/**
 * Maintenance API module (Phase 8)
 */

import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type MaintenancePriority = 'low' | 'medium' | 'high' | 'critical';

export type MaintenanceStatus =
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'technician_assigned'
  | 'in_progress'
  | 'resolved';

export interface MaintenanceRequest {
  id: number;
  asset_id: number;
  asset_tag: string | null;
  asset_name: string | null;
  raised_by: number;
  raised_by_name: string | null;
  description: string;
  priority: MaintenancePriority;
  photo_path: string | null;
  approver_id: number | null;
  approver_name: string | null;
  technician_id: number | null;
  technician_name: string | null;
  status: MaintenanceStatus;
  created_at: string;
  updated_at: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const maintenanceApi = {
  list: (params?: {
    asset_id?: number;
    status?: string;
    raised_by?: number;
    priority?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.asset_id) qs.set('asset_id', String(params.asset_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.raised_by) qs.set('raised_by', String(params.raised_by));
    if (params?.priority) qs.set('priority', params.priority);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ maintenance_requests: MaintenanceRequest[] }>(
      `/maintenance${query}`,
    );
  },

  get: (id: number) =>
    api.get<{ maintenance_request: MaintenanceRequest }>(`/maintenance/${id}`),

  raise: (
    payload: { asset_id: number; description: string; priority?: string },
    photo?: File,
  ) => {
    if (photo) {
      const form = new FormData();
      form.append('asset_id', String(payload.asset_id));
      form.append('description', payload.description);
      form.append('priority', payload.priority ?? 'medium');
      form.append('photo', photo);
      return api.postForm<{ maintenance_request: MaintenanceRequest }>(
        '/maintenance',
        form,
      );
    }
    return api.post<{ maintenance_request: MaintenanceRequest }>(
      '/maintenance',
      payload,
    );
  },

  approve: (id: number, notes?: string) =>
    api.patch<{ maintenance_request: MaintenanceRequest }>(
      `/maintenance/${id}/approve`,
      { notes },
    ),

  reject: (id: number, notes?: string) =>
    api.patch<{ maintenance_request: MaintenanceRequest }>(
      `/maintenance/${id}/reject`,
      { notes },
    ),

  assignTechnician: (id: number, technician_id: number) =>
    api.patch<{ maintenance_request: MaintenanceRequest }>(
      `/maintenance/${id}/assign-technician`,
      {
        technician_id,
      },
    ),

  startProgress: (id: number) =>
    api.patch<{ maintenance_request: MaintenanceRequest }>(
      `/maintenance/${id}/start`,
      {},
    ),

  resolve: (id: number, notes?: string) =>
    api.patch<{ maintenance_request: MaintenanceRequest }>(
      `/maintenance/${id}/resolve`,
      { notes },
    ),
};
