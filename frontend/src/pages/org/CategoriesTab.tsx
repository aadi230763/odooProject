/**
 * Asset Categories tab — list, create, edit, deactivate categories.
 * Supports optional custom_fields (JSONB) as a dynamic key-value editor.
 */

import { useCallback, useEffect, useState } from 'react';
import { categoriesApi, type AssetCategory } from '../../api/org';
import { ApiError } from '../../api/client';
import { Badge, Button, Input, Modal, Table } from '../../components/ui';
import { useToast } from '../../hooks/useToast';

interface CustomField { key: string; value: string; }

interface CatFormState {
  name: string;
  customFields: CustomField[];
}

const EMPTY_FORM: CatFormState = { name: '', customFields: [] };

export function CategoriesTab() {
  const toast = useToast();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<'create' | 'edit' | null>(null);
  const [editing, setEditing] = useState<AssetCategory | null>(null);
  const [form, setForm] = useState<CatFormState>(EMPTY_FORM);
  const [nameError, setNameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AssetCategory | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await categoriesApi.list();
      setCategories(res.categories);
    } catch {
      toast.error('Failed to load categories.');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const openCreate = () => { setForm(EMPTY_FORM); setNameError(''); setEditing(null); setModal('create'); };
  const openEdit = (c: AssetCategory) => {
    const customFields: CustomField[] = Object.entries(c.custom_fields || {}).map(([key, value]) => ({
      key,
      value: String(value),
    }));
    setForm({ name: c.name, customFields });
    setNameError('');
    setEditing(c);
    setModal('edit');
  };

  const addField = () => setForm(f => ({ ...f, customFields: [...f.customFields, { key: '', value: '' }] }));
  const removeField = (i: number) => setForm(f => ({ ...f, customFields: f.customFields.filter((_, idx) => idx !== i) }));
  const updateField = (i: number, part: Partial<CustomField>) =>
    setForm(f => ({ ...f, customFields: f.customFields.map((cf, idx) => idx === i ? { ...cf, ...part } : cf) }));

  const buildCustomFields = (): Record<string, string> | null => {
    const result: Record<string, string> = {};
    for (const { key, value } of form.customFields) {
      if (key.trim()) result[key.trim()] = value;
    }
    return Object.keys(result).length ? result : null;
  };

  const handleSave = async () => {
    if (!form.name.trim()) { setNameError('Category name is required.'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name.trim(), custom_fields: buildCustomFields() };
      if (editing) {
        await categoriesApi.update(editing.id, payload);
        toast.success('Category updated.');
      } else {
        await categoriesApi.create(payload);
        toast.success('Category created.');
      }
      setModal(null);
      loadData();
    } catch (err) {
      if (err instanceof ApiError && err.code === 'DUPLICATE_NAME') {
        setNameError('A category with this name already exists.');
      } else {
        toast.error('Save failed.', err instanceof ApiError ? err.message : '');
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await categoriesApi.deactivate(deleteTarget.id);
      toast.success(`"${deleteTarget.name}" deactivated.`);
      setDeleteTarget(null);
      loadData();
    } catch (err) {
      toast.error('Failed to deactivate.', err instanceof ApiError ? err.message : '');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-5)' }}>
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          {categories.length} categor{categories.length !== 1 ? 'ies' : 'y'} total
        </p>
        <Button id="btn-create-category" variant="primary" size="sm" onClick={openCreate}>
          + New Category
        </Button>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={(c) => String(c.id)}
          data={categories}
          empty="No categories yet. Create one to start registering assets."
          columns={[
            { key: 'name', header: 'Name', render: (c) => <strong style={{ color: 'var(--text-primary)' }}>{c.name}</strong> },
            {
              key: 'fields', header: 'Custom Fields', render: (c) => {
                const keys = Object.keys(c.custom_fields || {});
                return keys.length
                  ? <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>{keys.join(', ')}</span>
                  : <span style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>None</span>;
              }
            },
            { key: 'status', header: 'Status', render: (c) => <Badge variant={c.status === 'active' ? 'success' : 'muted'}>{c.status}</Badge> },
            {
              key: 'actions', header: '', width: '120px',
              render: (c) => (
                <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                  <Button id={`btn-edit-cat-${c.id}`} variant="ghost" size="sm" onClick={() => openEdit(c)}>Edit</Button>
                  {c.status === 'active' && (
                    <Button id={`btn-deactivate-cat-${c.id}`} variant="ghost" size="sm" onClick={() => setDeleteTarget(c)}
                      style={{ color: 'var(--danger)' }}>
                      Deactivate
                    </Button>
                  )}
                </div>
              )
            },
          ]}
        />
      </div>

      {/* Create / Edit Modal */}
      <Modal
        open={modal === 'create' || modal === 'edit'}
        onClose={() => setModal(null)}
        title={editing ? `Edit "${editing.name}"` : 'New Asset Category'}
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setModal(null)}>Cancel</Button>
            <Button id="btn-save-category" variant="primary" size="md" loading={saving} onClick={handleSave}>
              {editing ? 'Save Changes' : 'Create Category'}
            </Button>
          </>
        }
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-5)' }}>
          <Input
            id="cat-name"
            label="Category name *"
            value={form.name}
            onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setNameError(''); }}
            error={nameError}
            placeholder="e.g. Electronics"
            autoFocus
          />

          {/* Custom fields editor */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--sp-3)' }}>
              <span className="field-label">Custom Fields</span>
              <Button id="btn-add-custom-field" variant="ghost" size="sm" onClick={addField}>+ Add field</Button>
            </div>
            {form.customFields.length === 0 && (
              <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                No custom fields. Add fields like "warranty_months" or "requires_calibration".
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-2)' }}>
              {form.customFields.map((cf, i) => (
                <div key={i} style={{ display: 'flex', gap: 'var(--sp-2)', alignItems: 'center' }}>
                  <input
                    className="field-input"
                    placeholder="field_name"
                    value={cf.key}
                    onChange={e => updateField(i, { key: e.target.value })}
                    style={{ flex: 1 }}
                    id={`custom-field-key-${i}`}
                  />
                  <input
                    className="field-input"
                    placeholder="value"
                    value={cf.value}
                    onChange={e => updateField(i, { value: e.target.value })}
                    style={{ flex: 1 }}
                    id={`custom-field-val-${i}`}
                  />
                  <button
                    type="button"
                    onClick={() => removeField(i)}
                    aria-label="Remove field"
                    style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '1.1rem', padding: 'var(--sp-1)', flexShrink: 0 }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Deactivate confirm */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Deactivate Category"
        footer={
          <>
            <Button variant="secondary" size="md" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button id="btn-confirm-deactivate-cat" variant="danger" size="md" loading={deleting} onClick={handleDeactivate}>
              Deactivate
            </Button>
          </>
        }
      >
        <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-sm)' }}>
          Deactivate <strong style={{ color: 'var(--text-primary)' }}>{deleteTarget?.name}</strong>?
          Existing assets in this category are not affected.
        </p>
      </Modal>
    </>
  );
}
