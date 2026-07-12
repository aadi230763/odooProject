/**
 * Sidebar navigation
 *
 * Role-aware: menu items are shown/hidden based on the current user's role.
 * Active item is highlighted via NavLink's `isActive` callback.
 */

import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth, type UserRole } from '../../context/AuthContext';
import { useToast } from '../../hooks/useToast';
import { authApi } from '../../api/auth';

// ── Nav item config ────────────────────────────────────────────────────────────

interface NavItemConfig {
  label: string;
  to: string;
  icon: string;
  /** If specified, only users with at least one of these roles can see this item */
  roles?: UserRole[];
}

interface NavSection {
  section?: string;
  items: NavItemConfig[];
}

const NAV: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: '⬜' },
    ],
  },
  {
    section: 'Assets',
    items: [
      { label: 'Asset Directory', to: '/assets', icon: '📦' },
      { label: 'Allocations', to: '/allocations', icon: '🔗' },
      { label: 'Resource Booking', to: '/bookings', icon: '📅' },
    ],
  },
  {
    section: 'Operations',
    items: [
      { label: 'Maintenance', to: '/maintenance', icon: '🔧' },
      { label: 'Audit Cycles', to: '/audits', icon: '📋' },
    ],
  },
  {
    section: 'Administration',
    items: [
      {
        label: 'Organization Setup',
        to: '/org',
        icon: '🏢',
        roles: ['admin'],
      },
      {
        label: 'Activity Logs',
        to: '/logs',
        icon: '🗒️',
        roles: ['admin', 'asset_manager'],
      },
    ],
  },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function Sidebar() {
  const { user, clearSession, hasRole } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await authApi.logout();
    } catch {
      // non-fatal — JWT is stateless; we clear client-side regardless
    }
    clearSession();
    toast.success('Signed out', 'You have been logged out.');
    navigate('/login', { replace: true });
  };

  // Initials for avatar
  const initials = user?.name
    ? user.name
        .split(' ')
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase()
    : '?';

  const roleLabel: Record<UserRole, string> = {
    admin: 'Administrator',
    asset_manager: 'Asset Manager',
    department_head: 'Department Head',
    employee: 'Employee',
  };

  return (
    <nav className="sidebar" aria-label="Main navigation">
      {/* Logo */}
      <NavLink to="/dashboard" className="sidebar-logo" aria-label="AssetFlow home">
        <div className="sidebar-logo__mark" aria-hidden="true">
          AF
        </div>
        <span className="sidebar-logo__name">
          Asset<span>Flow</span>
        </span>
      </NavLink>

      {/* Nav items */}
      <div className="sidebar-nav">
        {NAV.map((section, si) => {
          const visibleItems = section.items.filter(
            (item) => !item.roles || item.roles.some((r) => hasRole(r)),
          );
          if (visibleItems.length === 0) return null;

          return (
            <React.Fragment key={si}>
              {section.section && (
                <span className="sidebar-section-label">{section.section}</span>
              )}
              {visibleItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                  id={`nav-${item.to.replace('/', '')}`}
                >
                  <span className="nav-icon" aria-hidden="true">
                    {item.icon}
                  </span>
                  {item.label}
                </NavLink>
              ))}
            </React.Fragment>
          );
        })}
      </div>

      {/* User footer */}
      <div className="sidebar-footer">
        <div className="user-card">
          <div className="user-avatar" aria-hidden="true">
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p className="user-name" title={user?.name}>
              {user?.name ?? '—'}
            </p>
            <p className="user-role">{user ? roleLabel[user.role] : ''}</p>
          </div>
          <button
            className="icon-btn"
            onClick={handleLogout}
            title="Sign out"
            aria-label="Sign out"
            id="btn-signout"
          >
            ⏻
          </button>
        </div>
      </div>
    </nav>
  );
}
