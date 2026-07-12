import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  allocationsApi,
  transfersApi,
  type Allocation,
  type AllocationStatus,
  type TransferRequest,
  type TransferStatus,
} from '../../api/allocations';
import { assetsApi, type Asset } from '../../api/assets';
import { employeesApi, type OrgEmployee } from '../../api/org';
import { ApiError } from '../../api/client';
import { Badge, Button, Input, Select, Spinner, Table, PageHeader, Modal } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

const ALLOC_STATUS_BADGE: Record<AllocationStatus, 'success' | 'primary' | 'warning' | 'danger' | 'info' | 'muted'> = {
  active: 'primary',
  returned: 'success',
  overdue: 'danger',
};

const TRANSFER_STATUS_BADGE: Record<TransferStatus, 'success' | 'primary' | 'warning' | 'danger' | 'info' | 'muted'> = {
  requested: 'warning',
  approved: 'info',
  rejected: 'danger',
  completed: 'success',
};

type Tab = 'allocations' | 'transfers';

export function AllocationsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const canManage = user?.role === 'admin' || user?.role === 'asset_manager';
  const canApprove = canManage || user?.role === 'department_head';

  const [tab, setTab] = useState<Tab>('allocations');

  // ── Allocations ────────────────────────────────────────────
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [allocLoading, setAllocLoading] = useState(true);
  const [allocFilter, setAllocFilter] = useState('');

  // ── Transfers ──────────────────────────────────────────────
  const [transfers, setTransfers] = useState<TransferRequest[]>([]);
  const [transferLoading, setTransferLoading] = useState(true);
  const [transferFilter, setTransferFilter] = useState('');

  // ── Allocate Modal ─────────────────────────────────────────
  const [showAllocModal, setShowAllocModal] = useState(false);
  const [availableAssets, setAvailableAssets] = useState<Asset[]>([]);
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [allocForm, setAllocForm] = useState({
    asset_id: '',
    holder_employee_id: '',
    expected_return_date: '',
  });
  const [allocSaving, setAllocSaving] = useState(false);

  // ── Return Modal ───────────────────────────────────────────
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnAlloc, setReturnAlloc] = useState<Allocation | null>(null);
  const [returnNotes, setReturnNotes] = useState('');
  const [returnSaving, setReturnSaving] = useState(false);

  // ── Transfer Modal ─────────────────────────────────────────
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferForm, setTransferForm] = useState({ asset_id: '', to_employee_id: '' });
  const [transferSaving, setTransferSaving] = useState(false);
  const [allocatedAssets, setAllocatedAssets] = useState<Asset[]>([]);

  // ── Data Loading ───────────────────────────────────────────

  const loadAllocations = useCallback(async () => {
    setAllocLoading(true);
    try {
      const res = await allocationsApi.list({
        status: allocFilter || undefined,
      });
      setAllocations(res.allocations);
    } catch {
      toast.error('Failed to load allocations.');
    } finally {
      setAllocLoading(false);
    }
  }, [allocFilter, toast]);

  const loadTransfers = useCallback(async () => {
    setTransferLoading(true);
    try {
      const res = await transfersApi.list({
        status: transferFilter || undefined,
      });
      setTransfers(res.transfers);
    } catch {
      toast.error('Failed to load transfers.');
    } finally {
      setTransferLoading(false);
    }
  }, [transferFilter, toast]);

  useEffect(() => {
    loadAllocations();
  }, [loadAllocations]);

  useEffect(() => {
    loadTransfers();
  }, [loadTransfers]);

  // ── Modal Helpers ──────────────────────────────────────────

  const openAllocModal = async () => {
    try {
      const [assetRes, empRes] = await Promise.all([
        assetsApi.list({ status: 'available' }),
        employeesApi.list({ status: 'active' }),
      ]);
      setAvailableAssets(assetRes.assets);
      setEmployees(empRes.employees);
      setAllocForm({ asset_id: '', holder_employee_id: '', expected_return_date: '' });
      setShowAllocModal(true);
    } catch {
      toast.error('Failed to load assets or employees.');
    }
  };

  const openTransferModal = async () => {
    try {
      const [assetRes, empRes] = await Promise.all([
        assetsApi.list({ status: 'allocated' }),
        employeesApi.list({ status: 'active' }),
      ]);
      setAllocatedAssets(assetRes.assets);
      setEmployees(empRes.employees);
      setTransferForm({ asset_id: '', to_employee_id: '' });
      setShowTransferModal(true);
    } catch {
      toast.error('Failed to load data.');
    }
  };

  // ── Actions ────────────────────────────────────────────────

  const handleAllocate = async () => {
    if (!allocForm.asset_id || !allocForm.holder_employee_id) {
      toast.error('Asset and Employee are required.');
      return;
    }
    setAllocSaving(true);
    try {
      await allocationsApi.create({
        asset_id: Number(allocForm.asset_id),
        holder_employee_id: Number(allocForm.holder_employee_id),
        expected_return_date: allocForm.expected_return_date || null,
      });
      toast.success('Asset allocated successfully.');
      setShowAllocModal(false);
      loadAllocations();
    } catch (err) {
      toast.error('Allocation failed.', err instanceof ApiError ? err.message : undefined);
    } finally {
      setAllocSaving(false);
    }
  };

  const handleReturn = async () => {
    if (!returnAlloc) return;
    setReturnSaving(true);
    try {
      await allocationsApi.return(returnAlloc.id, {
        checkin_condition_notes: returnNotes.trim() || null,
      });
      toast.success('Asset returned.');
      setShowReturnModal(false);
      setReturnAlloc(null);
      setReturnNotes('');
      loadAllocations();
    } catch (err) {
      toast.error('Return failed.', err instanceof ApiError ? err.message : undefined);
    } finally {
      setReturnSaving(false);
    }
  };

  const handleCreateTransfer = async () => {
    if (!transferForm.asset_id || !transferForm.to_employee_id) {
      toast.error('Asset and target employee are required.');
      return;
    }
    setTransferSaving(true);
    try {
      await transfersApi.create({
        asset_id: Number(transferForm.asset_id),
        to_employee_id: Number(transferForm.to_employee_id),
      });
      toast.success('Transfer request submitted.');
      setShowTransferModal(false);
      loadTransfers();
    } catch (err) {
      toast.error('Transfer failed.', err instanceof ApiError ? err.message : undefined);
    } finally {
      setTransferSaving(false);
    }
  };

  const handleTransferAction = async (id: number, action: 'approve' | 'reject') => {
    try {
      await transfersApi.process(id, action);
      toast.success(`Transfer ${action}d.`);
      loadTransfers();
      loadAllocations();
    } catch (err) {
      toast.error(`Failed to ${action} transfer.`, err instanceof ApiError ? err.message : undefined);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  const tabStyle = (t: Tab): React.CSSProperties => ({
    padding: 'var(--sp-2) var(--sp-4)',
    fontSize: 'var(--text-sm)',
    fontWeight: tab === t ? 'var(--fw-semibold)' : 'var(--fw-normal)',
    color: tab === t ? 'var(--primary)' : 'var(--text-muted)',
    borderBottom: tab === t ? '2px solid var(--primary)' : '2px solid transparent',
    cursor: 'pointer',
    background: 'none',
    border: 'none',
    transition: 'all var(--t-fast)',
  });

  return (
    <>
      <PageHeader
        title="Allocations & Transfers"
        subtitle="Manage asset assignments, returns, and transfer workflows."
        actions={
          canManage ? (
            <div style={{ display: 'flex', gap: 'var(--sp-3)' }}>
              <Button variant="secondary" onClick={openTransferModal}>
                Request Transfer
              </Button>
              <Button variant="primary" onClick={openAllocModal}>
                + Allocate Asset
              </Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={openTransferModal}>
              Request Transfer
            </Button>
          )
        }
      />

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 'var(--sp-1)', borderBottom: '1px solid var(--border)', marginBottom: 'var(--sp-5)' }}>
        <button style={tabStyle('allocations')} onClick={() => setTab('allocations')}>
          Allocations
        </button>
        <button style={tabStyle('transfers')} onClick={() => setTab('transfers')}>
          Transfer Requests
        </button>
      </div>

      {tab === 'allocations' && (
        <>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', maxWidth: '250px' }}>
            <Select
              id="alloc-status-filter"
              label="Filter by Status"
              value={allocFilter}
              onChange={e => setAllocFilter(e.target.value)}
              options={[
                { value: '', label: 'All' },
                { value: 'active', label: 'Active' },
                { value: 'returned', label: 'Returned' },
                { value: 'overdue', label: 'Overdue' },
              ]}
            />
          </div>

          <div style={{ marginBottom: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {allocLoading ? <Spinner size="xs" label="Loading" /> : `${allocations.length} record${allocations.length !== 1 ? 's' : ''}`}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              loading={allocLoading}
              keyExtractor={a => String(a.id)}
              data={allocations}
              empty="No allocations found."
              columns={[
                {
                  key: 'asset', header: 'Asset', render: a => (
                    <div>
                      <strong
                        style={{ color: 'var(--primary)', cursor: 'pointer' }}
                        onClick={() => navigate(`/assets/${a.asset_id}`)}
                      >
                        {a.asset_tag}
                      </strong>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{a.asset_name}</div>
                    </div>
                  ),
                },
                {
                  key: 'holder', header: 'Holder', render: a => (
                    <span>{a.holder_employee_name || a.holder_department_name || '—'}</span>
                  ),
                },
                {
                  key: 'status', header: 'Status',
                  render: a => <Badge variant={ALLOC_STATUS_BADGE[a.status]}>{a.status}</Badge>,
                },
                {
                  key: 'expected', header: 'Expected Return',
                  render: a => <span style={{ fontSize: 'var(--text-sm)' }}>{a.expected_return_date || '—'}</span>,
                },
                {
                  key: 'allocated', header: 'Allocated On',
                  render: a => <span style={{ fontSize: 'var(--text-sm)' }}>{new Date(a.created_at).toLocaleDateString()}</span>,
                },
                ...(canManage ? [{
                  key: 'actions',
                  header: '',
                  width: '100px',
                  render: (a: Allocation) =>
                    (a.status === 'active' || a.status === 'overdue') ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setReturnAlloc(a);
                          setReturnNotes('');
                          setShowReturnModal(true);
                        }}
                      >
                        Return
                      </Button>
                    ) : null,
                }] : []),
              ]}
            />
          </div>
        </>
      )}

      {tab === 'transfers' && (
        <>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', marginBottom: 'var(--sp-4)', maxWidth: '250px' }}>
            <Select
              id="transfer-status-filter"
              label="Filter by Status"
              value={transferFilter}
              onChange={e => setTransferFilter(e.target.value)}
              options={[
                { value: '', label: 'All' },
                { value: 'requested', label: 'Requested' },
                { value: 'approved', label: 'Approved' },
                { value: 'rejected', label: 'Rejected' },
                { value: 'completed', label: 'Completed' },
              ]}
            />
          </div>

          <div style={{ marginBottom: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            {transferLoading ? <Spinner size="xs" label="Loading" /> : `${transfers.length} request${transfers.length !== 1 ? 's' : ''}`}
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <Table
              loading={transferLoading}
              keyExtractor={t => String(t.id)}
              data={transfers}
              empty="No transfer requests."
              columns={[
                {
                  key: 'asset', header: 'Asset', render: t => (
                    <div>
                      <strong
                        style={{ color: 'var(--primary)', cursor: 'pointer' }}
                        onClick={() => navigate(`/assets/${t.asset_id}`)}
                      >
                        {t.asset_tag}
                      </strong>
                      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{t.asset_name}</div>
                    </div>
                  ),
                },
                {
                  key: 'from', header: 'From',
                  render: t => <span>{t.from_employee_name || '—'}</span>,
                },
                {
                  key: 'to', header: 'To',
                  render: t => <span>{t.to_employee_name || '—'}</span>,
                },
                {
                  key: 'status', header: 'Status',
                  render: t => <Badge variant={TRANSFER_STATUS_BADGE[t.status]}>{t.status}</Badge>,
                },
                {
                  key: 'requested', header: 'Requested',
                  render: t => <span style={{ fontSize: 'var(--text-sm)' }}>{new Date(t.created_at).toLocaleDateString()}</span>,
                },
                ...(canApprove ? [{
                  key: 'actions',
                  header: '',
                  width: '160px',
                  render: (t: TransferRequest) =>
                    t.status === 'requested' ? (
                      <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                        <Button variant="primary" size="sm" onClick={() => handleTransferAction(t.id, 'approve')}>
                          Approve
                        </Button>
                        <Button variant="danger" size="sm" onClick={() => handleTransferAction(t.id, 'reject')}>
                          Reject
                        </Button>
                      </div>
                    ) : null,
                }] : []),
              ]}
            />
          </div>
        </>
      )}

      {/* ── Allocate Modal ────────────────────────────────────── */}
      <Modal
        open={showAllocModal}
        onClose={() => setShowAllocModal(false)}
        title="Allocate Asset"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowAllocModal(false)}>Cancel</Button>
            <Button variant="primary" loading={allocSaving} onClick={handleAllocate}>Allocate</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <Select
            id="alloc-asset"
            label="Asset"
            required
            value={allocForm.asset_id}
            onChange={e => setAllocForm({ ...allocForm, asset_id: e.target.value })}
            options={[
              { value: '', label: 'Select an asset...' },
              ...availableAssets.map(a => ({ value: String(a.id), label: `${a.asset_tag} — ${a.name}` })),
            ]}
          />
          <Select
            id="alloc-employee"
            label="Assign to Employee"
            required
            value={allocForm.holder_employee_id}
            onChange={e => setAllocForm({ ...allocForm, holder_employee_id: e.target.value })}
            options={[
              { value: '', label: 'Select an employee...' },
              ...employees.map(e => ({ value: String(e.id), label: `${e.name} (${e.email})` })),
            ]}
          />
          <Input
            id="alloc-return-date"
            label="Expected Return Date (optional)"
            type="date"
            value={allocForm.expected_return_date}
            onChange={e => setAllocForm({ ...allocForm, expected_return_date: e.target.value })}
          />
        </div>
      </Modal>

      {/* ── Return Modal ──────────────────────────────────────── */}
      <Modal
        open={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        title="Return Asset"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowReturnModal(false)}>Cancel</Button>
            <Button variant="primary" loading={returnSaving} onClick={handleReturn}>Confirm Return</Button>
          </>
        }
      >
        {returnAlloc && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              Returning <strong>{returnAlloc.asset_tag}</strong> ({returnAlloc.asset_name})
              from <strong>{returnAlloc.holder_employee_name || returnAlloc.holder_department_name}</strong>.
            </p>
            <Input
              id="return-notes"
              label="Condition Check-in Notes (optional)"
              value={returnNotes}
              onChange={e => setReturnNotes(e.target.value)}
            />
          </div>
        )}
      </Modal>

      {/* ── Transfer Modal ────────────────────────────────────── */}
      <Modal
        open={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        title="Request Transfer"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowTransferModal(false)}>Cancel</Button>
            <Button variant="primary" loading={transferSaving} onClick={handleCreateTransfer}>Submit Request</Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-2)' }}>
            Request a transfer of a currently-allocated asset to a different employee.
            An asset manager or department head must approve the transfer.
          </p>
          <Select
            id="transfer-asset"
            label="Asset (currently allocated)"
            required
            value={transferForm.asset_id}
            onChange={e => setTransferForm({ ...transferForm, asset_id: e.target.value })}
            options={[
              { value: '', label: 'Select an asset...' },
              ...allocatedAssets.map(a => ({ value: String(a.id), label: `${a.asset_tag} — ${a.name}` })),
            ]}
          />
          <Select
            id="transfer-to"
            label="Transfer To"
            required
            value={transferForm.to_employee_id}
            onChange={e => setTransferForm({ ...transferForm, to_employee_id: e.target.value })}
            options={[
              { value: '', label: 'Select an employee...' },
              ...employees.map(e => ({ value: String(e.id), label: `${e.name} (${e.email})` })),
            ]}
          />
        </div>
      </Modal>
    </>
  );
}
