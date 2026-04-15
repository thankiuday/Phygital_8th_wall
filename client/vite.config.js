import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    // Deduplicate React so only one copy is bundled (monorepo safety)
    dedupe: ['react', 'react-dom', 'react-router-dom'],
  },
  // Force pre-bundle packages hoisted to root node_modules
  optimizeDeps: {
    include: ['react', 'react-dom', 'react-dom/client', 'react-is'],
  },
  server: {
    port: 5173,
    // Proxy API calls to backend during local dev — no CORS issues
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // Split heavy vendor chunks for better caching (must be a function in Vite 8+)
        manualChunks: (id) => {
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router-dom')) {
            return 'vendor';
          }
          if (id.includes('node_modules/framer-motion')) return 'motion';
          if (id.includes('node_modules/recharts')) return 'charts';
        },
      },
    },
  },
});
