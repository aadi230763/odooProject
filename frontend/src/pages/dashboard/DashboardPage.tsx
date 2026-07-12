import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { dashboardApi, type DashboardKpis, type OverdueAllocation } from '../../api/dashboard';
import { PageHeader, Spinner, Badge } from '../../components/ui';
import { useToast } from '../../hooks/useToast';

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrator',
  asset_manager: 'Asset Manager',
  department_head: 'Department Head',
  employee: 'Team Member',
};

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

// ── KPI card ──────────────────────────────────────────────────────────────────

interface KpiCardProps {
  label: string;
  value: number | string;
  icon: string;
  variant?: 'default' | 'warning' | 'danger' | 'success' | 'info';
  onClick?: () => void;
}

function KpiCard({ label, value, icon, variant = 'default', onClick }: KpiCardProps) {
  const borderColor =
    variant === 'danger' ? 'rgba(239,68,68,0.25)'
    : variant === 'warning' ? 'rgba(245,158,11,0.25)'
    : variant === 'success' ? 'rgba(34,197,94,0.25)'
    : variant === 'info' ? 'rgba(59,130,246,0.25)'
    : undefined;
  const valueColor =
    variant === 'danger' ? 'var(--danger)'
    : variant === 'warning' ? 'var(--warning)'
    : variant === 'success' ? 'var(--success, #22c55e)'
    : variant === 'info' ? 'var(--primary)'
    : 'var(--text-primary)';

  return (
    <div
      className="kpi-card"
      style={{ borderColor, cursor: onClick ? 'pointer' : undefined }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
    >
      <div className="kpi-icon" aria-hidden="true">{icon}</div>
      <p className="kpi-label">{label}</p>
      <p className="kpi-value" style={{ color: valueColor }}>{value}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();

  const [kpis, setKpis] = useState<DashboardKpis | null>(null);
  const [overdue, setOverdue] = useState<OverdueAllocation[]>([]);
  const [upcoming, setUpcoming] = useState<OverdueAllocation[]>([]);
  const [loading, setLoading] = useState(true);

  const isManager = user?.role === 'admin' || user?.role === 'asset_manager';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await dashboardApi.getKpis();
      setKpis(res.kpis);
      setOverdue(res.overdue_allocations);
      setUpcoming(res.upcoming_returns);
    } catch {
      toast.error('Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const greeting = `${getGreeting()}, ${user?.name?.split(' ')[0] ?? 'there'}`;

  return (
    <>
      <PageHeader
        title={greeting}
        subtitle={`${ROLE_LABEL[user?.role ?? 'employee']} · AssetFlow`}
        actions={
          <button className="btn btn--ghost btn--sm" onClick={loadData} title="Refresh">
            ↻ Refresh
          </button>
        }
      />

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--sp-12)' }}>
          <Spinner size="lg" label="Loading dashboard…" />
        </div>
      ) : (
        <>
          {/* ── KPI Grid ─────────────────────────────────────────────────── */}
          <section aria-label="Key performance indicators">
            <div className="kpi-grid">
              <KpiCard
                label="Assets Available"
                value={kpis?.assets_available ?? 0}
                icon="📦"
                variant="success"
                onClick={() => navigate('/assets?status=available')}
              />
              <KpiCard
                label="Allocated"
                value={kpis?.assets_allocated ?? 0}
                icon="🔗"
                variant="info"
                onClick={() => navigate('/allocations')}
              />
              <KpiCard
                label="Under Maintenance"
                value={kpis?.assets_maintenance ?? 0}
                icon="🔧"
                variant="warning"
                onClick={() => navigate('/maintenance')}
              />
              <KpiCard
                label="Active Bookings"
                value={kpis?.active_bookings ?? 0}
                icon="📅"
                onClick={() => navigate('/bookings')}
              />
              <KpiCard
                label="Pending Transfers"
                value={kpis?.pending_transfers ?? 0}
                icon="🔄"
                variant={kpis && kpis.pending_transfers > 0 ? 'warning' : 'default'}
                onClick={() => navigate('/allocations')}
              />
              <KpiCard
                label="Overdue Returns"
                value={kpis?.overdue_allocations ?? 0}
                icon="⚠️"
                variant={kpis && kpis.overdue_allocations > 0 ? 'danger' : 'default'}
                onClick={() => navigate('/allocations')}
              />
              {isManager && (
                <>
                  <KpiCard
                    label="Pending Maintenance"
                    value={kpis?.pending_maintenance ?? 0}
                    icon="🛠️"
                    variant={kpis && kpis.pending_maintenance > 0 ? 'warning' : 'default'}
                    onClick={() => navigate('/maintenance')}
                  />
                  <KpiCard
                    label="Total Active Assets"
                    value={kpis?.assets_total ?? 0}
                    icon="🗃️"
                    onClick={() => navigate('/assets')}
                  />
                </>
              )}
            </div>
          </section>

          {/* ── Quick Actions ─────────────────────────────────────────────── */}
          <section aria-label="Quick actions" style={{ marginTop: 'var(--sp-8)' }}>
            <h2 style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--text-muted)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              marginBottom: 'var(--sp-4)',
            }}>
              Quick Actions
            </h2>
            <div style={{ display: 'flex', gap: 'var(--sp-3)', flexWrap: 'wrap' }}>
              {isManager && (
                <button className="btn btn--secondary btn--md" onClick={() => navigate('/assets/new')}>
                  ＋ Register Asset
                </button>
              )}
              <button className="btn btn--secondary btn--md" onClick={() => navigate('/bookings')}>
                📅 Book Resource
              </button>
              <button className="btn btn--secondary btn--md" onClick={() => navigate('/maintenance')}>
                🔧 Raise Maintenance
              </button>
              <button className="btn btn--secondary btn--md" onClick={() => navigate('/audits')}>
                📋 View Audits
              </button>
            </div>
          </section>

          {/* ── Overdue + Upcoming Returns ───────────────────────────────── */}
          {(overdue.length > 0 || upcoming.length > 0) && (
            <section style={{ marginTop: 'var(--sp-8)', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-6)' }}>
              {overdue.length > 0 && (
                <div className="card">
                  <h3 style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--danger)',
                    marginBottom: 'var(--sp-3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                  }}>
                    ⚠️ Overdue Returns
                    <Badge variant="danger">{overdue.length}</Badge>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    {overdue.map(a => (
                      <ReturnRow key={a.id} alloc={a} variant="danger" onClick={() => navigate(`/assets/${a.asset_id}`)} />
                    ))}
                  </div>
                </div>
              )}

              {upcoming.length > 0 && (
                <div className="card">
                  <h3 style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--warning)',
                    marginBottom: 'var(--sp-3)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--sp-2)',
                  }}>
                    📅 Due Within 7 Days
                    <Badge variant="warning">{upcoming.length}</Badge>
                  </h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
                    {upcoming.map(a => (
                      <ReturnRow key={a.id} alloc={a} variant="warning" onClick={() => navigate(`/assets/${a.asset_id}`)} />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </>
      )}
    </>
  );
}

function ReturnRow({
  alloc,
  variant,
  onClick,
}: {
  alloc: OverdueAllocation;
  variant: 'danger' | 'warning';
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 'var(--sp-2) var(--sp-3)',
        borderRadius: 'var(--radius-md)',
        background: variant === 'danger' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
        cursor: 'pointer',
        fontSize: 'var(--text-sm)',
      }}
    >
      <div>
        <span style={{ fontWeight: 'var(--fw-medium)', color: 'var(--primary)' }}>
          {alloc.asset_tag}
        </span>
        <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--sp-2)', fontSize: 'var(--text-xs)' }}>
          {alloc.holder_name}
        </span>
      </div>
      {alloc.expected_return_date && (
        <span style={{
          fontSize: 'var(--text-xs)',
          color: variant === 'danger' ? 'var(--danger)' : 'var(--warning)',
          fontWeight: 'var(--fw-medium)',
        }}>
          {fmtDate(alloc.expected_return_date)}
        </span>
      )}
    </div>
  );
}
