/**
 * Shared UI Components — design system primitives.
 *
 * All components reference only tokens from tokens.css; no ad-hoc values.
 * Export everything from a single barrel file for clean imports.
 */

import React, { forwardRef } from 'react';

// ── Button ─────────────────────────────────────────────────────────────────────

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  fullWidth?: boolean;
  loading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      fullWidth = false,
      loading = false,
      leftIcon,
      rightIcon,
      children,
      className = '',
      disabled,
      ...props
    },
    ref,
  ) => {
    const classes = [
      'btn',
      `btn--${variant}`,
      `btn--${size}`,
      fullWidth ? 'btn--full' : '',
      className,
    ]
      .filter(Boolean)
      .join(' ');

    return (
      <button
        ref={ref}
        className={classes}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? (
          <span className="spinner spinner--sm" aria-hidden="true" />
        ) : (
          leftIcon && <span aria-hidden="true">{leftIcon}</span>
        )}
        {children}
        {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
      </button>
    );
  },
);
Button.displayName = 'Button';

// ── Input / Field ──────────────────────────────────────────────────────────────

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, id, className = '', ...props }, ref) => {
    const inputId = id ?? `input-${Math.random().toString(36).slice(2, 7)}`;
    return (
      <div className="field">
        {label && (
          <label className="field-label" htmlFor={inputId}>
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={[
            'field-input',
            error ? 'field-input--error' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-describedby={error ? `${inputId}-error` : undefined}
          aria-invalid={!!error}
          {...props}
        />
        {error && (
          <p id={`${inputId}-error`} className="field-error" role="alert">
            {error}
          </p>
        )}
        {!error && hint && (
          <p className="field-error" style={{ color: 'var(--text-muted)' }}>
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

// ── Badge ──────────────────────────────────────────────────────────────────────

type BadgeVariant =
  'success' | 'warning' | 'danger' | 'info' | 'primary' | 'muted';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
}

export function Badge({
  variant = 'muted',
  children,
  className = '',
}: BadgeProps) {
  return (
    <span
      className={`badge badge--${variant} ${className}`}
      aria-label={`Status: ${children}`}
    >
      {children}
    </span>
  );
}

// ── Spinner ────────────────────────────────────────────────────────────────────

type SpinnerSize = 'xs' | 'sm' | 'md' | 'lg';

interface SpinnerProps {
  size?: SpinnerSize;
  className?: string;
  label?: string;
}

export function Spinner({
  size = 'md',
  className = '',
  label = 'Loading…',
}: SpinnerProps) {
  return (
    <span
      className={`spinner spinner--${size} ${className}`}
      role="status"
      aria-label={label}
    />
  );
}

// ── Card ───────────────────────────────────────────────────────────────────────

interface CardProps {
  glass?: boolean;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Card({
  glass = false,
  children,
  className = '',
  style,
}: CardProps) {
  return (
    <div
      className={`card ${glass ? 'card--glass' : ''} ${className}`}
      style={style}
    >
      {children}
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────────────────────────────

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: React.ReactNode;
}

export function Modal({
  open,
  onClose,
  title,
  children,
  size = 'md',
  footer,
}: ModalProps) {
  // Close on Escape
  React.useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: '400px', md: '560px', lg: '720px' };

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'var(--bg-overlay)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000,
        padding: 'var(--sp-6)',
        animation: 'toast-in 200ms ease both',
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: widths[size],
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--sp-5)',
          maxHeight: '90vh',
          overflowY: 'auto',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <h2
            id="modal-title"
            style={{
              fontSize: 'var(--text-lg)',
              fontWeight: 'var(--fw-semibold)',
              color: 'var(--text-primary)',
            }}
          >
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close modal"
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              fontSize: '1.25rem',
              lineHeight: 1,
              padding: 'var(--sp-1)',
              borderRadius: 'var(--radius-sm)',
              transition: 'color var(--t-fast)',
            }}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div>{children}</div>

        {/* Footer */}
        {footer && (
          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--sp-3)',
              borderTop: '1px solid var(--border)',
              paddingTop: 'var(--sp-4)',
              marginTop: 'var(--sp-1)',
            }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Table ──────────────────────────────────────────────────────────────────────

interface Column<T> {
  key: string;
  header: string;
  render: (row: T, index: number) => React.ReactNode;
  width?: string;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (row: T) => string;
  loading?: boolean;
  empty?: React.ReactNode;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  loading,
  empty,
}: TableProps<T>) {
  return (
    <div style={{ overflowX: 'auto', borderRadius: 'var(--radius-xl)' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 'var(--text-sm)',
        }}
      >
        <thead>
          <tr
            style={{
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--border)',
            }}
          >
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: 'var(--sp-3) var(--sp-4)',
                  textAlign: 'left',
                  fontWeight: 'var(--fw-semibold)',
                  color: 'var(--text-muted)',
                  fontSize: 'var(--text-xs)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                  width: col.width,
                  whiteSpace: 'nowrap',
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{ padding: 'var(--sp-10)', textAlign: 'center' }}
              >
                <Spinner label="Loading table data" />
              </td>
            </tr>
          ) : data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: 'var(--sp-10)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                {empty ?? 'No records found.'}
              </td>
            </tr>
          ) : (
            data.map((row, i) => (
              <tr
                key={keyExtractor(row)}
                style={{
                  borderBottom: '1px solid var(--border)',
                  transition: 'background var(--t-fast)',
                }}
                onMouseEnter={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    'var(--bg-surface-2)')
                }
                onMouseLeave={(e) =>
                  ((e.currentTarget as HTMLElement).style.background =
                    'transparent')
                }
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: 'var(--sp-3) var(--sp-4)',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {col.render(row, i)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

// ── Select ─────────────────────────────────────────────────────────────────────

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    { label, error, options, placeholder, id, className = '', ...props },
    ref,
  ) => {
    const selectId = id ?? `select-${Math.random().toString(36).slice(2, 7)}`;
    return (
      <div className="field">
        {label && (
          <label className="field-label" htmlFor={selectId}>
            {label}
          </label>
        )}
        <select
          ref={ref}
          id={selectId}
          className={[
            'field-input',
            error ? 'field-input--error' : '',
            className,
          ]
            .filter(Boolean)
            .join(' ')}
          aria-invalid={!!error}
          style={{ cursor: 'pointer' }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  },
);
Select.displayName = 'Select';

// ── Divider ────────────────────────────────────────────────────────────────────

export function Divider({ label }: { label?: string }) {
  return <div className="divider">{label}</div>;
}

// ── Page wrapper ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions }: PageHeaderProps) {
  return (
    <div
      className="page-header"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 'var(--sp-4)',
        flexWrap: 'wrap',
      }}
    >
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && (
        <div style={{ display: 'flex', gap: 'var(--sp-3)', flexShrink: 0 }}>
          {actions}
        </div>
      )}
    </div>
  );
}

// ── ErrorBoundary ──────────────────────────────────────────────────────────────

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: {
    children: React.ReactNode;
    fallback?: React.ReactNode;
  }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'var(--sp-4)',
            padding: 'var(--sp-8)',
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: '3rem' }}>⚠️</div>
          <h1
            style={{
              fontSize: 'var(--text-2xl)',
              color: 'var(--text-primary)',
            }}
          >
            Something went wrong
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '480px' }}>
            An unexpected error occurred. Please refresh the page or contact
            support if the problem persists.
          </p>
          <button
            className="btn btn--primary btn--md"
            onClick={() => window.location.reload()}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
