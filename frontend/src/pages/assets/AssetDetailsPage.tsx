import { useCallback, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { assetsApi, type Asset, type AssetStatus, type AssetDocument } from '../../api/assets';
import { ApiError } from '../../api/client';
import { Badge, Button, Select, Spinner, Modal } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { useAuth } from '../../context/AuthContext';
import { getBackendImageUrl } from '../../utils/url';

const STATUS_BADGE: Record<AssetStatus, 'success' | 'primary' | 'warning' | 'danger' | 'info' | 'muted'> = {
  available: 'success',
  allocated: 'primary',
  reserved: 'info',
  under_maintenance: 'warning',
  lost: 'danger',
  retired: 'muted',
  disposed: 'muted',
};

const VALID_TRANSITIONS: Record<AssetStatus, AssetStatus[]> = {
  available: ['allocated', 'reserved', 'under_maintenance', 'retired'],
  allocated: ['available', 'under_maintenance', 'lost'],
  reserved: ['available', 'allocated'],
  under_maintenance: ['available', 'retired', 'disposed'],
  lost: ['available', 'disposed'],
  retired: ['disposed'],
  disposed: [],
};

export function AssetDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();

  const [asset, setAsset] = useState<Asset | null>(null);
  const [documents, setDocuments] = useState<AssetDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const [statusModal, setStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState<AssetStatus>('available');
  const [savingStatus, setSavingStatus] = useState(false);

  const canManage = user?.role === 'admin' || user?.role === 'asset_manager';

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const [assRes, docRes] = await Promise.all([
        assetsApi.get(Number(id)),
        assetsApi.getDocuments(Number(id))
      ]);
      setAsset(assRes.asset);
      setDocuments(docRes.documents);
    } catch {
      toast.error('Failed to load asset details.');
      navigate('/assets');
    } finally {
      setLoading(false);
    }
  }, [id, navigate, toast]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleStatusChange = async () => {
    if (!asset) return;
    setSavingStatus(true);
    try {
      const res = await assetsApi.update(asset.id, { status: newStatus });
      setAsset(res.asset);
      toast.success('Asset status updated.');
      setStatusModal(false);
    } catch (err) {
      if (err instanceof ApiError) {
        toast.error('Status update failed.', err.message);
      } else {
        toast.error('Status update failed.');
      }
    } finally {
      setSavingStatus(false);
    }
  };

  if (loading) return <div style={{ padding: 'var(--sp-8)' }}><Spinner /></div>;
  if (!asset) return null;

  const allowedNextStates = VALID_TRANSITIONS[asset.status];
  const photos = documents.filter(d => d.doc_type === 'photo');

  return (
    <>
      <div style={{ marginBottom: 'var(--sp-6)' }}>
        <Button variant="ghost" onClick={() => navigate('/assets')}>← Back to Directory</Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--sp-6)' }}>
        <div>
          <h1 style={{ fontSize: 'var(--text-3xl)', fontWeight: 'var(--fw-bold)', color: 'var(--text-primary)' }}>
            {asset.name}
          </h1>
          <div style={{ display: 'flex', gap: 'var(--sp-3)', alignItems: 'center', marginTop: 'var(--sp-2)' }}>
            <span style={{ fontFamily: 'monospace', fontSize: 'var(--text-lg)', color: 'var(--primary)' }}>
              {asset.asset_tag}
            </span>
            <Badge variant={STATUS_BADGE[asset.status]}>{asset.status.replace('_', ' ')}</Badge>
            {asset.is_bookable && <Badge variant="info">Bookable Resource</Badge>}
          </div>
        </div>

        {canManage && allowedNextStates.length > 0 && (
          <Button variant="secondary" onClick={() => { setNewStatus(allowedNextStates[0]); setStatusModal(true); }}>
            Change Status
          </Button>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--sp-6)' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="card">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)' }}>
              Details
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--sp-4)' }}>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Category</div>
                <div style={{ color: 'var(--text-primary)' }}>{asset.category_name}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Location</div>
                <div style={{ color: 'var(--text-primary)' }}>{asset.location || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Serial Number</div>
                <div style={{ color: 'var(--text-primary)' }}>{asset.serial_number || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Condition</div>
                <div style={{ color: 'var(--text-primary)', textTransform: 'capitalize' }}>{asset.condition}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Acquisition Date</div>
                <div style={{ color: 'var(--text-primary)' }}>{asset.acquisition_date || '—'}</div>
              </div>
              <div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Acquisition Cost</div>
                <div style={{ color: 'var(--text-primary)' }}>{asset.acquisition_cost ? `$${asset.acquisition_cost}` : '—'}</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize: 'var(--text-lg)', fontWeight: 'var(--fw-bold)', marginBottom: 'var(--sp-4)' }}>
              Photos
            </h3>
            {photos.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-sm)' }}>No photos uploaded.</p>
            ) : (
              <div style={{ display: 'flex', gap: 'var(--sp-4)', flexWrap: 'wrap' }}>
                {photos.map(p => (
                  <img
                    key={p.id}
                    src={getBackendImageUrl(p.file_path)}
                    alt="Asset"
                    style={{ width: '150px', height: '150px', objectFit: 'cover', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp-6)' }}>
          <div className="card" style={{ textAlign: 'center' }}>
            <h3 style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 'var(--sp-4)' }}>QR Code</h3>
            {asset.qr_code_path ? (
              <img src={getBackendImageUrl(asset.qr_code_path)} alt="QR Code" style={{ width: '100%', maxWidth: '200px', margin: '0 auto' }} />
            ) : (
              <p style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>No QR code available.</p>
            )}
          </div>
        </div>
      </div>

      <Modal
        open={statusModal}
        onClose={() => setStatusModal(false)}
        title="Change Asset Status"
        footer={
          <>
            <Button variant="secondary" onClick={() => setStatusModal(false)}>Cancel</Button>
            <Button variant="primary" loading={savingStatus} onClick={handleStatusChange}>Update Status</Button>
          </>
        }
      >
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--sp-4)' }}>
          Select the new state for this asset.
        </p>
        <Select
          id="new-status"
          label="New Status"
          value={newStatus}
          onChange={e => setNewStatus(e.target.value as AssetStatus)}
          options={allowedNextStates.map(s => ({ value: s, label: s.replace('_', ' ') }))}
        />
      </Modal>
    </>
  );
}
