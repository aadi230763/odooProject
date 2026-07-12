/**
 * API Client
 *
 * A thin, typed wrapper around fetch that:
 *  - Always sends to /api/* (Vite proxy → Flask in dev)
 *  - Attaches the JWT from localStorage as Bearer auth
 *  - Unwraps the standard envelope  { success, data, message, error }
 *  - Throws a typed ApiError on failure so callers never get raw JSON
 */

// ── Types ──────────────────────────────────────────────────────────────────────

/** Shape of every API response from the Flask backend */
interface ApiEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message?: string;
    fields?: Record<string, string>;
  };
}

/** Thrown when the backend returns success=false or the network fails */
export class ApiError extends Error {
  code: string;
  fields?: Record<string, string>;
  status: number;

  constructor(
    message: string,
    code: string,
    status: number,
    fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.fields = fields;
  }
}

const TOKEN_KEY = 'af_token';

function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

// ── Core request ───────────────────────────────────────────────────────────────

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  const token = getToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(
      'Network error — backend unreachable.',
      'NETWORK_ERROR',
      0,
    );
  }

  // Parse JSON (backend always returns JSON)
  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await response.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      `Unexpected response from server (${response.status}).`,
      'PARSE_ERROR',
      response.status,
    );
  }

  if (!envelope.success) {
    const err = envelope.error;
    throw new ApiError(
      err?.message ?? envelope.message ?? 'An unknown error occurred.',
      err?.code ?? 'UNKNOWN_ERROR',
      response.status,
      err?.fields,
    );
  }

  return envelope.data as T;
}

// ── Convenience wrappers ───────────────────────────────────────────────────────

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
