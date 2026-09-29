import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// The Java server serves the build output from the classpath (target/classes/webapp).
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../target/classes/webapp',
    emptyOutDir: true,
    chunkSizeWarningLimit: 1500,
  },
  server: {
    proxy: {
      '/api': { target: 'http://localhost:8080', changeOrigin: true },
    },
  },
});
