/**
 * Dashboard, Notifications, and Activity Logs API (Phase 10)
 */

import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export interface DashboardKpis {
  assets_available: number;
  assets_allocated: number;
  assets_reserved: number;
  assets_maintenance: number;
  assets_total: number;
  active_bookings: number;
  pending_transfers: number;
  overdue_allocations: number;
  pending_maintenance: number;
  upcoming_returns: number;
}

export interface OverdueAllocation {
  id: number;
  asset_id: number;
  asset_tag: string | null;
  asset_name: string | null;
  holder_name: string | null;
  expected_return_date: string | null;
  status: string;
}

export interface AppNotification {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  related_entity_type: string | null;
  related_entity_id: number | null;
  created_at: string;
}

export interface ActivityLog {
  id: number;
  actor_id: number | null;
  actor_name: string;
  action: string;
  entity_type: string;
  entity_id: number | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const dashboardApi = {
  getKpis: () =>
    api.get<{
      kpis: DashboardKpis;
      overdue_allocations: OverdueAllocation[];
      upcoming_returns: OverdueAllocation[];
    }>('/dashboard/kpis'),
};

export const notificationsApi = {
  list: (params?: { unread_only?: boolean; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.unread_only) qs.set('unread_only', '1');
    if (params?.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ notifications: AppNotification[]; unread_count: number }>(
      `/notifications${query}`,
    );
  },

  markRead: (id: number) =>
    api.patch<{ notification: AppNotification }>(`/notifications/${id}/read`, {}),

  markAllRead: () =>
    api.post<{ marked: number }>('/notifications/read-all'),

  unreadCount: () =>
    api.get<{ unread_count: number }>('/notifications/unread-count'),
};

export const activityLogsApi = {
  list: (params?: {
    actor_id?: number;
    entity_type?: string;
    action?: string;
    limit?: number;
    offset?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.actor_id) qs.set('actor_id', String(params.actor_id));
    if (params?.entity_type) qs.set('entity_type', params.entity_type);
    if (params?.action) qs.set('action', params.action);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{
      activity_logs: ActivityLog[];
      total: number;
      limit: number;
      offset: number;
    }>(`/logs${query}`);
  },
};
