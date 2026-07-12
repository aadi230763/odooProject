/**
 * Topbar
 *
 * Renders the page title (derived from the current route) and action icons
 * (notifications bell, user avatar shortcut).
 */

import { useLocation } from 'react-router-dom';

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

  // Match by prefix so nested routes keep the right title
  const title =
    Object.entries(ROUTE_TITLES).find(([route]) => pathname.startsWith(route))?.[1] ??
    'AssetFlow';

  return (
    <header className="topbar" role="banner">
      <h2 className="topbar-title">{title}</h2>

      <div className="topbar-actions">
        <button
          className="icon-btn"
          title="Notifications"
          aria-label="View notifications"
          id="btn-notifications"
        >
          🔔
        </button>
      </div>
    </header>
  );
}
