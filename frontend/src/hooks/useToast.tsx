/* eslint-disable react-refresh/only-export-components */
/**
 * Toast system
 *
 * - ToastProvider  — wraps the app, renders the toast container
 * - useToast       — hook to push toasts from any component
 * - ToastContainer — the visual renderer (internal)
 *
 * Each toast auto-dismisses after `duration` ms (default 4 s).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ToastVariant = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  variant: ToastVariant;
  title: string;
  message?: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (opts: Omit<Toast, 'id'>) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

// ── Context ────────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ── Icons (inline SVG, no dep) ─────────────────────────────────────────────────

const ICONS: Record<ToastVariant, string> = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ',
};

// ── Individual Toast Item ──────────────────────────────────────────────────────

function ToastItem({
  toast: t,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: (id: string) => void;
}) {
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  const dismiss = useCallback(() => {
    setVisible(false);
    timerRef.current = setTimeout(() => onDismiss(t.id), 300);
  }, [t.id, onDismiss]);

  useEffect(() => {
    const ms = t.duration ?? 4000;
    timerRef.current = setTimeout(dismiss, ms);
    return () => clearTimeout(timerRef.current);
  }, [t.duration, dismiss]);

  return (
    <div
      className={`toast toast--${t.variant}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible
          ? 'translateX(0) scale(1)'
          : 'translateX(24px) scale(0.96)',
        transition: 'opacity 200ms ease, transform 200ms ease',
      }}
      role="alert"
      aria-live="assertive"
    >
      <span className="toast__icon" aria-hidden="true">
        {ICONS[t.variant]}
      </span>
      <div className="toast__body">
        <p className="toast__title">{t.title}</p>
        {t.message && <p className="toast__message">{t.message}</p>}
      </div>
      <button
        className="toast__close"
        onClick={dismiss}
        aria-label="Dismiss notification"
      >
        ✕
      </button>
    </div>
  );
}

// ── Provider ───────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((opts: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    setToasts((prev) => [...prev.slice(-4), { ...opts, id }]); // max 5 visible
  }, []);

  const value: ToastContextValue = {
    toast: push,
    success: (title, message) => push({ variant: 'success', title, message }),
    error: (title, message) => push({ variant: 'error', title, message }),
    warning: (title, message) => push({ variant: 'warning', title, message }),
    info: (title, message) => push({ variant: 'info', title, message }),
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container" aria-label="Notifications">
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>');
  return ctx;
}
