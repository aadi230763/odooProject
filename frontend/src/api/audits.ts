/**
 * Audit Cycles API module (Phase 9)
 */

import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type AuditCycleStatus = 'open' | 'closed';
export type AuditItemResult = 'pending' | 'verified' | 'missing' | 'damaged';

export interface AuditCycle {
  id: number;
  name: string;
  scope_department_id: number | null;
  scope_department_name: string | null;
  scope_location: string | null;
  start_date: string;
  end_date: string;
  status: AuditCycleStatus;
  created_by: number;
  creator_name: string | null;
  auditor_ids: number[];
  auditor_names: string[];
  item_count: number;
  pending_count: number;
  verified_count: number;
  missing_count: number;
  damaged_count: number;
  created_at: string;
  updated_at: string;
}

export interface AuditItem {
  id: number;
  audit_cycle_id: number;
  asset_id: number;
  asset_tag: string | null;
  asset_name: string | null;
  asset_status: string | null;
  asset_location: string | null;
  result: AuditItemResult;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const auditsApi = {
  list: (params?: { status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ audit_cycles: AuditCycle[] }>(`/audits${query}`);
  },

  get: (id: number) => api.get<{ audit_cycle: AuditCycle }>(`/audits/${id}`),

  create: (payload: {
    name: string;
    start_date: string;
    end_date: string;
    scope_department_id?: number | null;
    scope_location?: string | null;
  }) => api.post<{ audit_cycle: AuditCycle }>('/audits', payload),

  assignAuditors: (id: number, auditor_ids: number[]) =>
    api.patch<{ audit_cycle: AuditCycle }>(`/audits/${id}/assign-auditors`, {
      auditor_ids,
    }),

  close: (id: number) =>
    api.patch<{ audit_cycle: AuditCycle }>(`/audits/${id}/close`, {}),

  listItems: (id: number) =>
    api.get<{ audit_items: AuditItem[] }>(`/audits/${id}/items`),

  markItem: (
    cycleId: number,
    itemId: number,
    result: AuditItemResult,
    notes?: string,
  ) =>
    api.patch<{ audit_item: AuditItem }>(`/audits/${cycleId}/items/${itemId}`, {
      result,
      notes: notes ?? null,
    }),

  discrepancyReport: (id: number) =>
    api.get<{ discrepancies: AuditItem[] }>(`/audits/${id}/discrepancy-report`),
};
