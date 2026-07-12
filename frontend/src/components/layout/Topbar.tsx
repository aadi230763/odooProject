/**
 * Topbar — Phase 10 update: live unread notification badge + navigation.
 */

import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { notificationsApi } from '../../api/dashboard';

const ROUTE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/assets': 'Asset Directory',
  '/allocations': 'Allocations',
  '/bookings': 'Resource Booking',
  '/maintenance': 'Maintenance',
  '/audits': 'Audit Cycles',
  '/org': 'Organization Setup',
  '/logs': 'Activity Logs',
  '/notifications': 'Notifications',
};

export function Topbar() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  // Poll unread count every 60 s
  useEffect(() => {
    let mounted = true;
    const fetch = () =>
      notificationsApi
        .unreadCount()
        .then((r) => {
          if (mounted) setUnread(r.unread_count);
        })
        .catch(() => {
          /* silent */
        });

    fetch();
    const timer = setInterval(fetch, 60_000);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);

  // Reset badge when user visits the notifications page
  useEffect(() => {
    if (pathname === '/notifications') setUnread(0);
  }, [pathname]);

  const title =
    Object.entries(ROUTE_TITLES).find(([route]) =>
      pathname.startsWith(route),
    )?.[1] ?? 'AssetFlow';

  return (
    <header className="topbar" role="banner">
      <h2 className="topbar-title">{title}</h2>

      <div className="topbar-actions">
        <button
          className="icon-btn"
          title="Notifications"
          aria-label={`View notifications${unread > 0 ? ` (${unread} unread)` : ''}`}
          id="btn-notifications"
          onClick={() => navigate('/notifications')}
          style={{ position: 'relative' }}
        >
          🔔
          {unread > 0 && (
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                top: '2px',
                right: '2px',
                minWidth: '16px',
                height: '16px',
                borderRadius: '999px',
                background: 'var(--danger)',
                color: '#fff',
                fontSize: '10px',
                fontWeight: 700,
                lineHeight: '16px',
                textAlign: 'center',
                padding: '0 3px',
                pointerEvents: 'none',
              }}
            >
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>
      </div>
    </header>
  );
}
