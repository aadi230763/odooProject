import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  bookingsApi,
  type Booking,
  type BookingStatus,
} from '../../api/bookings';
import { assetsApi, type Asset } from '../../api/assets';
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

const STATUS_BADGE: Record<
  BookingStatus,
  'success' | 'primary' | 'warning' | 'danger' | 'info' | 'muted'
> = {
  upcoming: 'info',
  ongoing: 'primary',
  completed: 'success',
  cancelled: 'muted',
};

function formatSlot(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function BookingsPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const { user } = useAuth();

  // ── List State ─────────────────────────────────────────────
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  // ── Bookable Assets ────────────────────────────────────────
  const [bookableAssets, setBookableAssets] = useState<Asset[]>([]);

  // ── Create Modal ───────────────────────────────────────────
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    resource_asset_id: '',
    date: '',
    start_time: '',
    end_time: '',
  });
  const [createSaving, setCreateSaving] = useState(false);

  // ── Reschedule Modal ───────────────────────────────────────
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleBooking, setRescheduleBooking] = useState<Booking | null>(
    null,
  );
  const [rescheduleForm, setRescheduleForm] = useState({
    date: '',
    start_time: '',
    end_time: '',
  });
  const [rescheduleSaving, setRescheduleSaving] = useState(false);

  // ── Calendar View ──────────────────────────────────────────
  const [calendarAssetId, setCalendarAssetId] = useState('');
  const [calendarBookings, setCalendarBookings] = useState<Booking[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(false);

  // ── Data Loading ───────────────────────────────────────────

  const loadBookings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await bookingsApi.list({
        status: statusFilter || undefined,
      });
      setBookings(res.bookings);
    } catch {
      toast.error('Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, toast]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const loadCalendar = useCallback(async () => {
    if (!calendarAssetId) {
      setCalendarBookings([]);
      return;
    }
    setCalendarLoading(true);
    try {
      const res = await bookingsApi.getForAsset(Number(calendarAssetId));
      setCalendarBookings(res.bookings);
    } catch {
      toast.error('Failed to load calendar.');
    } finally {
      setCalendarLoading(false);
    }
  }, [calendarAssetId, toast]);

  useEffect(() => {
    loadCalendar();
  }, [loadCalendar]);

  // ── Actions ────────────────────────────────────────────────

  const openCreateModal = async () => {
    try {
      const res = await assetsApi.list();
      setBookableAssets(res.assets.filter((a) => a.is_bookable));
      setCreateForm({
        resource_asset_id: '',
        date: '',
        start_time: '',
        end_time: '',
      });
      setShowCreateModal(true);
    } catch {
      toast.error('Failed to load bookable assets.');
    }
  };

  const handleCreate = async () => {
    const { resource_asset_id, date, start_time, end_time } = createForm;
    if (!resource_asset_id || !date || !start_time || !end_time) {
      toast.error('All fields are required.');
      return;
    }
    setCreateSaving(true);
    try {
      await bookingsApi.create({
        resource_asset_id: Number(resource_asset_id),
        start_time: new Date(`${date}T${start_time}`).toISOString(),
        end_time: new Date(`${date}T${end_time}`).toISOString(),
      });
      toast.success('Booking created.');
      setShowCreateModal(false);
      loadBookings();
      loadCalendar();
    } catch (err) {
      toast.error(
        'Booking failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setCreateSaving(false);
    }
  };

  const handleCancel = async (id: number) => {
    try {
      await bookingsApi.cancel(id);
      toast.success('Booking cancelled.');
      loadBookings();
      loadCalendar();
    } catch (err) {
      toast.error(
        'Cancel failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const openReschedule = (b: Booking) => {
    setRescheduleBooking(b);
    const startDt = new Date(b.start_time);
    const endDt = new Date(b.end_time);
    setRescheduleForm({
      date: startDt.toISOString().split('T')[0],
      start_time: startDt.toTimeString().slice(0, 5),
      end_time: endDt.toTimeString().slice(0, 5),
    });
    setShowRescheduleModal(true);
  };

  const handleReschedule = async () => {
    if (!rescheduleBooking) return;
    const { date, start_time, end_time } = rescheduleForm;
    if (!date || !start_time || !end_time) {
      toast.error('All fields are required.');
      return;
    }
    setRescheduleSaving(true);
    try {
      await bookingsApi.reschedule(rescheduleBooking.id, {
        start_time: new Date(`${date}T${start_time}`).toISOString(),
        end_time: new Date(`${date}T${end_time}`).toISOString(),
      });
      toast.success('Booking rescheduled.');
      setShowRescheduleModal(false);
      setRescheduleBooking(null);
      loadBookings();
      loadCalendar();
    } catch (err) {
      toast.error(
        'Reschedule failed.',
        err instanceof ApiError ? err.message : undefined,
      );
    } finally {
      setRescheduleSaving(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────

  return (
    <>
      <PageHeader
        title="Resource Booking"
        subtitle="Book time-slots on shared, bookable resources."
        actions={
          <Button variant="primary" onClick={openCreateModal}>
            + New Booking
          </Button>
        }
      />

      {/* Calendar Strip */}
      <div className="card" style={{ marginBottom: 'var(--sp-6)' }}>
        <h3
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 'var(--fw-semibold)',
            color: 'var(--text-muted)',
            marginBottom: 'var(--sp-3)',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
          }}
        >
          Resource Calendar
        </h3>
        <div
          style={{
            display: 'flex',
            gap: 'var(--sp-3)',
            alignItems: 'end',
            marginBottom: 'var(--sp-4)',
          }}
        >
          <Select
            id="cal-asset"
            label="Select Resource"
            value={calendarAssetId}
            onChange={(e) => setCalendarAssetId(e.target.value)}
            options={[
              { value: '', label: 'Choose a resource...' },
              ...bookableAssets.map((a) => ({
                value: String(a.id),
                label: `${a.asset_tag} — ${a.name}`,
              })),
            ]}
          />
          {!bookableAssets.length && (
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                try {
                  const res = await assetsApi.list();
                  setBookableAssets(res.assets.filter((a) => a.is_bookable));
                } catch {
                  /* ignore */
                }
              }}
            >
              Load Resources
            </Button>
          )}
        </div>

        {calendarAssetId &&
          (calendarLoading ? (
            <Spinner size="sm" label="Loading calendar" />
          ) : calendarBookings.length === 0 ? (
            <p
              style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}
            >
              No bookings for this resource.
            </p>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 'var(--sp-2)',
              }}
            >
              {calendarBookings.map((b) => (
                <div
                  key={b.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 'var(--sp-2) var(--sp-3)',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-2)',
                    fontSize: 'var(--text-sm)',
                  }}
                >
                  <div>
                    <span
                      style={{
                        fontWeight: 'var(--fw-medium)',
                        color: 'var(--text-primary)',
                      }}
                    >
                      {formatSlot(b.start_time)} → {formatSlot(b.end_time)}
                    </span>
                    <span
                      style={{
                        color: 'var(--text-muted)',
                        marginLeft: 'var(--sp-2)',
                      }}
                    >
                      by {b.booked_by_name}
                    </span>
                  </div>
                  <Badge variant={STATUS_BADGE[b.status]}>{b.status}</Badge>
                </div>
              ))}
            </div>
          ))}
      </div>

      {/* Bookings Table */}
      <div
        style={{
          display: 'flex',
          gap: 'var(--sp-3)',
          marginBottom: 'var(--sp-4)',
          maxWidth: '250px',
        }}
      >
        <Select
          id="booking-status-filter"
          label="Filter by Status"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          options={[
            { value: '', label: 'All' },
            { value: 'upcoming', label: 'Upcoming' },
            { value: 'ongoing', label: 'Ongoing' },
            { value: 'completed', label: 'Completed' },
            { value: 'cancelled', label: 'Cancelled' },
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
          `${bookings.length} booking${bookings.length !== 1 ? 's' : ''}`
        )}
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <Table
          loading={loading}
          keyExtractor={(b) => String(b.id)}
          data={bookings}
          empty="No bookings found."
          columns={[
            {
              key: 'asset',
              header: 'Resource',
              render: (b) => (
                <div>
                  <strong
                    style={{ color: 'var(--primary)', cursor: 'pointer' }}
                    onClick={() => navigate(`/assets/${b.resource_asset_id}`)}
                  >
                    {b.asset_tag}
                  </strong>
                  <div
                    style={{
                      fontSize: 'var(--text-xs)',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {b.asset_name}
                  </div>
                </div>
              ),
            },
            {
              key: 'slot',
              header: 'Time Slot',
              render: (b) => (
                <div style={{ fontSize: 'var(--text-sm)' }}>
                  <div>{formatSlot(b.start_time)}</div>
                  <div style={{ color: 'var(--text-muted)' }}>
                    → {formatSlot(b.end_time)}
                  </div>
                </div>
              ),
            },
            {
              key: 'bookedBy',
              header: 'Booked By',
              render: (b) => <span>{b.booked_by_name || '—'}</span>,
            },
            {
              key: 'status',
              header: 'Status',
              render: (b) => (
                <Badge variant={STATUS_BADGE[b.status]}>{b.status}</Badge>
              ),
            },
            {
              key: 'actions',
              header: '',
              width: '180px',
              render: (b: Booking) => {
                if (b.status === 'completed' || b.status === 'cancelled')
                  return null;
                const isOwner = String(b.booked_by) === String(user?.id);
                const isManager =
                  user?.role === 'admin' || user?.role === 'asset_manager';
                if (!isOwner && !isManager) return null;
                return (
                  <div style={{ display: 'flex', gap: 'var(--sp-2)' }}>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => openReschedule(b)}
                    >
                      Reschedule
                    </Button>
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleCancel(b.id)}
                    >
                      Cancel
                    </Button>
                  </div>
                );
              },
            },
          ]}
        />
      </div>

      {/* ── Create Modal ────────────────────────────────────────── */}
      <Modal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="New Booking"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowCreateModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={createSaving}
              onClick={handleCreate}
            >
              Book
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
            id="book-asset"
            label="Resource"
            required
            value={createForm.resource_asset_id}
            onChange={(e) =>
              setCreateForm({
                ...createForm,
                resource_asset_id: e.target.value,
              })
            }
            options={[
              { value: '', label: 'Select a bookable resource...' },
              ...bookableAssets.map((a) => ({
                value: String(a.id),
                label: `${a.asset_tag} — ${a.name}`,
              })),
            ]}
          />
          <Input
            id="book-date"
            label="Date"
            type="date"
            required
            value={createForm.date}
            onChange={(e) =>
              setCreateForm({ ...createForm, date: e.target.value })
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
              id="book-start"
              label="Start Time"
              type="time"
              required
              value={createForm.start_time}
              onChange={(e) =>
                setCreateForm({ ...createForm, start_time: e.target.value })
              }
            />
            <Input
              id="book-end"
              label="End Time"
              type="time"
              required
              value={createForm.end_time}
              onChange={(e) =>
                setCreateForm({ ...createForm, end_time: e.target.value })
              }
            />
          </div>
        </div>
      </Modal>

      {/* ── Reschedule Modal ────────────────────────────────────── */}
      <Modal
        open={showRescheduleModal}
        onClose={() => setShowRescheduleModal(false)}
        title="Reschedule Booking"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowRescheduleModal(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              loading={rescheduleSaving}
              onClick={handleReschedule}
            >
              Reschedule
            </Button>
          </>
        }
      >
        {rescheduleBooking && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 'var(--sp-4)',
            }}
          >
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              Rescheduling booking for{' '}
              <strong>{rescheduleBooking.asset_tag}</strong> (
              {rescheduleBooking.asset_name}).
            </p>
            <Input
              id="resched-date"
              label="New Date"
              type="date"
              required
              value={rescheduleForm.date}
              onChange={(e) =>
                setRescheduleForm({ ...rescheduleForm, date: e.target.value })
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
                id="resched-start"
                label="Start Time"
                type="time"
                required
                value={rescheduleForm.start_time}
                onChange={(e) =>
                  setRescheduleForm({
                    ...rescheduleForm,
                    start_time: e.target.value,
                  })
                }
              />
              <Input
                id="resched-end"
                label="End Time"
                type="time"
                required
                value={rescheduleForm.end_time}
                onChange={(e) =>
                  setRescheduleForm({
                    ...rescheduleForm,
                    end_time: e.target.value,
                  })
                }
              />
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}
