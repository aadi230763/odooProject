/**
 * Departments tab — list, create, edit, deactivate departments.
 */

import { useCallback, useEffect, useState } from 'react';
import {
  departmentsApi,
  type Department,
  type OrgEmployee,
} from '../../api/org';
import { employeesApi } from '../../api/org';
import { ApiError } from '../../api/client';
import {
  Badge,
  Button,
  Input,
  Modal,
  Select,
  Table,
} from '../../components/ui';
import { useToast } from '../../hooks/useToast';

interface DeptFormState {
  name: string;
  head_employee_id: string;
  parent_department_id: string;
}

const EMPTY_FORM: DeptFormState = {
  name: '',
  head_employee_id: '',
  parent_department_id: '',
};

export function DepartmentsTab() {
  const toast = useToast();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<OrgEmployee[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<Department | null>(null);
  const [form, setForm] = useState<DeptFormState>(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState<Partial<DeptFormState>>({});
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Department | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [deptRes, empRes] = await Promise.all([
        departmentsApi.list(),
        employeesApi.list({ status: 'active' }),
      ]);
      setDepartments(deptRes.departments);
      setEmployees(empRes.employees);
    } catch {
      toast.error('Failed to load departments.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const openCreate = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setEditing(null);
    setModal('create');
  };
  const openEdit = (d: Department) => {
    setForm({
      name: d.name,
      head_employee_id: d.head_employee_id ? String(d.head_employee_id) : '',
      parent_department_id: d.parent_department_id
        ? String(d.parent_department_id)
        : '',
    });
    setFormErrors({});
    setEditing(d);
    setModal('edit');
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      setFormErrors({ name: 'Department name is required.' });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        head_employee_id: form.head_employee_id
          ? Number(form.head_employee_id)
          : null,
        parent_department_id: form.parent_department_id
          ? Number(form.parent_department_id)
          : null,
      };
      if (editing) {
        await departmentsApi.update(editing.id, payload);
        toast.success('Department updated.');
      } else {
        await departmentsApi.create(payload);
        toast.success('Department created.');
      }
      setModal(null);
      loadData();
    } catch (err) {
      if (err instanceof ApiError && err.fields) {
        setFormErrors(err.fields as Partial<DeptFormState>);
      } else if (err instanceof ApiError && err.code === 'DUPLICATE_NAME') {
        setFormErrors({ name: 'A department with this name already exists.' });
      } else {
        toast.error(
          'Save failed.',
          err instanceof ApiError ? err.message : 'Unknown error.',
        );
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await departmentsApi.deactivate(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deactivated.`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error(
        'Failed to deactivate.',
        err instanceof ApiError ? err.message : '',
      );
    } finally {
      setDeleting(false);
    }
  };

  const deptOptions = [
    { value: '', label: 'None' },
    ...departments
      .filter((d) => d.id !== editing?.id && d.status === 'active')
      .map((d) => ({ value: String(d.id), label: d.name })),
  ];
  const empOptions = [
    { value: '', label: 'None' },
    ...employees.map((e) => ({
      value: String(e.id),
      label: `${e.name} (${e.email})`,
    })),
  ];

  return (
    <>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 'var(--sp-5)',
        }}
      >
        <p
          style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}
        >
          {departments.length} department{departments.length !== 1 ? 's' : ''}{' '}
          total
        </p>
        <Button
          id="btn-create-dept"
          variant="primary"
          size="sm"
          onClick={openCreate}
        >
          + New Department
        </Button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={(d) => String(d.id)}
          data={departments}
          empty="No departments found. Create one to get started."
          columns={[
            {
              key: 'name',
              header: 'Name',
              render: (d) => (
                <strong style={{ color: 'var(--text-primary)' }}>
                  {d.name}
                </strong>
              ),
            },
            {
              key: 'head',
              header: 'Department Head',
              render: (d) =>
                d.head_name ?? (
                  <span style={{ color: 'var(--text-muted)' }}>Unassigned</span>
                ),
            },
            {
              key: 'parent',
              header: 'Parent',
              render: (d) =>
                d.parent_name ?? (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (d) => (
                <Badge variant={d.status === 'active' ? 'success' : 'muted'}>
                  {d.status}
                </Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              width: '120px',
              render: (d) => (
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <Button
                    id={`btn-edit-dept-${d.id}`}
                    variant="ghost"
                    size="sm"
                    onClick={() => openEdit(d)}
                  >
                    Edit
                  </Button>
                  {d.status === 'active' && (
                    <Button
                      id={`btn-deactivate-dept-${d.id}`}
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeleteTarget(d)}
                      style={{ color: 'var(--danger)' }}
                    >
                      Deactivate
                    </Button>
                  )}
                </div>
              ),
            },
          ]}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={editing ? `Edit "${editing.name}"` : 'New Department'}
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setModal(null)}
            >
              Cancel
            </Button>
            <Button
              id="btn-save-dept"
              variant="primary"
              size="md"
              loading={saving}
              onClick={handleSave}
            >
              {editing ? 'Save Changes' : 'Create Department'}
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
            id="dept-name"
            label="Department name *"
            value={form.name}
            onChange={(e) => {
              setForm((f) => ({ ...f, name: e.target.value }));
              setFormErrors((fe) => ({ ...fe, name: undefined }));
            }}
            error={formErrors.name}
            placeholder="e.g. Engineering"
            autoFocus
          />
          <Select
            id="dept-head"
            label="Department Head"
            value={form.head_employee_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, head_employee_id: e.target.value }))
            }
            options={empOptions}
            placeholder="Select head employee"
          />
          <Select
            id="dept-parent"
            label="Parent Department"
            value={form.parent_department_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, parent_department_id: e.target.value }))
            }
            options={deptOptions}
            placeholder="None (top-level)"
          />
        </div>
      </Modal>

      {/* Deactivate confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Deactivate Department"
        footer={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setDeleteTarget(null)}
            >
              Cancel
            </Button>
            <Button
              id="btn-confirm-deactivate-dept"
              variant="danger"
              size="md"
              loading={deleting}
              onClick={handleDeactivate}
            >
              Deactivate
            </Button>
          </>
        }
      >
        <p
          style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}
        >
          Deactivate{' '}
          <strong style={{ color: 'var(--text-primary)' }}>
            {deleteTarget?.name}
          </strong>
          ? This will mark it as inactive. Employees assigned to it will not be
          moved.
        </p>
      </Modal>
    </>
  );
}
