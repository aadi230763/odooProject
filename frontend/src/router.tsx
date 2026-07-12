/**
 * Application Router
 *
 * Route guards:
 *  - <RequireAuth>      — redirects unauthenticated users to /login
 *  - <RequireRole>      — redirects users without the required role to /dashboard
 *  - <RedirectIfAuthed> — redirects already-logged-in users away from auth pages
 *
 * While the auth context is loading (restoring session from localStorage),
 * a full-screen spinner is shown to avoid a flash of the wrong page.
 */

import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { useAuth, type UserRole } from './context/AuthContext';
import { AppShell } from './components/layout/AppShell';
import { Spinner } from './components/ui';

// Pages
import { LoginPage } from './pages/auth/LoginPage';
import { SignupPage } from './pages/auth/SignupPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { OrgSetupPage } from './pages/org/OrgSetupPage';
import { AssetDirectoryPage } from './pages/assets/AssetDirectoryPage';
import { AssetRegistrationPage } from './pages/assets/AssetRegistrationPage';
import { AssetDetailsPage } from './pages/assets/AssetDetailsPage';
import { NotFoundPage } from './pages/NotFoundPage';

// ── Placeholder for future-phase pages ────────────────────────────────────────

function ComingSoon({ name }: { name: string }) {
  return (
    <div style={{ padding: 'var(--sp-8)', textAlign: 'center', color: 'var(--text-muted)' }}>
      <div style={{ fontSize: '3rem', marginBottom: 'var(--sp-4)' }}>🚧</div>
      <h2 style={{ fontSize: 'var(--text-xl)', color: 'var(--text-primary)', marginBottom: 'var(--sp-2)' }}>
        {name}
      </h2>
      <p style={{ fontSize: 'var(--text-sm)' }}>This module is coming in a future phase.</p>
    </div>
  );
}

// ── Guards ────────────────────────────────────────────────────────────────────

/** Show spinner while session is being restored, then render children */
function AuthGate({ children }: { children: React.ReactNode }) {
  const { isLoading } = useAuth();
  if (isLoading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
        }}
        aria-label="Loading…"
      >
        <Spinner size="lg" label="Restoring session…" />
      </div>
    );
  }
  return <>{children}</>;
}

/** Redirect unauthenticated visitors to /login */
function RequireAuth() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}

/** Redirect authenticated users away from auth pages */
function RedirectIfAuthed() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : <Outlet />;
}

/** Redirect users who lack the required role */
function RequireRole({ roles }: { roles: UserRole[] }) {
  const { hasRole, isLoading } = useAuth();
  if (isLoading) return null;
  return roles.some((r) => hasRole(r)) ? <Outlet /> : <Navigate to="/dashboard" replace />;
}

// ── Router ────────────────────────────────────────────────────────────────────

export function AppRouter() {
  return (
    <AuthGate>
      <Routes>
        {/* Default redirect */}
        <Route index element={<Navigate to="/dashboard" replace />} />

        {/* Auth pages — redirect if already logged in */}
        <Route element={<RedirectIfAuthed />}>
          <Route path="login" element={<LoginPage />} />
          <Route path="signup" element={<SignupPage />} />
          <Route path="forgot-password" element={<ForgotPasswordPage />} />
        </Route>

        {/* Authenticated pages — app shell */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route path="dashboard" element={<DashboardPage />} />

            {/* Asset modules (Phase 5+) */}
            <Route path="assets" element={<AssetDirectoryPage />} />
            <Route element={<RequireRole roles={['admin', 'asset_manager']} />}>
              <Route path="assets/new" element={<AssetRegistrationPage />} />
            </Route>
            <Route path="assets/:id" element={<AssetDetailsPage />} />

            {/* Allocation (Phase 6) */}
            <Route path="allocations" element={<ComingSoon name="Allocations" />} />

            {/* Booking (Phase 7) */}
            <Route path="bookings" element={<ComingSoon name="Resource Booking" />} />

            {/* Maintenance (Phase 8) */}
            <Route path="maintenance" element={<ComingSoon name="Maintenance" />} />

            {/* Audits (Phase 9) */}
            <Route path="audits" element={<ComingSoon name="Audit Cycles" />} />

            {/* Admin-only routes */}
            <Route element={<RequireRole roles={['admin']} />}>
              <Route path="org" element={<OrgSetupPage />} />
            </Route>

            {/* Admin + Asset Manager */}
            <Route element={<RequireRole roles={['admin', 'asset_manager']} />}>
              <Route path="logs" element={<ComingSoon name="Activity Logs" />} />
            </Route>

            {/* Notifications (Phase 10) */}
            <Route path="notifications" element={<ComingSoon name="Notifications" />} />
          </Route>
        </Route>

        {/* 404 */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </AuthGate>
  );
}
