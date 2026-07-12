import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  maintenanceApi,
  type MaintenanceRequest,
  type MaintenancePriority,
  type MaintenanceStatus,
} from '../../api/maintenance';
import { assetsApi, type Asset } from '../../api/assets';
import { employeesApi, type OrgEmployee } from '../../api/org';
import { ApiError } from '../../api/client';
import {
  Badge,
  Button,
  Select,
  Spinner,
  Table,
  PageHeader,
  Modal,
} from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────────

const PRIORITY_BADGE: Record<
  MaintenancePriority,
  'danger' | 'warning' | 'info' | 'muted'
> = {
  critical: 'danger',
  high: 'warning',
  medium: 'info',
  low: 'muted',
};

const STATUS_BADGE: Record<
  MaintenanceStatus,
  'muted' | 'primary' | 'danger' | 'warning' | 'info' | 'success'
> = {
  pending: 'warning',
  approved: 'info',
  rejected: 'danger',
  technician_assigned: 'primary',
  in_progress: 'primary',
  resolved: 'success',
};

const STATUS_LABEL: Record<MaintenanceStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  technician_assigned: 'Tech Assigned',
  in_progress: 'In Progress',
  resolved: 'Resolved',
};

function fmt(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function MaintenancePage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'asset_manager';

  // ── List ───────────────────────────────────────────────────────────────────
  const [requests, setRequests] = useState<MaintenanceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // ── Detail / action modal ──────────────────────────────────────────────────
  const [selected, setSelected] = useState<MaintenanceRequest | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // ── Raise modal ────────────────────────────────────────────────────────────
  const [showRaise, setShowRaise] = useState(false);
  const [raiseForm, setRaiseForm] = useState({
    asset_id: '',
    description: '',
    priority: 'medium' as MaintenancePriority,
  });
  const [raisePhoto, setRaisePhoto] = useState<File | null>(null);
  const [raiseSaving, setRaiseSaving] = useState(false);
  const [assets, setAssets] = useState<Asset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // ── Assign technician modal ────────────────────────────────────────────────
  const [showAssign, setShowAssign] = useState(false);
  const [techId, setTechId] = useState('');
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [assignLoading, setAssignLoading] = useState(false);

  // ── Data loading ───────────────────────────────────────────────────────────

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await maintenanceApi.list({
        status: statusFilter || undefined,
        priority: priorityFilter || undefined,
      });
      setRequests(res.maintenance_requests);
    } catch {
      toast.error('Failed to load maintenance requests.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, priorityFilter, toast]);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  // ── Open raise modal ───────────────────────────────────────────────────────

  const openRaise = async () => {
    try {
      const res = await assetsApi.list();
      setAssets(res.assets);
    } catch {
      toast.error('Failed to load assets.');
      return;
    }
    setRaiseForm({ asset_id: '', description: '', priority: 'medium' });
    setRaisePhoto(null);
    setShowRaise(true);
  };

  const handleRaise = async () => {
    if (!raiseForm.asset_id || !raiseForm.description) {
      toast.error('Asset and description are required.');
      return;
    }
    setRaiseSaving(true);
    try {
      await maintenanceApi.raise(
        {
          asset_id: Number(raiseForm.asset_id),
          description: raiseForm.description,
          priority: raiseForm.priority,
        },
        raisePhoto ?? undefined,
      );
      toast.success('Maintenance request raised.');
      setShowRaise(false);
      loadRequests();
    } catch (err) {
      toast.error(
        'Failed to raise request.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setRaiseSaving(false);
    }
  };

  // ── Open detail ────────────────────────────────────────────────────────────

  const openDetail = async (req: MaintenanceRequest) => {
    setSelected(req);
    setShowDetail(true);
  };

  const refreshSelected = async (id: number) => {
    try {
      const res = await maintenanceApi.get(id);
      setSelected(res.maintenance_request);
      // Also update in list
      setRequests((prev) =>
        prev.map((r) => (r.id === id ? res.maintenance_request : r)),
      );
    } catch {
      /* ignore */
    }
  };

  // ── Approve / Reject ───────────────────────────────────────────────────────

  const handleApprove = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await maintenanceApi.approve(selected.id);
      toast.success('Request approved. Asset is now Under Maintenance.');
      await refreshSelected(selected.id);
      loadRequests();
    } catch (err) {
      toast.error(
        'Approval failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await maintenanceApi.reject(selected.id);
      toast.success('Request rejected.');
      await refreshSelected(selected.id);
      loadRequests();
    } catch (err) {
      toast.error(
        'Rejection failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ── Assign technician ──────────────────────────────────────────────────────

  const openAssign = async () => {
    try {
      const res = await employeesApi.list({ status: 'active' });
      setEmployees(res.employees);
    } catch {
      toast.error('Failed to load employees.');
      return;
    }
    setTechId('');
    setShowAssign(true);
  };

  const handleAssign = async () => {
    if (!selected || !techId) {
      toast.error('Please select a technician.');
      return;
    }
    setAssignLoading(true);
    try {
      await maintenanceApi.assignTechnician(selected.id, Number(techId));
      toast.success('Technician assigned.');
      setShowAssign(false);
      await refreshSelected(selected.id);
      loadRequests();
    } catch (err) {
      toast.error(
        'Assignment failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setAssignLoading(false);
    }
  };

  // ── Start / Resolve ────────────────────────────────────────────────────────

  const handleStart = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await maintenanceApi.startProgress(selected.id);
      toast.success('Maintenance marked as in progress.');
      await refreshSelected(selected.id);
      loadRequests();
    } catch (err) {
      toast.error('Failed.', err instanceof ApiError ? err.message : undefined);
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolve = async () => {
    if (!selected) return;
    setActionLoading(true);
    try {
      await maintenanceApi.resolve(selected.id);
      toast.success('Resolved! Asset is now available.');
      await refreshSelected(selected.id);
      loadRequests();
    } catch (err) {
      toast.error(
        'Resolution failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setActionLoading(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Maintenance"
        subtitle="Track and manage asset repair requests through the approval workflow."
        actions={
          <Button variant="primary" onClick={openRaise}>
            + Raise Request
          </Button>
        }
      />

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-4)',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ minWidth: '180px' }}>
          <Select
            id="status-filter"
            label="Filter by Status"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            options={[
              { value: '', label: 'All Statuses' },
              { value: 'pending', label: 'Pending' },
              { value: 'approved', label: 'Approved' },
              { value: 'rejected', label: 'Rejected' },
              { value: 'technician_assigned', label: 'Tech Assigned' },
              { value: 'in_progress', label: 'In Progress' },
              { value: 'resolved', label: 'Resolved' },
            ]}
          />
        </div>
        <div style={{ minWidth: '160px' }}>
          <Select
            id="priority-filter"
            label="Filter by Priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            options={[
              { value: '', label: 'All Priorities' },
              { value: 'critical', label: 'Critical' },
              { value: 'high', label: 'High' },
              { value: 'medium', label: 'Medium' },
              { value: 'low', label: 'Low' },
            ]}
          />
        </div>
      </div>

      <div
        style={{
          marginBottom: 'var(--sp-3)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        {loading ? (
          <Spinner size="xs" label="Loading" />
        ) : (
          `${requests.length} request${requests.length !== 1 ? 's' : ''}`
        )}
      </div>

      {/* Table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={(r) => String(r.id)}
          data={requests}
          empty="No maintenance requests found."
          columns={[
            {
              key: 'asset',
              header: 'Asset',
              render: (r) => (
                <div>
                  <strong
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => navigate(`/assets/${r.asset_id}`)}
                  >
                    {r.asset_tag}
                  </strong>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {r.asset_name}
                  </div>
                </div>
              ),
            },
            {
              key: 'raised',
              header: 'Raised By',
              render: (r) => (
                <div>
                  <div>{r.raised_by_name}</div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {fmt(r.created_at)}
                  </div>
                </div>
              ),
            },
            {
              key: 'description',
              header: 'Issue',
              render: (r) => (
                <span
                  style={{
                    maxWidth: '260px',
                    display: 'block',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                  title={r.description}
                >
                  {r.description}
                </span>
              ),
            },
            {
              key: 'priority',
              header: 'Priority',
              render: (r) => (
                <Badge variant={PRIORITY_BADGE[r.priority]}>{r.priority}</Badge>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (r) => (
                <Badge variant={STATUS_BADGE[r.status]}>
                  {STATUS_LABEL[r.status]}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              width: '90px',
              render: (r) => (
                <Button variant="ghost" size="sm" onClick={() => openDetail(r)}>
                  View
                </Button>
              ),
            },
          ]}
        />
      </div>

      {/* ── Raise Modal ─────────────────────────────────────────────────────── */}
      <Modal
        open={showRaise}
        onClose={() => setShowRaise(false)}
        title="Raise Maintenance Request"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRaise(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={raiseSaving}
              onClick={handleRaise}
            >
              Submit Request
            </Button>
          </>
        }
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--sp-4)',
          }}
        >
          <Select
            id="raise-asset"
            label="Asset"
            required
            value={raiseForm.asset_id}
            onChange={(e) =>
              setRaiseForm({ ...raiseForm, asset_id: e.target.value })
            }
            options={[
              { value: '', label: 'Select an asset...' },
              ...assets.map((a) => ({
                value: String(a.id),
                label: `${a.asset_tag} — ${a.name}`,
              })),
            ]}
          />
          <div>
            <label
              htmlFor="raise-desc"
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--sp-1)',
              }}
            >
              Description <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <textarea
              id="raise-desc"
              rows={4}
              style={{
                width: '100%',
                padding: 'var(--sp-2) var(--sp-3)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                color: 'var(--text-primary)',
                fontSize: 'var(--text-sm)',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
              placeholder="Describe the issue in detail (min. 10 characters)…"
              value={raiseForm.description}
              onChange={(e) =>
                setRaiseForm({ ...raiseForm, description: e.target.value })
              }
            />
          </div>
          <Select
            id="raise-priority"
            label="Priority"
            value={raiseForm.priority}
            onChange={(e) =>
              setRaiseForm({
                ...raiseForm,
                priority: e.target.value as MaintenancePriority,
              })
            }
            options={[
              { value: 'low', label: 'Low' },
              { value: 'medium', label: 'Medium' },
              { value: 'high', label: 'High' },
              { value: 'critical', label: 'Critical' },
            ]}
          />
          {/* Photo upload */}
          <div>
            <label
              style={{
                display: 'block',
                fontSize: 'var(--text-sm)',
                fontWeight: 'var(--fw-medium)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--sp-1)',
              }}
            >
              Photo (optional)
            </label>
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/jpg"
              style={{ display: 'none' }}
              onChange={(e) => setRaisePhoto(e.target.files?.[0] ?? null)}
            />
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-3)',
              }}
            >
              <Button
                variant="secondary"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                {raisePhoto ? 'Change Photo' : 'Attach Photo'}
              </Button>
              {raisePhoto && (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-muted)',
                  }}
                >
                  {raisePhoto.name}
                </span>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* ── Detail / Workflow Modal ──────────────────────────────────────────── */}
      {selected && (
        <Modal
          open={showDetail}
          onClose={() => setShowDetail(false)}
          title={`Maintenance Request #${selected.id}`}
          footer={
            <Button variant="secondary" onClick={() => setShowDetail(false)}>
              Close
            </Button>
          }
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-4)',
            }}
          >
            {/* Asset info */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--sp-3)',
              }}
            >
              <InfoRow
                label="Asset"
                value={
                  <span
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => {
                      navigate(`/assets/${selected.asset_id}`);
                      setShowDetail(false);
                    }}
                  >
                    {selected.asset_tag} — {selected.asset_name}
                  </span>
                }
              />
              <InfoRow
                label="Status"
                value={
                  <Badge variant={STATUS_BADGE[selected.status]}>
                    {STATUS_LABEL[selected.status]}
                  </Badge>
                }
              />
              <InfoRow
                label="Priority"
                value={
                  <Badge variant={PRIORITY_BADGE[selected.priority]}>
                    {selected.priority}
                  </Badge>
                }
              />
              <InfoRow
                label="Raised By"
                value={selected.raised_by_name ?? '—'}
              />
              <InfoRow label="Raised At" value={fmt(selected.created_at)} />
              {selected.approver_name && (
                <InfoRow label="Approver" value={selected.approver_name} />
              )}
              {selected.technician_name && (
                <InfoRow label="Technician" value={selected.technician_name} />
              )}
            </div>

            {/* Description */}
            <div>
              <p
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  marginBottom: 'var(--sp-1)',
                }}
              >
                Issue Description
              </p>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                  whiteSpace: 'pre-wrap',
                  background: 'var(--bg-surface-2)',
                  padding: 'var(--sp-3)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                {selected.description}
              </p>
            </div>

            {/* Photo */}
            {selected.photo_path && (
              <div>
                <p
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 'var(--fw-semibold)',
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    marginBottom: 'var(--sp-1)',
                  }}
                >
                  Attached Photo
                </p>
                <img
                  src={`/api/uploads/${selected.photo_path.replace('uploads/', '')}`}
                  alt="Maintenance photo"
                  style={{
                    maxWidth: '100%',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border)',
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            )}

            {/* Workflow actions */}
            <WorkflowActions
              req={selected}
              isManager={isManager}
              actionLoading={actionLoading}
              onApprove={handleApprove}
              onReject={handleReject}
              onAssignTechnician={openAssign}
              onStart={handleStart}
              onResolve={handleResolve}
            />
          </div>
        </Modal>
      )}

      {/* ── Assign Technician Modal ──────────────────────────────────────────── */}
      <Modal
        open={showAssign}
        onClose={() => setShowAssign(false)}
        title="Assign Technician"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAssign(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={assignLoading}
              onClick={handleAssign}
            >
              Assign
            </Button>
          </>
        }
      >
        <Select
          id="tech-select"
          label="Technician"
          required
          value={techId}
          onChange={(e) => setTechId(e.target.value)}
          options={[
            { value: '', label: 'Select an employee...' },
            ...employees.map((e) => ({
              value: String(e.id),
              label: `${e.name} (${e.role})`,
            })),
          ]}
        />
      </Modal>
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p
        style={{
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          marginBottom: 'var(--sp-1)',
          fontWeight: 'var(--fw-semibold)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </p>
      <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
        {value}
      </div>
    </div>
  );
}

