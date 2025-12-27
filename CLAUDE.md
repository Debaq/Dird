# DIRD - Diabetic Retinopathy Detection Platform

DIRD is a privacy-first, edge-computing web application for ophthalmological image analysis. It runs ONNX AI models (YOLOv8n detection + segmentation) entirely in the browser using WebAssembly, ensuring patient data never leaves the device.

* [CORE FEATURES](#core-features)
* [TECH STACK](#tech-stack)
  * [CORE FRAMEWORK](#core-framework)
  * [AI & COMPUTER VISION](#ai--computer-vision)
  * [UI & CANVAS](#ui--canvas)
  * [DATA & PERSISTENCE](#data--persistence)
  * [PWA & INTERNATIONALIZATION](#pwa--internationalization)
* [CONFIGURATION & FORMATS](#configuration--formats)
  * [PROJECT STRUCTURE](#project-structure)
  * [DATABASE SCHEMA](#database-schema-dexiejs)
  * [MODEL METADATA JSON FORMAT](#model-metadata-json-format)
  * [DIRD EXPORT FORMAT (ZIP)](#dird-export-format-zip-structure)
  * [VITE CONFIGURATION](#vite-configuration-pwa--wasm)
  * [CANVAS LAYER SYSTEM](#canvas-layer-system)
  * [WEB WORKER SETUP](#web-worker-setup-onnx-inference)
  * [i18n CONFIGURATION](#i18n-configuration)
  * [APP CONFIGURATION STORE](#app-configuration-store)
* [DEVELOPMENT WORKFLOW](#development-workflow)
* [KEY IMPLEMENTATION NOTES](#key-implementation-notes)
* [FUTURE ENHANCEMENTS](#future-enhancements-post-mvp)
* [DEVELOPMENT COMMANDS](#development-commands)
* [PROJECT DELIVERY](#project-delivery)




## Core Features
- **Patient & Session Management**: Create patients, organize fundus images by sessions
- **Dual AI Models**: Detection (bounding boxes) + Segmentation (masks) with configurable execution
- **Interactive Canvas**: Multi-layer annotation system with manual corrections
- **Version Control**: Track model versions, create session copies for reprocessing
- **Report Generation**: PDF reports with preview/final modes, case locking
- **Offline-First**: PWA with IndexedDB persistence, .dird export format (ZIP-based)
- **Internationalization**: Spanish base, extensible i18n architecture

## Tech Stack

### Core Framework
```json
{
  "framework": "React 18.3+",
  "build": "Vite 5+",
  "language": "TypeScript 5+",
  "styling": "TailwindCSS 3.4+",
  "routing": "React Router 6+"
}
```

### AI & Computer Vision
```json
{
  "inference": "onnxruntime-web",
  "image-processing": "opencv.js",
  "workers": "Comlink (Web Worker abstraction)",
  "compression": "browser-image-compression"
}
```

### UI & Canvas
```json
{
  "canvas": "Konva + react-konva",
  "icons": "lucide-react",
  "animations": "framer-motion",
  "components": "shadcn/ui (Radix primitives)"
}
```

### Data & Persistence
```json
{
  "database": "Dexie.js (IndexedDB wrapper)",
  "state": "Zustand",
  "export": "JSZip",
  "pdf": "jsPDF + jspdf-autotable"
}
```

### PWA & Internationalization
```json
{
  "pwa": "vite-plugin-pwa (Workbox)",
  "i18n": "react-i18next"
}
```

## Project Structure
```
dird/
├── public/
│   ├── models/                    # ONNX models + metadata JSON
│   │   ├── detection-v1.0.0.onnx
│   │   ├── detection-v1.0.0.json  # Model metadata
│   │   ├── segmentation-v1.0.0.onnx
│   │   └── segmentation-v1.0.0.json
│   ├── locales/                   # i18n translations
│   │   ├── es/
│   │   │   └── translation.json
│   │   └── en/
│   │       └── translation.json
│   ├── opencv/                    # OpenCV.js WASM
│   └── workers/                   # Web Worker scripts
│       ├── onnx-worker.js
│       └── opencv-worker.js
├── src/
│   ├── components/
│   │   ├── canvas/
│   │   │   ├── AnnotationCanvas.tsx      # Main Konva canvas
│   │   │   ├── LayerControls.tsx         # Layer visibility/opacity
│   │   │   ├── ToolPanel.tsx             # Drawing tools selector
│   │   │   └── BoundingBoxTool.tsx       # Detection annotation
│   │   ├── patients/
│   │   │   ├── PatientList.tsx
│   │   │   ├── PatientForm.tsx
│   │   │   └── SessionManager.tsx
│   │   ├── reports/
│   │   │   ├── ReportPreview.tsx
│   │   │   ├── ReportGenerator.tsx       # jsPDF logic
│   │   │   └── ComparisonReport.tsx
│   │   ├── upload/
│   │   │   ├── ImageDropzone.tsx
│   │   │   └── BatchProcessor.tsx        # Queue processing
│   │   └── ui/                            # shadcn components
│   ├── lib/
│   │   ├── ai/
│   │   │   ├── onnx-manager.ts           # Model loading/inference
│   │   │   ├── model-metadata.ts         # JSON parser
│   │   │   └── preprocessing.ts          # OpenCV operations
│   │   ├── db/
│   │   │   ├── schema.ts                 # Dexie tables
│   │   │   └── queries.ts                # DB operations
│   │   ├── export/
│   │   │   ├── dird-exporter.ts          # .dird ZIP creation
│   │   │   └── dird-importer.ts          # .dird restoration
│   │   ├── canvas/
│   │   │   ├── layer-manager.ts          # Canvas state
│   │   │   └── annotation-serializer.ts  # Save/load annotations
│   │   └── pdf/
│   │       └── report-generator.ts       # jsPDF templates
│   ├── stores/
│   │   ├── config-store.ts               # App config (colors, logo)
│   │   ├── patient-store.ts              # Patient state
│   │   └── canvas-store.ts               # Canvas tool state
│   ├── types/
│   │   ├── models.ts                     # AI model types
│   │   ├── patient.ts                    # Patient/Session types
│   │   └── annotations.ts                # Canvas annotation types
│   ├── i18n/
│   │   └── config.ts                     # react-i18next setup
│   └── App.tsx
├── vite.config.ts
├── tailwind.config.js
└── package.json
```

## Database Schema (Dexie.js)

```typescript
// src/lib/db/schema.ts
import Dexie, { Table } from 'dexie';

export interface Patient {
  id?: number;
  patientId: string;        // User-friendly ID
  name: string;
  dateOfBirth: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id?: number;
  patientId: number;        // FK to Patient
  sessionNumber: number;
  date: Date;
  notes?: string;
  modelVersions: {          // Track which models were used
    detection?: string;
    segmentation?: string;
  };
  locked: boolean;          // True after report finalized
  lockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Image {
  id?: number;
  sessionId: number;        // FK to Session
  filename: string;
  originalBlob: Blob;       // Original image
  processedBlob?: Blob;     // After OpenCV preprocessing
  width: number;
  height: number;
  uploadedAt: Date;
}

export interface Detection {
  id?: number;
  imageId: number;          // FK to Image
  type: 'ai' | 'manual';
  modelVersion?: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  class: string;
  confidence?: number;      // Only for AI detections
  customLabel?: string;     // For manual annotations
  visible: boolean;
  createdAt: Date;
}

export interface Segmentation {
  id?: number;
  imageId: number;          // FK to Image
  type: 'ai' | 'manual';
  modelVersion?: string;
  maskData: string;         // Base64 or compressed format
  class: string;
  confidence?: number;
  customLabel?: string;
  opacity: number;
  visible: boolean;
  createdAt: Date;
}

export interface Report {
  id?: number;
  sessionId: number;        // FK to Session
  type: 'preview' | 'final';
  pdfBlob: Blob;
  evaluatorNotes: string;
  areasOfInterest: Array<{
    imageId: number;
    coords: { x: number; y: number };
    comment: string;
  }>;
  generatedAt: Date;
}

export class DirdDatabase extends Dexie {
  patients!: Table<Patient>;
  sessions!: Table<Session>;
  images!: Table<Image>;
  detections!: Table<Detection>;
  segmentations!: Table<Segmentation>;
  reports!: Table<Report>;

  constructor() {
    super('DirdDatabase');
    this.version(1).stores({
      patients: '++id, patientId, name, createdAt',
      sessions: '++id, patientId, sessionNumber, date, locked',
      images: '++id, sessionId, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, generatedAt'
    });
  }
}

export const db = new DirdDatabase();
```

## Configuration & Formats

### Model Metadata JSON Format

```json
{
  "model_version": "yolov8n-retina-v2.1.0",
  "model_type": "detection",
  "classes": [
    "microaneurysm",
    "hard_exudate",
    "soft_exudate",
    "hemorrhage",
    "neovascularization"
  ],
  "input_size": [640, 640],
  "confidence_threshold": 0.5,
  "iou_threshold": 0.45,
  "date_trained": "2024-12-15",
  "metrics": {
    "mAP50": 0.87,
    "precision": 0.85,
    "recall": 0.83
  }
}
```

### DIRD Export Format (ZIP Structure)

```
paciente_Juan_Perez.dird (ZIP file)
├── metadata.json
│   {
│     "export_version": "1.0.0",
│     "exported_at": "2024-12-22T10:30:00Z",
│     "patient": { ... },
│     "sessions": [ ... ]
│   }
├── sessions/
│   ├── session_001/
│   │   ├── images/
│   │   │   ├── fundus_001.jpg
│   │   │   └── fundus_002.jpg
│   │   ├── detections.json
│   │   ├── segmentations.json
│   │   └── report_final.pdf
│   └── session_002/
│       └── ...
```

### Vite Configuration (PWA + WASM)

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['logo.svg', 'locales/**/*.json'],
      manifest: {
        name: 'DIRD - Diabetic Retinopathy Detection',
        short_name: 'DIRD',
        description: 'Privacy-first AI-powered retinopathy analysis',
        theme_color: '#0ea5e9',
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
        runtimeCaching: [
          {
            urlPattern: /\.onnx$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'ai-models-cache',
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          },
          {
            urlPattern: /\.wasm$/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'wasm-cache',
              expiration: {
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ],
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
  }
});
```

### Canvas Layer System

```typescript
// src/lib/canvas/layer-manager.ts
export type LayerType = 'original' | 'detections-ai' | 'segmentations-ai' | 'manual-annotations';

export interface CanvasLayer {
  id: LayerType;
  name: string;
  visible: boolean;
  opacity: number;
  locked: boolean;
  zIndex: number;
}

export const DEFAULT_LAYERS: CanvasLayer[] = [
  { id: 'original', name: 'Original Image', visible: true, opacity: 1, locked: true, zIndex: 0 },
  { id: 'segmentations-ai', name: 'AI Segmentations', visible: true, opacity: 0.6, locked: false, zIndex: 1 },
  { id: 'detections-ai', name: 'AI Detections', visible: true, opacity: 1, locked: false, zIndex: 2 },
  { id: 'manual-annotations', name: 'Manual Annotations', visible: true, opacity: 1, locked: false, zIndex: 3 }
];
```

### Web Worker Setup (ONNX Inference)

```typescript
// public/workers/onnx-worker.js
import * as ort from 'onnxruntime-web';

let session = null;

self.addEventListener('message', async (e) => {
  const { action, payload } = e.data;

  switch (action) {
    case 'LOAD_MODEL':
      try {
        session = await ort.InferenceSession.create(payload.modelPath, {
          executionProviders: ['webgl', 'wasm']
        });
        self.postMessage({ type: 'MODEL_LOADED', modelPath: payload.modelPath });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;

    case 'INFERENCE':
      try {
        const tensor = new ort.Tensor('float32', payload.data, payload.dims);
        const results = await session.run({ images: tensor });
        self.postMessage({ 
          type: 'INFERENCE_COMPLETE', 
          results: results.output.data,
          dims: results.output.dims
        });
      } catch (error) {
        self.postMessage({ type: 'ERROR', error: error.message });
      }
      break;
  }
});
```

### i18n Configuration

```typescript
// src/i18n/config.ts
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    fallbackLng: 'es',
    debug: import.meta.env.DEV,
    interpolation: {
      escapeValue: false
    },
    backend: {
      loadPath: '/locales/{{lng}}/translation.json'
    }
  });

export default i18n;
```

```json
// public/locales/es/translation.json
{
  "app": {
    "name": "DIRD",
    "tagline": "Detección de Retinopatía Diabética"
  },
  "patients": {
    "title": "Pacientes",
    "create": "Crear Paciente",
    "name": "Nombre",
    "id": "ID de Paciente"
  },
  "sessions": {
    "title": "Sesiones",
    "create": "Nueva Sesión",
    "locked": "Sesión Bloqueada",
    "unlock": "Desbloquear"
  },
  "canvas": {
    "tools": {
      "bbox": "Caja de Detección",
      "segment": "Segmentación",
      "eraser": "Borrador"
    },
    "layers": {
      "original": "Imagen Original",
      "ai_detections": "Detecciones IA",
      "ai_segmentations": "Segmentaciones IA",
      "manual": "Anotaciones Manuales"
    }
  },
  "reports": {
    "generate": "Generar Informe",
    "preview": "Vista Preliminar",
    "finalize": "Finalizar y Cerrar Caso",
    "status": {
      "preliminary": "VERSIÓN PRELIMINAR",
      "final": "INFORME FINAL"
    }
  },
  "models": {
    "detection": "Detección",
    "segmentation": "Segmentación",
    "classes": {
      "microaneurysm": "Microaneurisma",
      "hard_exudate": "Exudado Duro",
      "soft_exudate": "Exudado Blando",
      "hemorrhage": "Hemorragia",
      "neovascularization": "Neovascularización"
    }
  },
  "export": {
    "patient": "Exportar Paciente",
    "all": "Exportar Todo",
    "import": "Importar .dird"
  }
}
```

### App Configuration Store

```typescript
// src/stores/config-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AppConfig {
  name: string;
  primaryColor: string;
  logo: string;
  modelsEnabled: {
    detection: boolean;
    segmentation: boolean;
  };
}

interface ConfigStore {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
}

export const useConfigStore = create<ConfigStore>()(
  persist(
    (set) => ({
      config: {
        name: 'DIRD',
        primaryColor: '#0ea5e9',
        logo: '/logo-default.svg',
        modelsEnabled: {
          detection: true,
          segmentation: false // Beta
        }
      },
      updateConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates }
        }))
    }),
    {
      name: 'dird-config'
    }
  )
);
```

## Development Workflow

### 1. Initial Setup
```bash
npm create vite@latest dird -- --template react-ts
cd dird
npm install

# Core dependencies
npm install react-router-dom zustand dexie dexie-react-hooks
npm install onnxruntime-web jszip jspdf jspdf-autotable
npm install konva react-konva browser-image-compression
npm install react-i18next i18next i18next-browser-languagedetector
npm install lucide-react framer-motion

# Dev dependencies
npm install -D @vitejs/plugin-react vite-plugin-pwa
npm install -D tailwindcss postcss autoprefixer
npm install -D @types/node
```

### 2. Model Integration
- Place `.onnx` models in `public/models/`
- Create companion `.json` metadata files
- Test inference in Web Worker before UI integration

### 3. Canvas Development Priority
1. Basic image display
2. Layer system (show/hide, opacity)
3. Bounding box tool
4. Segmentation brush
5. Annotation persistence

### 4. Processing Pipeline
```
Upload → Compression → OpenCV preprocessing → 
Detection inference → (Optional) Segmentation → 
Store in IndexedDB → Canvas visualization
```

### 5. Report Generation
- Create jsPDF templates with medical report structure
- Include: Patient info, session metadata, images with overlays, detection tables
- Watermark "PRELIMINAR" for preview mode

## Key Implementation Notes

### Performance Optimization
1. **Web Workers**: Run ONNX + OpenCV in separate threads
2. **Image Compression**: Reduce resolution before inference (640x640)
3. **Lazy Loading**: Load models only when first needed
4. **Canvas Virtualization**: Only render visible annotations

### Medical Compliance
1. **Audit Trail**: Log all manual edits with timestamps
2. **Version Tracking**: Store model version with each result
3. **Data Integrity**: Hash images to detect tampering
4. **Locked Sessions**: Prevent edits after report finalization

### Edge Cases
1. **Model Loading Failures**: Fallback to manual-only mode
2. **Large Images**: Warn if >10MB, suggest compression
3. **Browser Compatibility**: Detect WebGL/WebGPU support
4. **Offline Sync**: Queue operations when offline

## Future Enhancements (Post-MVP)
- [ ] Measurement tools (calibrated)
- [ ] Comparison heatmaps between sessions
- [ ] DICOM import/export
- [ ] Multi-language support (English, Portuguese)
- [ ] Cloud sync option (Firebase/Supabase)
- [ ] Model fine-tuning interface

## Development Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npm run preview      # Test production build
npm run type-check   # TypeScript validation
```

## Project Delivery
The complete application should be:
1. Fully functional offline after first load
2. Responsive (desktop-first, tablet support)
3. Accessible (WCAG AA minimum)
4. Spanish-first with i18n infrastructure
5. Well-documented TypeScript interfaces
6. Unit tests for critical AI/DB logic

---

**Note**: All code comments and internal documentation should be in English. UI text and user-facing content should use the i18n system with Spanish as the base language.