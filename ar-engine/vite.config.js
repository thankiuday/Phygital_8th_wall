import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      input: { main: './index.html' },
    },
  },
  server: {
    port: 5174,
    host: true, // expose on LAN so mobile devices can connect
    https: false, // in production HTTPS is required for camera access
  },
  optimizeDeps: {
    include: ['gsap'],
  },
});