function WorkflowActions({
  req,
  isManager,
  actionLoading,
  onApprove,
  onReject,
  onAssignTechnician,
  onStart,
  onResolve,
}: {
  req: MaintenanceRequest;
  isManager: boolean;
  actionLoading: boolean;
  onApprove: () => void;
  onReject: () => void;
  onAssignTechnician: () => void;
  onStart: () => void;
  onResolve: () => void;
}) {
  const actions: React.ReactNode[] = [];

  if (req.status === 'pending' && isManager) {
    actions.push(
      <Button
        key="approve"
        variant="primary"
        loading={actionLoading}
        onClick={onApprove}
      >
        ✓ Approve
      </Button>,
      <Button
        key="reject"
        variant="danger"
        loading={actionLoading}
        onClick={onReject}
      >
        ✕ Reject
      </Button>,
    );
  }

  if (req.status === 'approved' && isManager) {
    actions.push(
      <Button
        key="assign"
        variant="secondary"
        loading={actionLoading}
        onClick={onAssignTechnician}
      >
        Assign Technician
      </Button>,
    );
  }

  if (req.status === 'technician_assigned') {
    actions.push(
      <Button
        key="start"
        variant="primary"
        loading={actionLoading}
        onClick={onStart}
      >
        Mark In Progress
      </Button>,
    );
  }

  if (req.status === 'in_progress') {
    actions.push(
      <Button
        key="resolve"
        variant="primary"
        loading={actionLoading}
        onClick={onResolve}
      >
        ✓ Mark Resolved
      </Button>,
    );
  }

  if (actions.length === 0) return null;

  return (
    <div>
      <p
        style={{
          fontSize: 'var(--text-xs)',
          fontWeight: 'var(--fw-semibold)',
          color: 'var(--text-muted)',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: 'var(--sp-2)',
        }}
      >
        Actions
      </p>
      <div style={{ display: 'flex', gap: 'var(--sp-2)', flexWrap: 'wrap' }}>
        {actions}
      </div>
    </div>
  );
}
