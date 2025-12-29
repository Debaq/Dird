import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
                                           VitePWA({
                                             registerType: 'autoUpdate',
                                             includeAssets: ['logo.svg', 'logo-default.svg', 'locales/**/*.json', 'clinical-guidelines/**/*.json'],
      manifest: {
        name: 'DIRD+ - Diabetic Retinopathy & DMAE Detection',
        short_name: 'DIRD+',
        description: 'AI-powered detection of Diabetic Retinopathy and Age-related Macular Degeneration',
        theme_color: '#ffffff',
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
                                                 },
                                                 // Clinical Guidelines: NetworkFirst para tener versiones actualizadas
                                                 {
                                                   urlPattern: /clinical-guidelines\/.*\.json$/,
                                                   handler: 'NetworkFirst',
                                                   options: {
                                                     cacheName: 'clinical-guidelines-cache',
                                                     networkTimeoutSeconds: 3,
                                                     expiration: {
                                                       maxAgeSeconds: 60 * 60 * 24 * 30 // 30 días
                                                     },
                                                     cacheableResponse: {
                                                       statuses: [0, 200]
                                                     }
                                                   }
                                                 },
                                                 // OpenCV.js: CacheFirst
                                                 {
                                                   urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@techstark\/opencv-js/,
                                                   handler: 'CacheFirst',
                                                   options: {
                                                     cacheName: 'opencv-cache',
                                                     expiration: {
                                                       maxAgeSeconds: 60 * 60 * 24 * 365 // 1 year
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
        manualChunks: {
          'ai-libs': ['onnxruntime-web'],
          'canvas': ['konva', 'react-konva'],
          'pdf': ['jspdf', 'jspdf-autotable']




        }
      }
    }


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
