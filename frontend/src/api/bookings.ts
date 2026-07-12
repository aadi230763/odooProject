/**
 * Bookings API module (Phase 7)
 */

import { api } from './client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type BookingStatus = 'upcoming' | 'ongoing' | 'completed' | 'cancelled';

export interface Booking {
  id: number;
  resource_asset_id: number;
  asset_tag: string | null;
  asset_name: string | null;
  booked_by: number;
  booked_by_name: string | null;
  start_time: string;
  end_time: string;
  status: BookingStatus;
  created_at: string;
  updated_at: string;
}

// ── API calls ──────────────────────────────────────────────────────────────────

export const bookingsApi = {
  list: (params?: {
    resource_asset_id?: number;
    status?: string;
    booked_by?: number;
    date_from?: string;
    date_to?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.resource_asset_id) qs.set('resource_asset_id', String(params.resource_asset_id));
    if (params?.status) qs.set('status', params.status);
    if (params?.booked_by) qs.set('booked_by', String(params.booked_by));
    if (params?.date_from) qs.set('date_from', params.date_from);
    if (params?.date_to) qs.set('date_to', params.date_to);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ bookings: Booking[] }>(`/bookings${query}`);
  },

  getForAsset: (assetId: number) =>
    api.get<{ bookings: Booking[] }>(`/bookings/asset/${assetId}`),

  create: (payload: {
    resource_asset_id: number;
    start_time: string;
    end_time: string;
  }) => api.post<{ booking: Booking }>('/bookings', payload),

  cancel: (id: number) =>
    api.patch<{ booking: Booking }>(`/bookings/${id}/cancel`, {}),

  reschedule: (id: number, payload: { start_time: string; end_time: string }) =>
    api.patch<{ booking: Booking }>(`/bookings/${id}/reschedule`, payload),
};
