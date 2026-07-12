import { useCallback, useEffect, useState } from 'react';
import { activityLogsApi, type ActivityLog } from '../../api/dashboard';
import { Badge, Button, Input, Select, PageHeader, Spinner, Table } from '../../components/ui';
import { useToast } from '../../hooks/useToast';

const ACTION_BADGE: Record<string, 'success' | 'danger' | 'warning' | 'info' | 'primary' | 'muted'> = {
  // create / positive
  asset_created: 'success',
  asset_allocated: 'success',
  booking_created: 'success',
  maintenance_approved: 'success',
  maintenance_resolved: 'success',
  audit_cycle_created: 'success',
  transfer_approved: 'success',
  user_signup: 'success',
  user_created: 'success',
  // delete / negative
  maintenance_rejected: 'danger',
  transfer_rejected: 'danger',
  audit_cycle_closed: 'muted',
  // neutral / workflow
  maintenance_raised: 'info',
  booking_cancelled: 'warning',
  asset_updated: 'info',
  transfer_requested: 'info',
  maintenance_technician_assigned: 'info',
  maintenance_in_progress: 'primary',
  audit_auditors_assigned: 'info',
  audit_item_marked: 'info',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function actionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const ENTITY_TYPES = [
  'allocation', 'asset', 'audit_cycle', 'audit_item',
  'booking', 'employee', 'maintenance_request', 'transfer_request',
];

const PAGE_SIZE = 25;

export function ActivityLogsPage() {
  const toast = useToast();

  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);

  // Filters
  const [entityType, setEntityType] = useState('');
  const [actionFilter, setActionFilter] = useState('');

  const loadLogs = useCallback(async (off = 0) => {
    setLoading(true);
    try {
      const res = await activityLogsApi.list({
        entity_type: entityType || undefined,
        action: actionFilter || undefined,
        limit: PAGE_SIZE,
        offset: off,
      });
      setLogs(res.activity_logs);
      setTotal(res.total);
      setOffset(off);
    } catch {
      toast.error('Failed to load activity logs.');
    } finally {
      setLoading(false);
    }
  }, [entityType, actionFilter, toast]);

  useEffect(() => { loadLogs(0); }, [loadLogs]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <>
      <PageHeader
        title="Activity Logs"
        subtitle="Complete audit trail of every state-changing action in AssetFlow."
      />

      {/* Filters */}
      <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div style={{ minWidth: '200px' }}>
          <Select
            id="log-entity"
            label="Entity Type"
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            options={[
              { value: '', label: 'All Entities' },
              ...ENTITY_TYPES.map(t => ({ value: t, label: t.replace(/_/g, ' ') })),
            ]}
          />
        </div>
        <div style={{ minWidth: '200px' }}>
          <Input
            id="log-action"
            label="Filter by Action"
            placeholder="e.g. maintenance_approved"
            value={actionFilter}
            onChange={e => setActionFilter(e.target.value)}
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => { setEntityType(''); setActionFilter(''); }}>
          Clear
        </Button>
      </div>

      {/* Count + Pagination info */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
        <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
          {loading ? <Spinner size="xs" label="Loading" /> : `${total} log${total !== 1 ? 's' : ''} · page ${currentPage} of ${Math.max(1, totalPages)}`}
        </span>
        <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadLogs(offset - PAGE_SIZE)}
            disabled={offset === 0 || loading}
          >
            ← Prev
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => loadLogs(offset + PAGE_SIZE)}
            disabled={offset + PAGE_SIZE >= total || loading}
          >
            Next →
          </Button>
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={l => String(l.id)}
          data={logs}
          empty="No activity logs found."
          columns={[
            {
              key: 'time',
              header: 'Time',
              width: '160px',
              render: l => (
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                  {fmt(l.created_at)}
                </span>
              ),
            },
            {
              key: 'actor',
              header: 'Actor',
              width: '140px',
              render: l => (
                <span style={{ fontSize: 'var(--text-sm)', fontWeight: 'var(--fw-medium)' }}>
                  {l.actor_name}
                </span>
              ),
            },
            {
              key: 'action',
              header: 'Action',
              render: l => (
                <Badge variant={ACTION_BADGE[l.action] ?? 'muted'}>
                  {actionLabel(l.action)}
                </Badge>
              ),
            },
            {
              key: 'entity',
              header: 'Entity',
              render: l => (
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>
                    {l.entity_type.replace(/_/g, ' ')}
                  </span>
                  {l.entity_id && (
                    <span style={{ color: 'var(--text-muted)', marginLeft: 'var(--sp-1)' }}>
                      #{l.entity_id}
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'meta',
              header: 'Details',
              render: l => {
                if (!l.metadata) return null;
                const entries = Object.entries(l.metadata).slice(0, 3);
                return (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                    {entries.map(([k, v]) => (
                      <span key={k} style={{ marginRight: 'var(--sp-3)' }}>
                        <strong>{k}:</strong> {String(v)}
                      </span>
                    ))}
                  </div>
                );
              },
            },
          ]}
        />
      </div>
    </>
  );
}
