/**
 * Org API module (Phase 4)
 *
 * Typed calls to /api/org/* — departments, categories, employees.
 */

import { api } from './client';

// ── Shared ─────────────────────────────────────────────────────────────────────

export interface Department {
  id: number;
  name: string;
  status: 'active' | 'inactive';
  head_employee_id: number | null;
  head_name: string | null;
  parent_department_id: number | null;
  parent_name: string | null;
  created_at: string;
  updated_at: string;
}

export interface AssetCategory {
  id: number;
  name: string;
  status: 'active' | 'inactive';
  custom_fields: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'admin' | 'asset_manager' | 'department_head' | 'employee';

export interface OrgEmployee {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  department_id: number | null;
  department_name: string | null;
  created_at: string;
  updated_at: string;
}

// ── Department endpoints ────────────────────────────────────────────────────────

export const departmentsApi = {
  list: () => api.get<{ departments: Department[] }>('/org/departments'),

  get: (id: number) => api.get<{ department: Department }>(`/org/departments/${id}`),

  create: (payload: { name: string; head_employee_id?: number | null; parent_department_id?: number | null }) =>
    api.post<{ department: Department }>('/org/departments', payload),

  update: (id: number, payload: Partial<{ name: string; head_employee_id: number | null; parent_department_id: number | null; status: string }>) =>
    api.patch<{ department: Department }>(`/org/departments/${id}`, payload),

  deactivate: (id: number) => api.delete<null>(`/org/departments/${id}`),
};

// ── Category endpoints ─────────────────────────────────────────────────────────

export const categoriesApi = {
  list: () => api.get<{ categories: AssetCategory[] }>('/org/categories'),

  get: (id: number) => api.get<{ category: AssetCategory }>(`/org/categories/${id}`),

  create: (payload: { name: string; custom_fields?: Record<string, unknown> | null }) =>
    api.post<{ category: AssetCategory }>('/org/categories', payload),

  update: (id: number, payload: Partial<{ name: string; custom_fields: Record<string, unknown> | null; status: string }>) =>
    api.patch<{ category: AssetCategory }>(`/org/categories/${id}`, payload),

  deactivate: (id: number) => api.delete<null>(`/org/categories/${id}`),
};

// ── Employee endpoints ─────────────────────────────────────────────────────────

export interface EmployeeListParams {
  search?: string;
  role?: string;
  status?: string;
  department_id?: number;
}

export const employeesApi = {
  list: (params?: EmployeeListParams) => {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.role) qs.set('role', params.role);
    if (params?.status) qs.set('status', params.status);
    if (params?.department_id) qs.set('department_id', String(params.department_id));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return api.get<{ employees: OrgEmployee[] }>(`/org/employees${query}`);
  },

  get: (id: number) => api.get<{ employee: OrgEmployee }>(`/org/employees/${id}`),

  setRole: (id: number, role: UserRole) =>
    api.patch<{ employee: OrgEmployee }>(`/org/employees/${id}/role`, { role }),

  setStatus: (id: number, status: 'active' | 'inactive') =>
    api.patch<{ employee: OrgEmployee }>(`/org/employees/${id}/status`, { status }),
};
