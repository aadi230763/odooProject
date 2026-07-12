/**
 * Dashboard page — Phase 3 skeleton.
 *
 * Shows live KPI cards pulled from the backend health check and a
 * placeholder grid. Real data arrives in Phase 10.  The shell layout,
 * role-aware greeting, and KPI card structure are established here so
 * later phases slot data in without touching the design.
 */

import { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PageHeader, Spinner } from '../../components/ui';

interface KpiCard {
  id: string;
  label: string;
  value: string | number;
  icon: string;
  variant?: 'default' | 'warning' | 'danger' | 'success';
}

const PLACEHOLDER_KPIS: KpiCard[] = [
  { id: 'assets-available', label: 'Assets Available', value: '—', icon: '📦' },
  { id: 'assets-allocated', label: 'Allocated', value: '—', icon: '🔗' },
  { id: 'maintenance-today', label: 'Under Maintenance', value: '—', icon: '🔧' },
  { id: 'active-bookings', label: 'Active Bookings', value: '—', icon: '📅' },
  { id: 'pending-transfers', label: 'Pending Transfers', value: '—', icon: '🔄', variant: 'warning' },
  { id: 'overdue-returns', label: 'Overdue Returns', value: '—', icon: '⚠️', variant: 'danger' },
];

const ROLE_GREETING: Record<string, string> = {
  admin: 'Administrator',
  asset_manager: 'Asset Manager',
  department_head: 'Department Head',
  employee: 'team member',
};

function getTimeGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardPage() {
  const { user } = useAuth();
  const [backendOk, setBackendOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/health')
      .then((r) => r.json())
      .then((b) => setBackendOk(b?.data?.status === 'ok'))
      .catch(() => setBackendOk(false));
  }, []);

  const greeting = `${getTimeGreeting()}, ${user?.name?.split(' ')[0] ?? 'there'}`;
  const subtitle = user
    ? `You're signed in as ${ROLE_GREETING[user.role] ?? 'Employee'} · Real-time data available in Phase 10`
    : 'Welcome to AssetFlow';

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={subtitle}
        actions={
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp-2)' }}>
            {backendOk === null ? (
              <Spinner size="sm" label="Checking backend" />
            ) : (
              <span
                id="backend-status"
                className={`badge badge--${backendOk ? 'success' : 'danger'}`}
              >
                {backendOk ? '● API connected' : '● API unreachable'}
              </span>
            )}
          </div>
        }
      />

      {/* KPI Cards */}
      <section aria-label="Key performance indicators">
        <div className="kpi-grid">
          {PLACEHOLDER_KPIS.map((kpi) => (
            <div
              key={kpi.id}
              id={kpi.id}
              className="kpi-card"
              style={
                kpi.variant === 'warning'
                  ? { borderColor: 'rgba(245,158,11,0.22)' }
                  : kpi.variant === 'danger'
                    ? { borderColor: 'rgba(239,68,68,0.22)' }
                    : undefined
              }
            >
              <div className="kpi-icon" aria-hidden="true">
                {kpi.icon}
              </div>
              <p className="kpi-label">{kpi.label}</p>
              <p
                className="kpi-value"
                style={
                  kpi.variant === 'warning'
                    ? { color: 'var(--warning)' }
                    : kpi.variant === 'danger'
                      ? { color: 'var(--danger)' }
                      : undefined
                }
              >
                {kpi.value}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Quick actions placeholder */}
      <section
        aria-label="Quick actions"
        style={{ marginTop: 'var(--sp-8)' }}
      >
        <h2
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--text-muted)',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            marginBottom: 'var(--sp-4)',
          }}
        >
          Quick Actions
        </h2>
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
          {[
            { label: 'Register Asset', icon: '＋', id: 'quick-register-asset' },
            { label: 'Book Resource', icon: '📅', id: 'quick-book-resource' },
            { label: 'Raise Maintenance', icon: '🔧', id: 'quick-raise-maintenance' },
          ].map((action) => (
            <button
              key={action.id}
              id={action.id}
              className="btn btn--secondary btn--md"
              disabled
              title="Available in a future phase"
            >
              <span aria-hidden="true">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
        <p
          style={{
            marginTop: 'var(--sp-3)',
            fontSize: 'var(--text-xs)',
            color: 'var(--text-muted)',
          }}
        >
          Quick actions will be enabled as each module is implemented (Phases 5–9).
        </p>
      </section>
    </>
  );
}
