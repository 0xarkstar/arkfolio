import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            rollupOptions: {
              external: ['electron'],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload();
        },
        vite: {
          build: {
            outDir: 'dist-electron',
            lib: {
              formats: ['cjs'],
            },
            rollupOptions: {
              external: ['electron'],
              output: {
                format: 'cjs',
              },
            },
          },
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@electron': resolve(__dirname, 'electron'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-zustand': ['zustand'],
          'vendor-charts': ['lightweight-charts'],
          'vendor-date': ['date-fns'],
          'vendor-decimal': ['decimal.js'],
          // Feature chunks are auto-split by lazy loading
        },
      },
    },
  },
  optimizeDeps: {
    include: ['sql.js'],
  },
  server: {
    port: 5173,
    strictPort: true,
    proxy: {
      '/api/zapper': {
        target: 'https://public.zapper.xyz',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/zapper/, ''),
        secure: true,
      },
    },
  },
});
