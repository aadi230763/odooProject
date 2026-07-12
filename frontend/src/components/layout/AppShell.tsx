/**
 * AppShell
 *
 * The authenticated layout wrapper.
 * Renders:  sidebar (left) | topbar (top-right) | main content (right)
 * using the CSS grid defined in index.css (.shell).
 */

import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';

export function AppShell() {
  return (
    <div className="shell">
      <Sidebar />
      <Topbar />
      <main className="main-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
}
