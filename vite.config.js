import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5000,
    host: '0.0.0.0',
    headers: {
      "Bypass-Tunnel-Reminder": "true"
    },
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'https://fuzzy-space-rotary-phone-r7gv9rqwr97gcp4vj-3001.app.github.dev',
        changeOrigin: true
      },
      '/socket.io': {
        target: 'https://fuzzy-space-rotary-phone-r7gv9rqwr97gcp4vj-3001.app.github.dev',
        ws: true,
        changeOrigin: true
      },
    }
  }
});
