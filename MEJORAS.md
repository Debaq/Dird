# Análisis Profesional de DIRD+

**167 archivos TypeScript | ~26,000+ líneas | Calificación actual: 6.5/10**

---

## Estado Actual - Lo que está bien

- Arquitectura offline-first sólida (IndexedDB/Dexie con 16 versiones de migración)
- Sistema de directrices clínicas extensible (ICDR, MINSAL)
- AI edge-computing real (ONNX en browser via WebAssembly)
- Zustand bien usado para estado global
- TypeScript strict mode habilitado
- i18n implementado (ES/EN)
- Sistema de exportación .dird (ZIP portable)

---

## Problemas por Prioridad

### P0 - CRÍTICOS (resolver ya)

| # | Problema | Ubicación | Impacto |
|---|---------|-----------|---------|
| 1 | **Bug en importador .dird** - mapeo de IDs de detecciones/segmentaciones usa `indexOf()` en vez de `imageIdMap.get()`, causando datos corruptos al importar | `lib/export/dird-importer.ts` | Pérdida de datos |
| 2 | **Sin tests** - 0 tests en todo el proyecto | Proyecto completo | Regresiones silenciosas |
| 3 | **Sin Error Boundaries** - si el canvas crashea, toda la app muere | `components/canvas/` | UX rota |
| 4 | **API keys en localStorage** - `config-store.ts` guarda apiKey del modelo en localStorage, visible por XSS | `stores/config-store.ts` | Seguridad |

### P1 - IMPORTANTES (próximas semanas)

| # | Problema | Ubicación |
|---|---------|-----------|
| 5 | **Componentes monolíticos** - AnnotationCanvas (1612 líneas), GuidelineEditor (1745), Settings (1289), ImageAnalyzer (1084) | `components/canvas/`, `components/settings/` |
| 6 | **Props drilling extremo** - 22+ props bajando por 8 niveles en el canvas | `AnnotationCanvas` → layers |
| 7 | **50+ usos de `any`** - `detections?: any[]`, `metadata?: Record<string, any>` | Múltiples archivos |
| 8 | **Código duplicado 100%** en `useImageUploader.tsx` - misma función `processImage` definida 2 veces (70 líneas) | `hooks/useImageUploader.tsx` |
| 9 | **console.log en producción** - 30+ logs directos ignorando el logger centralizado que ya existe | `App.tsx`, `inference-service.ts`, `token-service.ts`, etc. |
| 10 | **Sin ESLint ni Prettier** - inconsistencias de formato en el código | Raíz del proyecto |

### P2 - MEJORAS PROFESIONALES (gradual)

| # | Problema | Ubicación |
|---|---------|-----------|
| 11 | **Accesibilidad limitada** - solo 5 atributos ARIA en toda la app, Select sin keyboard nav | `components/ui/`, canvas |
| 12 | **Sin CI/CD** - no hay GitHub Actions ni pipeline de deploy | `.github/workflows/` |
| 13 | **Sin React.lazy/Suspense** - todo carga de golpe, sin code splitting de rutas | `App.tsx` |
| 14 | **Meta tags SEO incompletos** - falta og:*, description, theme-color | `index.html` |
| 15 | **ReportGenerator mega-clase** - 1800 líneas, render + layout + lógica + traducciones en 1 archivo | `lib/pdf/report-generator.ts` |
| 16 | **Sin retry/timeout** en servicios API (tokens, admin) | `lib/api/` |
| 17 | **Memory leaks potenciales** en model-downloader (ReadableStream) y optic-disc-refiner (OpenCV Mats) | `lib/ai/` |
| 18 | **ClassManager usa estado global mutable** en vez de Zustand | `lib/classes/class-manager.ts` |

---

## Plan de Acción Recomendado

### Fase 1 - Estabilidad (urgente)

1. **Corregir bug del importer** - Arreglar mapeo de IDs en `dird-importer.ts`
2. **Agregar Error Boundaries** - Envolver canvas, reportes, y settings
3. **Migrar console.log al logger** - Ya existe `utils/logger.ts`, solo falta usarlo
4. **Configurar ESLint + Prettier** - Base consistente de código

### Fase 2 - Calidad de código

5. **Eliminar `any`** - Reemplazar con tipos de `lib/db/schema` y `types/`
6. **Eliminar duplicación** en `useImageUploader`, `inference-service` (loadDetection/loadSegmentation), `ReportsList`/`GlobalReportsList`
7. **Extraer lógica a hooks** - `useSessionManagement`, `usePatientFilter`, `useReportGeneration`
8. **Refactorizar Settings.tsx** - Dividir en 8 componentes por tab

### Fase 3 - Arquitectura canvas

9. **Crear CanvasContext** - Reemplazar props drilling con Context API
10. **Dividir AnnotationCanvas** (1612 → 5 componentes de ~300 líneas)
11. **Dividir ImageAnalyzer** (1084 → componentes modulares)

### Fase 4 - Profesionalización

12. **Configurar Vitest + React Testing Library** - Empezar por lógica crítica (DR classifier, importer, quadrant calculator)
13. **Agregar React.lazy** para rutas pesadas (canvas, settings, academy, admin)
14. **Mejorar accesibilidad** - ARIA labels, keyboard navigation en Select y herramientas del canvas
15. **Configurar CI/CD** - GitHub Actions con type-check + lint + test + build
16. **Completar meta tags** - Open Graph, description, theme-color
