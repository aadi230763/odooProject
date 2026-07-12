import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { notificationsApi, type AppNotification } from '../../api/dashboard';
import { Badge, Button, PageHeader, Spinner } from '../../components/ui';
import { useToast } from '../../hooks/useToast';
import { ApiError } from '../../api/client';

// ── Notification type → icon + label ──────────────────────────────────────────

const TYPE_META: Record<string, { icon: string; label: string }> = {
  asset_allocated: { icon: '🔗', label: 'Asset Allocated' },
  maintenance_raised: { icon: '🔧', label: 'Maintenance Raised' },
  maintenance_approved: { icon: '✅', label: 'Maintenance Approved' },
  maintenance_rejected: { icon: '❌', label: 'Maintenance Rejected' },
  maintenance_resolved: { icon: '✅', label: 'Maintenance Resolved' },
  booking_confirmed: { icon: '📅', label: 'Booking Confirmed' },
  booking_cancelled: { icon: '📅', label: 'Booking Cancelled' },
  booking_reminder: { icon: '⏰', label: 'Booking Reminder' },
  transfer_requested: { icon: '🔄', label: 'Transfer Requested' },
  transfer_approved: { icon: '🔄', label: 'Transfer Approved' },
  transfer_rejected: { icon: '🔄', label: 'Transfer Rejected' },
  return_overdue: { icon: '⚠️', label: 'Overdue Return' },
  audit_discrepancy: { icon: '📋', label: 'Audit Discrepancy' },
};

function typeMeta(type: string) {
  return TYPE_META[type] ?? { icon: '🔔', label: type.replace(/_/g, ' ') };
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHrs = Math.floor(diffMins / 60);
  if (diffHrs < 24) return `${diffHrs}h ago`;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NotificationsPage() {
  const toast = useToast();
  const navigate = useNavigate();

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await notificationsApi.list({ unread_only: unreadOnly });
      setNotifications(res.notifications);
      setUnreadCount(res.unread_count);
    } catch {
      toast.error('Failed to load notifications.');
    } finally {
      setLoading(false);
    }
  }, [unreadOnly, toast]);

  useEffect(() => {
    loadNotifications();
  }, [loadNotifications]);

  const handleMarkRead = async (n: AppNotification) => {
    if (n.is_read) return;
    try {
      await notificationsApi.markRead(n.id);
      setNotifications((prev) =>
        prev.map((x) => (x.id === n.id ? { ...x, is_read: true } : x)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      toast.error(
        'Failed to mark as read.',
        err instanceof ApiError ? err.message : undefined,
      );
    }
  };

  const handleMarkAll = async () => {
    setMarkingAll(true);
    try {
      await notificationsApi.markAllRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
      toast.success('All notifications marked as read.');
    } catch {
      toast.error('Failed to mark all as read.');
    } finally {
      setMarkingAll(false);
    }
  };

  const handleClick = (n: AppNotification) => {
    handleMarkRead(n);
    if (n.related_entity_type && n.related_entity_id) {
      const routes: Record<string, string> = {
        allocation: '/allocations',
        maintenance_request: '/maintenance',
        booking: '/bookings',
        transfer_request: '/allocations',
        audit_cycle: '/audits',
        asset: `/assets/${n.related_entity_id}`,
      };
      const path = routes[n.related_entity_type];
      if (path) navigate(path);
    }
  };

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Stay up to date on asset activity, approvals, and reminders."
        actions={
          <div
            style={{
              display: 'flex',
              gap: 'var(--sp-2)',
              alignItems: 'center',
            }}
          >
            {unreadCount > 0 && (
              <Badge variant="danger">{unreadCount} unread</Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setUnreadOnly((v) => !v)}
            >
              {unreadOnly ? 'Show All' : 'Unread Only'}
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="secondary"
                size="sm"
                loading={markingAll}
                onClick={handleMarkAll}
              >
                Mark All Read
              </Button>
            )}
          </div>
        }
      />

      {loading ? (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            padding: 'var(--sp-10)',
          }}
        >
          <Spinner size="md" label="Loading notifications…" />
        </div>
      ) : notifications.length === 0 ? (
        <div
          className="card"
          style={{
            textAlign: 'center',
            padding: 'var(--sp-10)',
            color: 'var(--text-muted)',
          }}
        >
          <div style={{ fontSize: '2.5rem', marginBottom: 'var(--sp-3)' }}>
            🔔
          </div>
          <p style={{ fontSize: 'var(--text-sm)' }}>
            {unreadOnly ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {notifications.map((n, idx) => {
            const meta = typeMeta(n.type);
            return (
              <div
                key={n.id}
                onClick={() => handleClick(n)}
                style={{
                  display: 'flex',
                  gap: 'var(--sp-4)',
                  padding: 'var(--sp-4) var(--sp-5)',
                  borderBottom:
                    idx < notifications.length - 1
                      ? '1px solid var(--border)'
                      : undefined,
                  background: n.is_read
                    ? 'transparent'
                    : 'rgba(59,130,246,0.04)',
                  cursor: 'pointer',
                  transition: 'background 150ms',
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.background = 'var(--bg-surface-2)')
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.background = n.is_read
                    ? 'transparent'
                    : 'rgba(59,130,246,0.04)')
                }
              >
                {/* Unread dot */}
                <div style={{ paddingTop: 'var(--sp-1)', flexShrink: 0 }}>
                  <div
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: n.is_read ? 'transparent' : 'var(--primary)',
                      marginTop: '4px',
                    }}
                  />
                </div>

                {/* Icon */}
                <div
                  style={{ fontSize: '1.25rem', flexShrink: 0, lineHeight: 1 }}
                >
                  {meta.icon}
                </div>

                {/* Body */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'baseline',
                      gap: 'var(--sp-3)',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        fontWeight: 'var(--fw-semibold)',
                        color: 'var(--text-muted)',
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                      }}
                    >
                      {meta.label}
                    </span>
                    <span
                      style={{
                        fontSize: 'var(--text-xs)',
                        color: 'var(--text-muted)',
                        flexShrink: 0,
                      }}
                    >
                      {fmtTime(n.created_at)}
                    </span>
                  </div>
                  <p
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: n.is_read
                        ? 'var(--text-secondary)'
                        : 'var(--text-primary)',
                      fontWeight: n.is_read ? undefined : 'var(--fw-medium)',
                      marginTop: 'var(--sp-1)',
                      lineHeight: 1.5,
                    }}
                  >
                    {n.message}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
