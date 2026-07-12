/**
 * App root
 *
 * Wraps the entire application in:
 *  - BrowserRouter       — HTML5 history-based routing
 *  - AuthProvider        — JWT session state + helpers
 *  - ToastProvider       — global toast/notification system
 *  - ErrorBoundary       — catch unexpected runtime errors, never blank screen
 *
 * The actual page routing lives in <AppRouter>.
 */

import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './hooks/useToast';
import { ErrorBoundary } from './components/ui';
import { AppRouter } from './router';

function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <AuthProvider>
          <ToastProvider>
            <AppRouter />
          </ToastProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}

export default App;
