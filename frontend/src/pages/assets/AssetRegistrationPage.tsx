import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetsApi } from '../../api/assets';
import { categoriesApi, type AssetCategory } from '../../api/org';
import { ApiError } from '../../api/client';
import { Button, Input, Select, PageHeader } from '../../components/ui';
import { useToast } from '../../hooks/useToast';

const CONDITION_OPTIONS = [
  { value: 'new', label: 'New' },
  { value: 'good', label: 'Good' },
  { value: 'fair', label: 'Fair' },
  { value: 'poor', label: 'Poor' },
];

export function AssetRegistrationPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: '',
    category_id: '',
    serial_number: '',
    acquisition_date: '',
    acquisition_cost: '',
    condition: 'good',
    location: '',
    is_bookable: false,
  });

  const [photo, setPhoto] = useState<File | null>(null);

  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await categoriesApi.list();
        setCategories(res.categories);
      } catch {
        toast.error('Failed to load categories.');
      }
    };
    fetchCats();
  }, [toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = form.name.trim();
    if (trimmedName.length < 2 || !form.category_id) {
      toast.error('Name (min 2 chars) and Category are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: trimmedName,
        category_id: Number(form.category_id),
        serial_number: form.serial_number.trim() || null,
        acquisition_date: form.acquisition_date.trim() || null,
        acquisition_cost: form.acquisition_cost.trim()
          ? Number(form.acquisition_cost.trim())
          : null,
        condition: form.condition,
        location: form.location.trim() || null,
        is_bookable: Boolean(form.is_bookable),
      };

      const res = await assetsApi.create(payload);
      const newAsset = res.asset;

      // Upload photo if selected
      if (photo) {
        try {
          await assetsApi.uploadDocument(newAsset.id, photo, 'photo');
        } catch {
          toast.error('Asset created, but photo upload failed.');
        }
      }

      toast.success('Asset registered successfully.');
      navigate(`/assets/${newAsset.id}`);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error('Registration failed.', err.message);
      } else {
        toast.error('An unexpected error occurred.');
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <Button variant="ghost" onClick={() => navigate('/assets')}>
          ← Back to Directory
        </Button>
      </div>

      <PageHeader
        title="Register Asset"
        subtitle="Add a new physical asset to the system."
      />

      <form
        className="card"
        onSubmit={handleSubmit}
        style={{
          maxWidth: '600px',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-4)',
        }}
      >
        <Input
          id="asset-name"
          label="Asset Name"
          required
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />

        <Select
          id="asset-category"
          label="Category"
          required
          value={form.category_id}
          onChange={(e) => setForm({ ...form, category_id: e.target.value })}
          options={[
            { value: '', label: 'Select a category...' },
            ...categories.map((c) => ({ value: String(c.id), label: c.name })),
          ]}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 'var(--sp-4)',
          }}
        >
          <Input
            id="asset-serial"
            label="Serial Number"
            value={form.serial_number}
            onChange={(e) =>
              setForm({ ...form, serial_number: e.target.value })
            }
          />
          <Input
            id="asset-location"
            label="Location"
            value={form.location}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr 1fr',
            gap: 'var(--sp-4)',
          }}
        >
          <Input
            id="asset-date"
            label="Acquisition Date"
            type="date"
            value={form.acquisition_date}
            onChange={(e) =>
              setForm({ ...form, acquisition_date: e.target.value })
            }
          />
          <Input
            id="asset-cost"
            label="Cost ($)"
            type="number"
            step="0.01"
            value={form.acquisition_cost}
            onChange={(e) =>
              setForm({ ...form, acquisition_cost: e.target.value })
            }
          />
          <Select
            id="asset-condition"
            label="Condition"
            value={form.condition}
            onChange={(e) => setForm({ ...form, condition: e.target.value })}
            options={CONDITION_OPTIONS}
          />
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 'var(--sp-2)',
            marginTop: 'var(--sp-2)',
          }}
        >
          <input
            type="checkbox"
            id="asset-bookable"
            checked={form.is_bookable}
            onChange={(e) =>
              setForm({ ...form, is_bookable: e.target.checked })
            }
          />
          <label
            htmlFor="asset-bookable"
            style={{ fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}
          >
            This is a shared resource (bookable by time-slot)
          </label>
        </div>

        <div style={{ marginTop: 'var(--sp-2)' }}>
          <label
            style={{
              display: 'block',
              fontSize: 'var(--text-sm)',
              fontWeight: 'var(--fw-medium)',
              marginBottom: 'var(--sp-1)',
            }}
          >
            Photo (Optional)
          </label>
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
            style={{ fontSize: 'var(--text-sm)' }}
          />
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 'var(--sp-3)',
            marginTop: 'var(--sp-4)',
          }}
        >
          <Button
            variant="secondary"
            type="button"
            onClick={() => navigate('/assets')}
          >
            Cancel
          </Button>
          <Button variant="primary" type="submit" loading={saving}>
            Register Asset
          </Button>
        </div>
      </form>
    </>
  );
}
