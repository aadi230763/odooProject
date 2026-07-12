/* eslint-disable react-refresh/only-export-components */
/**
 * AuthContext
 *
 * Provides the authenticated user (decoded JWT payload) and helpers for
 * login / logout throughout the app.  Token is persisted in localStorage
 * and decoded on mount so a hard-refresh restores the session immediately
 * without a round-trip.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type UserRole = 'admin' | 'asset_manager' | 'department_head' | 'employee';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department_id: string | null;
}

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  /** Call after a successful login API response */
  setSession: (user: AuthUser, token: string) => void;
  /** Clears session (logout) */
  clearSession: () => void;
  /** True if the current user has *any* of the listed roles */
  hasRole: (...roles: UserRole[]) => boolean;
}

// ── Context ────────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

const TOKEN_KEY = 'af_token';
const USER_KEY = 'af_user';

// ── Helpers ────────────────────────────────────────────────────────────────────

function isTokenExpired(token: string): boolean {
  try {
    const [, payload] = token.split('.');
    const { exp } = JSON.parse(atob(payload));
    return Date.now() >= exp * 1000;
  } catch {
    return true;
  }
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Restore session on mount
  useEffect(() => {
    const storedToken = localStorage.getItem(TOKEN_KEY);
    const storedUser = localStorage.getItem(USER_KEY);

    if (storedToken && storedUser && !isTokenExpired(storedToken)) {
      try {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
      } catch {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
      }
    }
    setIsLoading(false);
  }, []);

  const setSession = useCallback((newUser: AuthUser, newToken: string) => {
    setUser(newUser);
    setToken(newToken);
    localStorage.setItem(TOKEN_KEY, newToken);
    localStorage.setItem(USER_KEY, JSON.stringify(newUser));
  }, []);

  const clearSession = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => !!user && roles.includes(user.role),
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: !!user && !!token,
      isLoading,
      setSession,
      clearSession,
      hasRole,
    }),
    [user, token, isLoading, setSession, clearSession, hasRole],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ── Hook ───────────────────────────────────────────────────────────────────────

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within <AuthProvider>');
  return ctx;
}
