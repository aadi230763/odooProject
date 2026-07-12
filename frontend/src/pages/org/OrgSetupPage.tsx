/**
 * Organization Setup page (Phase 4)
 *
 * Three-tab layout:
 *   1. Departments
 *   2. Asset Categories
 *   3. Employee Directory
 *
 * Access is Admin-only (enforced at both the route guard and the backend).
 */

import { useState } from 'react';
import { PageHeader } from '../../components/ui';
import { DepartmentsTab } from './DepartmentsTab';
import { CategoriesTab } from './CategoriesTab';
import { EmployeeDirectoryTab } from './EmployeeDirectoryTab';

type Tab = 'departments' | 'categories' | 'employees';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'departments', label: 'Departments', icon: '🏢' },
  { id: 'categories', label: 'Asset Categories', icon: '🏷️' },
  { id: 'employees', label: 'Employee Directory', icon: '👥' },
];

export function OrgSetupPage() {
  const [activeTab, setActiveTab] = useState<Tab>('departments');

  return (
    <>
      <PageHeader
        title="Organization Setup"
        subtitle="Manage departments, asset categories, and employee roles. Admin-only."
      />

      {/* Tab bar */}
      <div
        role="tablist"
        aria-label="Organization setup sections"
        style={{
          display: 'flex',
          gap: 'var(--sp-1)',
          borderBottom: '1px solid var(--border)',
          marginBottom: 'var(--sp-6)',
        }}
      >
        {TABS.map((tab) => {
          const isActive = tab.id === activeTab;
          return (
            <button
              key={tab.id}
              id={`tab-${tab.id}`}
              role="tab"
              aria-selected={isActive}
              aria-controls={`tabpanel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--sp-2)',
                padding: 'var(--sp-3) var(--sp-4)',
                background: 'none',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--primary)' : '2px solid transparent',
                color: isActive ? 'var(--primary)' : 'var(--text-secondary)',
                fontWeight: isActive ? 'var(--fw-semibold)' : 'var(--fw-medium)',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                transition: 'color var(--t-fast), border-color var(--t-fast)',
                marginBottom: '-1px',
                fontFamily: 'var(--font-sans)',
              }}
            >
              <span aria-hidden="true">{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab panels */}
      <div
        id="tabpanel-departments"
        role="tabpanel"
        aria-labelledby="tab-departments"
        hidden={activeTab !== 'departments'}
      >
        {activeTab === 'departments' && <DepartmentsTab />}
      </div>

      <div
        id="tabpanel-categories"
        role="tabpanel"
        aria-labelledby="tab-categories"
        hidden={activeTab !== 'categories'}
      >
        {activeTab === 'categories' && <CategoriesTab />}
      </div>

      <div
        id="tabpanel-employees"
        role="tabpanel"
        aria-labelledby="tab-employees"
        hidden={activeTab !== 'employees'}
      >
        {activeTab === 'employees' && <EmployeeDirectoryTab />}
      </div>
    </>
  );
}
