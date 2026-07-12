/**
 * 404 Not Found page
 */

import { Link } from 'react-router-dom';

export function NotFoundPage() {
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
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          fontSize: '6rem',
          fontWeight: 'var(--fw-bold)',
          color: 'var(--primary)',
          letterSpacing: '-0.05em',
          lineHeight: 1,
        }}
      >
        404
      </div>
      <h1 style={{ fontSize: 'var(--text-2xl)', color: 'var(--text-primary)' }}>
        Page not found
      </h1>
      <p style={{ color: 'var(--text-secondary)', maxWidth: '380px', fontSize: 'var(--text-sm)' }}>
        The page you&apos;re looking for doesn&apos;t exist or you don&apos;t have permission to view it.
      </p>
      <Link to="/dashboard" className="btn btn--primary btn--md" id="link-back-home">
        Go to Dashboard
      </Link>
    </div>
  );
}
