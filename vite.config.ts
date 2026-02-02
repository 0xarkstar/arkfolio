import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import electron from 'vite-plugin-electron';
import renderer from 'vite-plugin-electron-renderer';
import { nodePolyfills } from 'vite-plugin-node-polyfills';
import { visualizer } from 'rollup-plugin-visualizer';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    // Node.js polyfills for Web3 libraries (buffer, process, events, etc.)
    nodePolyfills({
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Exclude ccxt and problematic modules
      exclude: ['net', 'dns', 'tls', 'fs', 'child_process'],
    }),
    // Bundle analysis - generates stats.html when building
    visualizer({
      filename: 'dist/stats.html',
      open: false,
      gzipSize: true,
      brotliSize: true,
    }),
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
      // Polyfill for node:net (needed by CCXT's node-fetch)
      'node:net': resolve(__dirname, 'src/polyfills/net-polyfill.ts'),
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      },
      // Externalize Node.js native modules that can't be bundled
      external: [
        'pd-aio-sdk',
        'koffi',
      ],
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom'],
          'vendor-zustand': ['zustand'],
          'vendor-charts': ['lightweight-charts'],
          'vendor-date': ['date-fns'],
          'vendor-decimal': ['decimal.js'],
          'vendor-i18n': ['i18next', 'react-i18next'],
          // CCXT is large - keep it separate for lazy loading
          'vendor-ccxt': ['ccxt'],
          // Feature chunks are auto-split by lazy loading
        },
      },
    },
  },
  optimizeDeps: {
    include: ['sql.js'],
    exclude: ['pd-aio-sdk', 'koffi'],
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
