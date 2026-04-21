import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  optimizeDeps: {
    exclude: ['onnxruntime-web']
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          'ai-libs': ['onnxruntime-web'],
          'canvas': ['konva', 'react-konva'],
          'pdf': ['jspdf', 'jspdf-autotable']
        }
      }
    }
  },
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: true,
    host: host || false,
    hmr: host
      ? { protocol: 'ws', host, port: 5174 }
      : undefined,
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    },
    watch: {
      ignored: ['**/src-tauri/**']
    }
  },
  assetsInclude: ['**/*.wasm'],
  base: process.env.BASE_PATH || '/'
}));
