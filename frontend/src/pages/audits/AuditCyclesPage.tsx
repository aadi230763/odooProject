import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  auditsApi,
  type AuditCycle,
  type AuditItem,
  type AuditItemResult,
} from '../../api/audits';
import {
  departmentsApi,
  employeesApi,
  type Department,
  type OrgEmployee,
} from '../../api/org';
import { ApiError } from '../../api/client';
import {
  Badge,
  Button,
  Input,
  Select,
  Spinner,
  Table,
  PageHeader,
  Modal,
} from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────────

const RESULT_BADGE: Record<
  AuditItemResult,
  'muted' | 'success' | 'danger' | 'warning'
> = {
  pending: 'muted',
  verified: 'success',
  missing: 'danger',
  damaged: 'warning',
};

const RESULT_LABEL: Record<AuditItemResult, string> = {
  pending: 'Pending',
  verified: 'Verified',
  missing: 'Missing',
  damaged: 'Damaged',
};

function fmtDate(iso: string): string {
  return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ── Progress bar ───────────────────────────────────────────────────────────────

function ProgressBar({ cycle }: { cycle: AuditCycle }) {
  const total = cycle.item_count;
  if (total === 0)
    return (
      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        No assets
      </span>
    );

  const verifiedPct = (cycle.verified_count / total) * 100;
  const missingPct = (cycle.missing_count / total) * 100;
  const damagedPct = (cycle.damaged_count / total) * 100;
  const pendingPct = (cycle.pending_count / total) * 100;

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          display: 'flex',
          height: '8px',
          borderRadius: 'var(--radius-full)',
          overflow: 'hidden',
          background: 'var(--bg-surface-2)',
        }}
      >
        <div
          style={{
            width: `${verifiedPct}%`,
            background: 'var(--success, #22c55e)',
          }}
        />
        <div
          style={{
            width: `${missingPct}%`,
            background: 'var(--danger, #ef4444)',
          }}
        />
        <div
          style={{
            width: `${damagedPct}%`,
            background: 'var(--warning, #f59e0b)',
          }}
        />
        <div style={{ width: `${pendingPct}%`, background: 'var(--border)' }} />
      </div>
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          marginTop: 'var(--sp-1)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
        }}
      >
        <span>✓ {cycle.verified_count}</span>
        <span style={{ color: 'var(--danger, #ef4444)' }}>
          ✕ {cycle.missing_count}
        </span>
        <span style={{ color: 'var(--warning, #f59e0b)' }}>
          ⚠ {cycle.damaged_count}
        </span>
        <span>· {cycle.pending_count} pending</span>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function AuditCyclesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isManager = user?.role === 'admin' || user?.role === 'asset_manager';

  // ── List ─────────────────────────────────────────────────────────────────
  const [cycles, setCycles] = useState<AuditCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // ── Create modal ─────────────────────────────────────────────────────────
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    start_date: '',
    end_date: '',
    scope_department_id: '',
    scope_location: '',
  });
  const [createSaving, setCreateSaving] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);

  // ── Detail panel ──────────────────────────────────────────────────────────
  const [selected, setSelected] = useState<AuditCycle | null>(null);
  const [showDetail, setShowDetail] = useState(false);

  // ── Auditor assign modal ──────────────────────────────────────────────────
  const [showAssign, setShowAssign] = useState(false);
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [selectedAuditorIds, setSelectedAuditorIds] = useState<Set<number>>(
    new Set(),
  );
  const [assignSaving, setAssignSaving] = useState(false);

  // ── Items / verification modal ────────────────────────────────────────────
  const [showItems, setShowItems] = useState(false);
  const [items, setItems] = useState<AuditItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState(false);
  const [markingItem, setMarkingItem] = useState<number | null>(null);
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});

  // ── Discrepancy report modal ──────────────────────────────────────────────
  const [showReport, setShowReport] = useState(false);
  const [reportItems, setReportItems] = useState<AuditItem[]>([]);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Data loading ──────────────────────────────────────────────────────────

  const loadCycles = useCallback(async () => {
    setLoading(true);
    try {
      const res = await auditsApi.list({ status: statusFilter || undefined });
      setCycles(res.audit_cycles);
    } catch {
      toast.error('Failed to load audit cycles.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadCycles();
  }, [loadCycles]);

  const refreshSelected = async (id: number) => {
    try {
      const res = await auditsApi.get(id);
      setSelected(res.audit_cycle);
      setCycles((prev) => prev.map((c) => (c.id === id ? res.audit_cycle : c)));
    } catch {
      /* ignore */
    }
  };

  // ── Create ────────────────────────────────────────────────────────────────

  const openCreate = async () => {
    try {
      const res = await departmentsApi.list();
      setDepartments(res.departments.filter((d) => d.status === 'active'));
    } catch {
      /* ignore — dept is optional */
    }
    setCreateForm({
      name: '',
      start_date: '',
      end_date: '',
      scope_department_id: '',
      scope_location: '',
    });
    setShowCreate(true);
  };

  const handleCreate = async () => {
    if (!createForm.name || !createForm.start_date || !createForm.end_date) {
      toast.error('Name, start date, and end date are required.');
      return;
    }
    setCreateSaving(true);
    try {
      await auditsApi.create({
        name: createForm.name,
        start_date: createForm.start_date,
        end_date: createForm.end_date,
        scope_department_id: createForm.scope_department_id
          ? Number(createForm.scope_department_id)
          : null,
        scope_location: createForm.scope_location || null,
      });
      toast.success('Audit cycle created.');
      setShowCreate(false);
      loadCycles();
    } catch (err) {
      toast.error(
        'Failed to create audit cycle.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setCreateSaving(false);
    }
  };

  // ── Detail ────────────────────────────────────────────────────────────────

  const openDetail = (cycle: AuditCycle) => {
    setSelected(cycle);
    setShowDetail(true);
  };

  // ── Assign auditors ───────────────────────────────────────────────────────

  const openAssign = async (cycle: AuditCycle) => {
    setSelected(cycle);
    try {
      const res = await employeesApi.list({ status: 'active' });
      setEmployees(res.employees);
    } catch {
      toast.error('Failed to load employees.');
      return;
    }
    setSelectedAuditorIds(new Set(cycle.auditor_ids));
    setShowAssign(true);
  };

  const toggleAuditor = (id: number) => {
    setSelectedAuditorIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAssign = async () => {
    if (!selected) return;
    if (selectedAuditorIds.size === 0) {
      toast.error('Select at least one auditor.');
      return;
    }
    setAssignSaving(true);
    try {
      await auditsApi.assignAuditors(
        selected.id,
        Array.from(selectedAuditorIds),
      );
      toast.success('Auditors assigned.');
      setShowAssign(false);
      await refreshSelected(selected.id);
    } catch (err) {
      toast.error(
        'Assignment failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setAssignSaving(false);
    }
  };

  // ── Verification items ────────────────────────────────────────────────────

  const openItems = async (cycle: AuditCycle) => {
    setSelected(cycle);
    setShowItems(true);
    setItemsLoading(true);
    try {
      const res = await auditsApi.listItems(cycle.id);
      setItems(res.audit_items);
      const drafts: Record<number, string> = {};
      res.audit_items.forEach((i) => {
        drafts[i.id] = i.notes ?? '';
      });
      setNotesDraft(drafts);
    } catch {
      toast.error('Failed to load audit items.');
    } finally {
      setItemsLoading(false);
    }
  };

  const handleMarkItem = async (item: AuditItem, result: AuditItemResult) => {
    if (!selected) return;
    setMarkingItem(item.id);
    try {
      const res = await auditsApi.markItem(
        selected.id,
        item.id,
        result,
        notesDraft[item.id] || undefined,
      );
      setItems((prev) =>
        prev.map((i) => (i.id === item.id ? res.audit_item : i)),
      );
      await refreshSelected(selected.id);
    } catch (err) {
      toast.error(
        'Failed to mark item.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setMarkingItem(null);
    }
  };

  // ── Close cycle ───────────────────────────────────────────────────────────

  const handleClose = async (cycle: AuditCycle) => {
    if (
      !window.confirm(
        `Close audit cycle "${cycle.name}"?\n\nThis will lock the cycle and mark all Missing assets as Lost. This cannot be undone.`,
      )
    )
      return;
    try {
      await auditsApi.close(cycle.id);
      toast.success('Audit cycle closed. Missing assets marked as Lost.');
      await refreshSelected(cycle.id);
      if (showDetail) setShowDetail(false);
      loadCycles();
    } catch (err) {
      toast.error(
        'Failed to close cycle.',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  // ── Discrepancy report ────────────────────────────────────────────────────

  const openReport = async (cycle: AuditCycle) => {
    setSelected(cycle);
    setShowReport(true);
    setReportLoading(true);
    try {
      const res = await auditsApi.discrepancyReport(cycle.id);
      setReportItems(res.discrepancies);
    } catch {
      toast.error('Failed to load discrepancy report.');
    } finally {
      setReportLoading(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Audit Cycles"
        subtitle="Create structured verification cycles, assign auditors, and close with discrepancy reports."
        actions={
          isManager ? (
            <Button variant="primary" onClick={openCreate}>
              + New Audit Cycle
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-4)',
          maxWidth: '220px',
        }}
      >
        <Select
          id="audit-status-filter"
          label="Filter by Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All' },
            { value: 'open', label: 'Open' },
            { value: 'closed', label: 'Closed' },
          ]}
        />
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
          `${cycles.length} cycle${cycles.length !== 1 ? 's' : ''}`
        )}
      </div>

      {/* Cycles table */}
      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={(c) => String(c.id)}
          data={cycles}
          empty="No audit cycles found."
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (c) => (
                <div>
                  <strong style={{ color: 'var(--text-primary)' }}>
                    {c.name}
                  </strong>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {fmtDate(c.start_date)} → {fmtDate(c.end_date)}
                  </div>
                </div>
              ),
            },
            {
              key: 'scope',
              header: 'Scope',
              render: (c) => (
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  {c.scope_department_name && (
                    <div>Dept: {c.scope_department_name}</div>
                  )}
                  {c.scope_location && <div>Location: {c.scope_location}</div>}
                  {!c.scope_department_name && !c.scope_location && (
                    <span style={{ color: 'var(--text-muted)' }}>
                      All assets
                    </span>
                  )}
                </div>
              ),
            },
            {
              key: 'auditors',
              header: 'Auditors',
              render: (c) => (
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  {c.auditor_names.length === 0 ? (
                    <span style={{ color: 'var(--text-muted)' }}>
                      None assigned
                    </span>
                  ) : (
                    c.auditor_names.join(', ')
                  )}
                </div>
              ),
            },
            {
              key: 'progress',
              header: 'Progress',
              width: '200px',
              render: (c) => <ProgressBar cycle={c} />,
            },
            {
              key: 'status',
              header: 'Status',
              render: (c) => (
                <Badge variant={c.status === 'open' ? 'primary' : 'muted'}>
                  {c.status === 'open' ? 'Open' : 'Closed'}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              width: '220px',
              render: (c) => (
                <div
                  style={{
                    display: 'flex',
                    gap: 'var(--sp-2)',
                    flexWrap: 'wrap',
                  }}
                >
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openDetail(c)}
                  >
                    Detail
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openItems(c)}
                  >
                    Verify
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => openReport(c)}
                  >
                    Report
                  </Button>
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* ── Create Modal ───────────────────────────────────────────────────── */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="New Audit Cycle"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createSaving}
              onClick={handleCreate}
            >
              Create
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
          <Input
            id="create-name"
            label="Cycle Name"
            required
            placeholder="e.g. Q3 2026 IT Audit"
            value={createForm.name}
            onChange={(e) =>
              setCreateForm({ ...createForm, name: e.target.value })
            }
          />
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--sp-3)',
            }}
          >
            <Input
              id="create-start"
              label="Start Date"
              type="date"
              required
              value={createForm.start_date}
              onChange={(e) =>
                setCreateForm({ ...createForm, start_date: e.target.value })
              }
            />
            <Input
              id="create-end"
              label="End Date"
              type="date"
              required
              value={createForm.end_date}
              onChange={(e) =>
                setCreateForm({ ...createForm, end_date: e.target.value })
              }
            />
          </div>

          <p
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              margin: 0,
            }}
          >
            Scope — fill at least one to limit which assets are included. Leave
            both blank to include all active assets.
          </p>

          <Select
            id="create-dept"
            label="Scope: Department (optional)"
            value={createForm.scope_department_id}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                scope_department_id: e.target.value,
              })
            }
            options={[
              { value: '', label: 'Any department' },
              ...departments.map((d) => ({
                value: String(d.id),
                label: d.name,
              })),
            ]}
          />
          <Input
            id="create-location"
            label="Scope: Location (optional)"
            placeholder="e.g. Server Room, Floor 3"
            value={createForm.scope_location}
            onChange={(e) =>
              setCreateForm({ ...createForm, scope_location: e.target.value })
            }
          />
        </div>
      </Modal>

      {/* ── Detail Modal ───────────────────────────────────────────────────── */}
      {selected && (
        <Modal
          open={showDetail}
          onClose={() => setShowDetail(false)}
          title={selected.name}
          footer={
            <div
              style={{
                display: 'flex',
                gap: 'var(--sp-2)',
                justifyContent: 'space-between',
                width: '100%',
              }}
            >
              <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                {selected.status === 'open' && isManager && (
                  <>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => {
                        setShowDetail(false);
                        openAssign(selected);
                      }}
                    >
                      Assign Auditors
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleClose(selected)}
                    >
                      Close Cycle
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDetail(false);
                    openItems(selected);
                  }}
                >
                  Verify Assets
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setShowDetail(false);
                    openReport(selected);
                  }}
                >
                  Discrepancy Report
                </Button>
              </div>
              <Button variant="secondary" onClick={() => setShowDetail(false)}>
                Close
              </Button>
            </div>
          }
        >
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-4)',
            }}
          >
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--sp-3)',
              }}
            >
              <InfoField label="Status">
                <Badge
                  variant={selected.status === 'open' ? 'primary' : 'muted'}
                >
                  {selected.status === 'open' ? 'Open' : 'Closed'}
                </Badge>
              </InfoField>
              <InfoField
                label="Date Range"
                value={`${fmtDate(selected.start_date)} → ${fmtDate(selected.end_date)}`}
              />
              <InfoField
                label="Scope — Dept"
                value={selected.scope_department_name ?? '—'}
              />
              <InfoField
                label="Scope — Location"
                value={selected.scope_location ?? '—'}
              />
              <InfoField
                label="Created By"
                value={selected.creator_name ?? '—'}
              />
              <InfoField
                label="Auditors"
                value={selected.auditor_names.join(', ') || '—'}
              />
            </div>

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
                Verification Progress
              </p>
              <ProgressBar cycle={selected} />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Assign Auditors Modal ──────────────────────────────────────────── */}
      {selected && (
        <Modal
          open={showAssign}
          onClose={() => setShowAssign(false)}
          title={`Assign Auditors — ${selected.name}`}
          footer={
            <>
              <Button variant="secondary" onClick={() => setShowAssign(false)}>
                Cancel
              </Button>
              <Button
                variant="primary"
                loading={assignSaving}
                onClick={handleAssign}
              >
                Save
              </Button>
            </>
          }
        >
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              marginBottom: 'var(--sp-3)',
            }}
          >
            Select one or more employees to assign as auditors.
          </p>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-2)',
              maxHeight: '320px',
              overflowY: 'auto',
            }}
          >
            {employees.map((emp) => (
              <label
                key={emp.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--sp-3)',
                  padding: 'var(--sp-2) var(--sp-3)',
                  borderRadius: 'var(--radius-md)',
                  background: selectedAuditorIds.has(emp.id)
                    ? 'var(--primary-subtle, rgba(59,130,246,0.08))'
                    : 'var(--bg-surface-2)',
                  cursor: 'pointer',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <input
                  type="checkbox"
                  checked={selectedAuditorIds.has(emp.id)}
                  onChange={() => toggleAuditor(emp.id)}
                  style={{ accentColor: 'var(--primary)' }}
                />
                <div>
                  <div style={{ fontWeight: 'var(--fw-medium)' }}>
                    {emp.name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {emp.role}
                  </div>
                </div>
              </label>
            ))}
          </div>
        </Modal>
      )}

      {/* ── Items / Verification Modal ─────────────────────────────────────── */}
      {selected && (
        <Modal
          open={showItems}
          onClose={() => setShowItems(false)}
          title={`Verify Assets — ${selected.name}`}
          footer={
            <Button variant="secondary" onClick={() => setShowItems(false)}>
              Close
            </Button>
          }
        >
          {itemsLoading ? (
            <Spinner size="sm" label="Loading items…" />
          ) : items.length === 0 ? (
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                textAlign: 'center',
                padding: 'var(--sp-6)',
              }}
            >
              No assets in scope for this cycle.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--sp-2)',
                maxHeight: '480px',
                overflowY: 'auto',
              }}
            >
              {items.map((item) => (
                <div
                  key={item.id}
                  style={{
                    padding: 'var(--sp-3)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-2)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--sp-2)',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <strong
                        style={{
                          color: 'var(--primary)',
                          cursor: 'pointer',
                          fontSize: 'var(--text-sm)',
                        }}
                        onClick={() => {
                          setShowItems(false);
                          navigate(`/assets/${item.asset_id}`);
                        }}
                      >
                        {item.asset_tag}
                      </strong>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          marginLeft: 'var(--sp-2)',
                        }}
                      >
                        {item.asset_name}
                      </span>
                    </div>
                    <Badge variant={RESULT_BADGE[item.result]}>
                      {RESULT_LABEL[item.result]}
                    </Badge>
                  </div>

                  {selected.status === 'open' && (
                    <div
                      style={{
                        display: 'flex',
                        gap: 'var(--sp-2)',
                        alignItems: 'flex-end',
                        flexWrap: 'wrap',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: '140px' }}>
                        <input
                          type="text"
                          placeholder="Notes (optional)"
                          value={notesDraft[item.id] ?? ''}
                          onChange={(e) =>
                            setNotesDraft((prev) => ({
                              ...prev,
                              [item.id]: e.target.value,
                            }))
                          }
                          style={{
                            width: '100%',
                            padding: 'var(--sp-1) var(--sp-2)',
                            border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-md)',
                            background: 'var(--bg-surface)',
                            color: 'var(--text-primary)',
                            fontSize: 'var(--text-xs)',
                            boxSizing: 'border-box',
                          }}
                        />
                      </div>
                      {(
                        ['verified', 'missing', 'damaged'] as AuditItemResult[]
                      ).map((r) => (
                        <Button
                          key={r}
                          size="sm"
                          variant={
                            item.result === r
                              ? 'primary'
                              : r === 'verified'
                                ? 'secondary'
                                : r === 'missing'
                                  ? 'danger'
                                  : 'secondary'
                          }
                          loading={markingItem === item.id}
                          onClick={() => handleMarkItem(item, r)}
                        >
                          {r === 'verified' ? '✓' : r === 'missing' ? '✕' : '⚠'}{' '}
                          {RESULT_LABEL[r]}
                        </Button>
                      ))}
                    </div>
                  )}

                  {item.notes && (
                    <p
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        margin: 0,
                      }}
                    >
                      Note: {item.notes}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Modal>
      )}

      {/* ── Discrepancy Report Modal ───────────────────────────────────────── */}
      {selected && (
        <Modal
          open={showReport}
          onClose={() => setShowReport(false)}
          title={`Discrepancy Report — ${selected.name}`}
          footer={
            <Button variant="secondary" onClick={() => setShowReport(false)}>
              Close
            </Button>
          }
        >
          {reportLoading ? (
            <Spinner size="sm" label="Loading report…" />
          ) : reportItems.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: 'var(--sp-6)',
                color: 'var(--text-muted)',
              }}
            >
              <div style={{ fontSize: '2rem', marginBottom: 'var(--sp-2)' }}>
                ✅
              </div>
              <p>No discrepancies — all audited assets are verified.</p>
            </div>
          ) : (
            <>
              <p
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                  marginBottom: 'var(--sp-3)',
                }}
              >
                {reportItems.length} item{reportItems.length !== 1 ? 's' : ''}{' '}
                with discrepancies (Missing or Damaged).
              </p>
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 'var(--sp-2)',
                  maxHeight: '420px',
                  overflowY: 'auto',
                }}
              >
                {reportItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      padding: 'var(--sp-3)',
                      borderRadius: 'var(--radius-md)',
                      background:
                        item.result === 'missing'
                          ? 'rgba(239,68,68,0.06)'
                          : 'rgba(245,158,11,0.06)',
                      border: `1px solid ${item.result === 'missing' ? 'rgba(239,68,68,0.2)' : 'rgba(245,158,11,0.2)'}`,
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 'var(--sp-1)',
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontSize: 'var(--text-sm)',
                          }}
                          onClick={() => {
                            setShowReport(false);
                            navigate(`/assets/${item.asset_id}`);
                          }}
                        >
                          {item.asset_tag}
                        </strong>
                        <span
                          style={{
                            fontSize: 'var(--text-xs)',
                            color: 'var(--text-muted)',
                            marginLeft: 'var(--sp-2)',
                          }}
                        >
                          {item.asset_name}
                        </span>
                      </div>
                      <Badge variant={RESULT_BADGE[item.result]}>
                        {RESULT_LABEL[item.result]}
                      </Badge>
                    </div>
                    {item.asset_location && (
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          margin: 0,
                        }}
                      >
                        Location: {item.asset_location}
                      </p>
                    )}
                    {item.notes && (
                      <p
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                          margin: 0,
                        }}
                      >
                        Notes: {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </>
  );
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function InfoField({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
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
        {children ?? value}
      </div>
    </div>
  );
}
