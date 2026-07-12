/**
 * Allocations & Transfers API module (Phase 6)
 */

import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AllocationStatus = 'active' | 'returned' | 'overdue';
export type TransferStatus =
  'requested' | 'approved' | 'rejected' | 'completed';

export interface Allocation {
  id: number;
  asset_id: number;
  asset_tag: string | null;
  asset_name: string | null;
  holder_employee_id: number | null;
  holder_employee_name: string | null;
  holder_department_id: number | null;
  holder_department_name: string | null;
  allocated_by: number;
  allocator_name: string | null;
  expected_return_date: string | null;
  actual_return_date: string | null;
  checkin_condition_notes: string | null;
  status: AllocationStatus;
  created_at: string;
  updated_at: string;
}

export interface TransferRequest {
  id: number;
  asset_id: number;
  asset_tag: string | null;
  asset_name: string | null;
  from_employee_id: number;
  from_employee_name: string | null;
  to_employee_id: number;
  to_employee_name: string | null;
  requested_by: number;
  requester_name: string | null;
  approver_id: number | null;
  approver_name: string | null;
  status: TransferStatus;
  created_at: string;
  updated_at: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const allocationsApi = {
  list: (params?: {
    asset_id?: number;
    status?: string;
    holder_employee_id?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.asset_id) qs.set('asset_id', String(params.asset_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.holder_employee_id)
      qs.set('holder_employee_id', String(params.holder_employee_id));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ allocations: Allocation[] }>(`/allocations${query}`);
  },

  create: (payload: {
    asset_id: number;
    holder_employee_id?: number | null;
    holder_department_id?: number | null;
    expected_return_date?: string | null;
  }) => api.post<{ allocation: Allocation }>('/allocations', payload),

  return: (id: number, payload?: { checkin_condition_notes?: string | null }) =>
    api.patch<{ allocation: Allocation }>(
      `/allocations/${id}/return`,
      payload ?? {},
    ),
};

export const transfersApi = {
  list: (params?: { asset_id?: number; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.asset_id) qs.set('asset_id', String(params.asset_id));
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ transfers: TransferRequest[] }>(`/transfers${query}`);
  },

  create: (payload: { asset_id: number; to_employee_id: number }) =>
    api.post<{ transfer: TransferRequest }>('/transfers', payload),

  process: (id: number, action: 'approve' | 'reject') =>
    api.patch<{ transfer: TransferRequest }>(`/transfers/${id}`, { action }),
};
