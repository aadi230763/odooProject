/**
 * Employee Directory tab
 *
 * - Search by name / email
 * - Filter by role, status, department
 * - Role promotion: Admin sets any employee's role (only place this happens)
 * - Activate / deactivate accounts
 */

import { useCallback, useEffect, useState } from 'react';
import { employeesApi, departmentsApi, type OrgEmployee, type UserRole, type Department } from '../../api/org';
import { ApiError } from '../../api/client';
import { Badge, Button, Input, Modal, Select, Spinner, Table } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

const ROLE_OPTIONS = [
  { value: '', label: 'All roles' },
  { value: 'admin', label: 'Admin' },
  { value: 'asset_manager', label: 'Asset Manager' },
  { value: 'department_head', label: 'Department Head' },
  { value: 'employee', label: 'Employee' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];

const ROLE_BADGE: Record<UserRole, 'primary' | 'info' | 'warning' | 'muted'> = {
  admin: 'primary',
  asset_manager: 'info',
  department_head: 'warning',
  employee: 'muted',
};

const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  asset_manager: 'Asset Manager',
  department_head: 'Dept Head',
  employee: 'Employee',
};

export function EmployeeDirectoryTab() {
  const toast = useToast();
  const { user: currentUser } = useAuth();

  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [deptFilter, setDeptFilter] = useState('');

  // Role modal
  const [roleModal, setRoleModal] = useState<OrgEmployee | null>(null);
  const [newRole, setNewRole] = useState<UserRole>('employee');
  const [savingRole, setSavingRole] = useState(false);

  // Status modal
  const [statusModal, setStatusModal] = useState<OrgEmployee | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empRes, deptRes] = await Promise.all([
        employeesApi.list({
          search: search || undefined,
          role: roleFilter || undefined,
          status: statusFilter || undefined,
          department_id: deptFilter ? Number(deptFilter) : undefined,
        }),
        departmentsApi.list(),
      ]);
      setEmployees(empRes.employees);
      setDepartments(deptRes.departments);
    } catch {
      toast.error('Failed to load employee directory.');
    } finally {
      setLoading(false);
    }
  }, [search, roleFilter, statusFilter, deptFilter, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => loadData(), 300);
    return () => clearTimeout(t);
  }, [search, loadData]);

  const openRoleModal = (emp: OrgEmployee) => { setRoleModal(emp); setNewRole(emp.role); };

  const handleRoleSave = async () => {
    if (!roleModal) return;
    setSavingRole(true);
    try {
      const updated = await employeesApi.setRole(roleModal.id, newRole);
      toast.success(`${roleModal.name}'s role updated to ${ROLE_LABELS[newRole]}.`);
      setRoleModal(null);
      setEmployees(prev => prev.map(e => e.id === roleModal.id ? updated.employee : e));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SELF_DEMOTION') {
        toast.error('Cannot remove your own admin role.');
      } else {
        toast.error('Role update failed.', err instanceof ApiError ? err.message : '');
      }
    } finally {
      setSavingRole(false);
    }
  };

  const handleStatusToggle = async () => {
    if (!statusModal) return;
    const newStatus = statusModal.status === 'active' ? 'inactive' : 'active';
    setSavingStatus(true);
    try {
      const updated = await employeesApi.setStatus(statusModal.id, newStatus);
      toast.success(`${statusModal.name} ${newStatus === 'active' ? 'activated' : 'deactivated'}.`);
      setStatusModal(null);
      setEmployees(prev => prev.map(e => e.id === statusModal.id ? updated.employee : e));
    } catch (err) {
      if (err instanceof ApiError && err.code === 'SELF_DEACTIVATION') {
        toast.error('You cannot deactivate your own account.');
      } else {
        toast.error('Status update failed.', err instanceof ApiError ? err.message : '');
      }
    } finally {
      setSavingStatus(false);
    }
  };

  const deptOptions = [
    { value: '', label: 'All departments' },
    ...departments.map(d => ({ value: String(d.id), label: d.name })),
  ];

  const roleSelectOptions = [
    { value: 'admin', label: 'Admin' },
    { value: 'asset_manager', label: 'Asset Manager' },
    { value: 'department_head', label: 'Department Head' },
    { value: 'employee', label: 'Employee' },
  ];

  return (
    <>
      {/* Filters */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto auto',
        gap: 'var(--sp-3)',
        marginBottom: 'var(--sp-5)',
        alignItems: 'end',
      }}>
        <Input
          id="emp-search"
          label="Search"
          placeholder="Name or email…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <Select id="emp-role-filter" label="Role" value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)} options={ROLE_OPTIONS} />
        <Select id="emp-status-filter" label="Status" value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} />
        <Select id="emp-dept-filter" label="Department" value={deptFilter}
          onChange={e => setDeptFilter(e.target.value)} options={deptOptions} />
      </div>

      <div style={{ marginBottom: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        {loading ? <Spinner size="xs" label="Loading" /> : `${employees.length} employee${employees.length !== 1 ? 's' : ''} found`}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={(e) => String(e.id)}
          data={employees}
          empty="No employees match the current filters."
          columns={[
            {
              key: 'name', header: 'Employee', render: (e) => (
                <div>
                  <p style={{ fontWeight: 'var(--fw-medium)', color: 'var(--text-primary)' }}>
                    {e.name}
                    {String(e.id) === currentUser?.id ? (
                      <span style={{ fontSize: 'var(--text-xs)', color: 'var(--primary)', marginLeft: 'var(--sp-2)' }}>you</span>
                    ) : null}
                  </p>
                  <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>{e.email}</p>
                </div>
              )
            },
            {
              key: 'role', header: 'Role',
              render: (e) => <Badge variant={ROLE_BADGE[e.role]}>{ROLE_LABELS[e.role]}</Badge>
            },
            {
              key: 'dept', header: 'Department',
              render: (e) => e.department_name ?? <span style={{ color: 'var(--text-muted)' }}>—</span>
            },
            { key: 'status', header: 'Status', render: (e) => <Badge variant={e.status === 'active' ? 'success' : 'muted'}>{e.status}</Badge> },
            {
              key: 'actions', header: '', width: '160px',
              render: (e) => (
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <Button id={`btn-set-role-${e.id}`} variant="ghost" size="sm" onClick={() => openRoleModal(e)}>
                    Set Role
                  </Button>
                  <Button
                    id={`btn-toggle-status-${e.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => setStatusModal(e)}
                    style={{ color: e.status === 'active' ? 'var(--danger)' : 'var(--success)' }}
                  >
                    {e.status === 'active' ? 'Deactivate' : 'Activate'}
                  </Button>
                </div>
              )
            },
          ]}
        />
      </div>

      {/* Role promotion modal */}
      <Modal
        open={!!roleModal}
        onClose={() => setRoleModal(null)}
        title={`Set Role — ${roleModal?.name}`}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setRoleModal(null)}>Cancel</Button>
            <Button id="btn-confirm-role" variant="primary" size="md" loading={savingRole} onClick={handleRoleSave}>
              Apply Role
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-4)' }}>
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
            Current role: <Badge variant={roleModal ? ROLE_BADGE[roleModal.role] : 'muted'}>{roleModal ? ROLE_LABELS[roleModal.role] : ''}</Badge>
          </p>
          <Select
            id="new-role-select"
            label="New role"
            value={newRole}
            onChange={e => setNewRole(e.target.value as UserRole)}
            options={roleSelectOptions}
          />
          <div style={{ background: 'var(--warning-soft)', border: '1px solid rgba(245,158,11,0.2)', borderRadius: 'var(--radius-md)', padding: 'var(--sp-3)', fontSize: 'var(--text-xs)', color: 'var(--warning)' }}>
            ⚠ Role changes take effect immediately on the employee's next request.
          </div>
        </div>
      </Modal>

      {/* Status toggle confirm */}
      <Modal
        open={!!statusModal}
        onClose={() => setStatusModal(null)}
        title={statusModal?.status === 'active' ? 'Deactivate Employee' : 'Activate Employee'}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setStatusModal(null)}>Cancel</Button>
            <Button
              id="btn-confirm-status"
              variant={statusModal?.status === 'active' ? 'danger' : 'primary'}
              size="md"
              loading={savingStatus}
              onClick={handleStatusToggle}
            >
              {statusModal?.status === 'active' ? 'Deactivate' : 'Activate'}
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          {statusModal?.status === 'active'
            ? <>Deactivating <strong style={{ color: 'var(--text-primary)' }}>{statusModal?.name}</strong> will prevent them from logging in. This can be reversed.</>
            : <>Reactivating <strong style={{ color: 'var(--text-primary)' }}>{statusModal?.name}</strong> will restore their access.</>
          }
        </p>
      </Modal>
    </>
  );
}
