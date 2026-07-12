import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { assetsApi, type Asset, type AssetStatus } from '../../api/assets';
import { categoriesApi, type AssetCategory } from '../../api/org';
import {
  Badge,
  Button,
  Input,
  Select,
  Spinner,
  Table,
  PageHeader,
} from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'available', label: 'Available' },
  { value: 'allocated', label: 'Allocated' },
  { value: 'reserved', label: 'Reserved' },
  { value: 'under_maintenance', label: 'Under Maintenance' },
  { value: 'lost', label: 'Lost' },
  { value: 'retired', label: 'Retired' },
  { value: 'disposed', label: 'Disposed' },
];

const STATUS_BADGE: Record<
  AssetStatus,
  'success' | 'primary' | 'warning' | 'danger' | 'info' | 'muted'
> = {
  available: 'success',
  allocated: 'primary',
  reserved: 'info',
  under_maintenance: 'warning',
  lost: 'danger',
  retired: 'muted',
  disposed: 'muted',
};

export function AssetDirectoryPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [assets, setAssets] = useState<Asset[]>([]);
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  const canManageAssets =
    user?.role === 'admin' || user?.role === 'asset_manager';

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [assRes, catRes] = await Promise.all([
        assetsApi.list({
          search: search || undefined,
          category_id: categoryFilter ? Number(categoryFilter) : undefined,
          status: statusFilter || undefined,
          location: locationFilter || undefined,
        }),
        categoriesApi.list(),
      ]);
      setAssets(assRes.assets);
      setCategories(catRes.categories);
    } catch {
      toast.error('Failed to load assets.');
    } finally {
      setLoading(false);
    }
  }, [search, categoryFilter, statusFilter, locationFilter, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => loadData(), 300);
    return () => clearTimeout(t);
  }, [search, locationFilter, loadData]);

  const catOptions = [
    { value: '', label: 'All categories' },
    ...categories.map((c) => ({ value: String(c.id), label: c.name })),
  ];

  return (
    <>
      <PageHeader
        title="Asset Directory"
        subtitle="Browse, search, and track all physical assets."
        actions={
          canManageAssets ? (
            <Button variant="primary" onClick={() => navigate('/assets/new')}>
              + Register Asset
            </Button>
          ) : undefined
        }
      />

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto auto 1fr',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-5)',
          alignItems: 'end',
        }}
      >
        <Input
          id="asset-search"
          label="Search"
          placeholder="Name, tag, or serial..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          id="asset-cat-filter"
          label="Category"
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          options={catOptions}
        />
        <Select
          id="asset-status-filter"
          label="Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={STATUS_OPTIONS}
        />
        <Input
          id="asset-location"
          label="Location"
          placeholder="e.g. Server Room"
          value={locationFilter}
          onChange={(e) => setLocationFilter(e.target.value)}
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
          `${assets.length} asset${assets.length !== 1 ? 's' : ''} found`
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={(a) => String(a.id)}
          data={assets}
          empty="No assets match the current filters."
          columns={[
            {
              key: 'tag',
              header: 'Asset Tag',
              render: (a) => (
                <strong
                  style={{ color: 'var(--primary)', cursor: 'pointer' }}
                  onClick={() => navigate(`/assets/${a.id}`)}
                >
                  {a.asset_tag}
                </strong>
              ),
            },
            {
              key: 'name',
              header: 'Name',
              render: (a) => (
                <div>
                  <div
                    style={{
                      fontWeight: 'var(--fw-medium)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {a.name}
                  </div>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {a.category_name}
                  </div>
                </div>
              ),
            },
            {
              key: 'status',
              header: 'Status',
              render: (a) => (
                <Badge variant={STATUS_BADGE[a.status]}>
                  {a.status.replace('_', ' ')}
                </Badge>
              ),
            },
            {
              key: 'location',
              header: 'Location',
              render: (a) =>
                a.location || (
                  <span style={{ color: 'var(--text-muted)' }}>—</span>
                ),
            },
            {
              key: 'actions',
              header: '',
              width: '80px',
              render: (a) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => navigate(`/assets/${a.id}`)}
                >
                  View
                </Button>
              ),
            },
          ]}
        />
      </div>
    </>
  );
}
