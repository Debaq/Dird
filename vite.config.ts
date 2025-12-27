import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'logo-default.svg', 'locales/**/*.json'],
      manifest: {
        name: 'DIRD - Diabetic Retinopathy Detection',
        short_name: 'DIRD',
        description: 'Privacy-first AI-powered retinopathy analysis',
        theme_color: '#20B5AE',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 30 * 1024 * 1024, // 30 MB
        // Limpiar caches antiguas automáticamente
        cleanupOutdatedCaches: true,
        // Activar nuevo SW inmediatamente y tomar control de clientes
        skipWaiting: true,
        clientsClaim: true,
        // Excluir version.json del precaching (debe obtenerse siempre fresco)
        globIgnores: ['**/version.json'],
        runtimeCaching: [
          // version.json: siempre obtener versión fresca de la red
          {
            urlPattern: /version\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'version-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxAgeSeconds: 60 // Solo cachear 1 minuto como fallback
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Modelos ONNX: CacheFirst con revalidación periódica
          {
            urlPattern: /\.onnx$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ai-models-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // WASM: CacheFirst con revalidación
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          // Traducciones: NetworkFirst para tener versiones actualizadas
          {
            urlPattern: /locales\/.*\.json$/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'locales-cache',
              networkTimeoutSeconds: 3,
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 días
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          }
        ]
      }
    })
  ],
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
        manualChunks: (id) => {
          // React core libraries
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react-vendor';
          }

          // Router
          if (id.includes('node_modules/react-router-dom') || id.includes('node_modules/@remix-run')) {
            return 'router';
          }

          // Database
          if (id.includes('node_modules/dexie')) {
            return 'database';
          }

          // State management
          if (id.includes('node_modules/zustand')) {
            return 'state';
          }

          // i18n
          if (id.includes('node_modules/i18next') || id.includes('node_modules/react-i18next')) {
            return 'i18n';
          }

          // UI Components (Radix UI)
          if (id.includes('node_modules/@radix-ui')) {
            return 'ui-components';
          }

          // Icons
          if (id.includes('node_modules/lucide-react')) {
            return 'icons';
          }

          // Animations
          if (id.includes('node_modules/framer-motion')) {
            return 'animations';
          }

          // AI libs (ONNX)
          if (id.includes('node_modules/onnxruntime-web')) {
            return 'ai-libs';
          }

          // Canvas
          if (id.includes('node_modules/konva') || id.includes('node_modules/react-konva')) {
            return 'canvas';
          }

          // PDF
          if (id.includes('node_modules/jspdf') || id.includes('node_modules/html2canvas')) {
            return 'pdf';
          }

          // Other vendor code
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },
    // Increase chunk size warning limit since we're now properly splitting
    chunkSizeWarningLimit: 600
  },
  server: {
    headers: {
      'Cross-Origin-Embedder-Policy': 'credentialless',
      'Cross-Origin-Opener-Policy': 'same-origin'
    }
  },
  assetsInclude: ['**/*.wasm'],
  base: mode === 'production' ? '/dird/' : '/',
}));
