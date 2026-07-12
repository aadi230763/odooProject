import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the Flask backend in development.
    //
    // IMPORTANT: Use 127.0.0.1 (not localhost).
    // On Windows, "localhost" resolves to ::1 (IPv6), but Flask's default
    // dev server binds to 127.0.0.1 (IPv4) only. Using the IP literal
    // guarantees the proxy always reaches Flask regardless of OS DNS config.
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
    },
  },
});

