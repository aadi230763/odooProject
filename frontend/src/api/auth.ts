/**
 * Auth API module
 *
 * All calls that talk to /api/auth/*.  Returns typed data; throws ApiError on failure.
 *
 * NOTE: The backend returns `{ token, employee }` (not `user`).  We normalise
 * the shape here so callers always get `{ token, user }` as declared in AuthResponse.
 */

import type { AuthUser } from '../context/AuthContext';
import { api } from './client';

// ── Request / Response types ───────────────────────────────────────────────────

export interface SignupPayload {
  name: string;
  email: string;
  password: string;
  department_id?: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

/** Raw shape the backend actually returns */
interface RawAuthData {
  token: string;
  employee: AuthUser;
}

function normalise(raw: RawAuthData): AuthResponse {
  return { token: raw.token, user: raw.employee };
}

// ── Endpoints ──────────────────────────────────────────────────────────────────

export const authApi = {
  signup: async (payload: SignupPayload): Promise<AuthResponse> => {
    const raw = await api.post<RawAuthData>('/auth/signup', payload);
    return normalise(raw);
  },

  login: async (payload: LoginPayload): Promise<AuthResponse> => {
    const raw = await api.post<RawAuthData>('/auth/login', payload);
    return normalise(raw);
  },

  logout: () => api.post<null>('/auth/logout'),

  me: async (): Promise<AuthUser> => {
    const raw = await api.get<{ employee: AuthUser }>('/auth/me');
    return raw.employee;
  },

  forgotPassword: (email: string) =>
    api.post<null>('/auth/forgot-password', { email }),
};
