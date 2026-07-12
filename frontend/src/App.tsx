import { useEffect, useState } from 'react';

/**
 * Phase 0 "hello world" screen.
 *
 * Proves the React app boots and can reach the Flask backend's health
 * endpoint through the Vite dev proxy. Replaced by the real app shell and
 * design system in Phase 3.
 */
function App() {
  const [status, setStatus] = useState<'checking' | 'ok' | 'down'>('checking');

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((body) => setStatus(body?.data?.status === 'ok' ? 'ok' : 'down'))
      .catch(() => setStatus('down'));
  }, []);

  return (
    <main className="app-shell">
      <h1>AssetFlow</h1>
      <p>Enterprise Asset &amp; Resource Management System</p>
      <p className={`backend-status backend-status--${status}`}>
        Backend:{' '}
        {status === 'checking'
          ? 'checking…'
          : status === 'ok'
            ? 'connected ✓'
            : 'unreachable ✗'}
      </p>
    </main>
  );
}

export default App;
