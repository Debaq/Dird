# Roadmap — Sistema de métricas DIRD+ (3 niveles)

Plan de implementación para sistema completo de métricas: per-sesión, agregados por clínico, y exportación anonimizada opt-in para investigación.

## Estado actual (baseline)

Ya implementado:
- Store Zustand `inference-metrics-store.ts` con persistencia en localStorage
- Timing fino del pipeline IA por imagen: preprocess, ONNX inference, post-processing, NMS, spatial analysis, clinical classification
- Wrapper en `SessionView.handleProcessWithAI` que mide tiempo total de sesión, carga modelo, promedio por imagen
- Contadores globales de uso (totalStudies, totalImages, tiempos acumulados, primer/último uso)
- Pestaña "Métricas" en Settings con tablas de fases, % E2E, overhead vs inferencia pura
- Export JSON, limpiar historial, reset total

Faltante crítico:
- No hay persistencia en Dexie (todo vive en localStorage → no agregable, no consultable por sesión)
- No hay instrumentación de interacción UI (canvas, correcciones, filtros, LLM)
- No existe concepto de `clinicianId`
- No hay dashboard real
- No hay mecanismo de opt-in ni exportación anonimizada

---

## Nivel 1 — Métricas per-sesión (individuales)

Objetivo: capturar todo el ciclo de vida de un caso clínico desde carga de imagen hasta cierre. Datos usables para dashboard personal y exportables en informe.

### 1.1. Tabla Dexie `sessionMetrics`

Nueva tabla en `src/lib/db/schema.ts`. Una fila por sesión.

```typescript
interface SessionMetrics {
  id?: number;
  sessionId: number;          // FK a sessions
  clinicianId: string;        // UUID local (ver 2.0)
  
  // Timestamps del ciclo
  sessionCreatedAt: Date;
  firstImageLoadedAt?: Date;
  firstDetectionVisibleAt?: Date;
  classificationCompletedAt?: Date;
  sessionClosedAt?: Date;
  
  // Duraciones derivadas (ms)
  imageLoadMs?: number;              // primera carga blob → decode → display
  timeToFirstDetectionMs?: number;   // load → detection visible en canvas
  timeToClassificationMs?: number;   // load → clasificación DR emitida
  canvasTimeMs: number;              // tiempo acumulado con canvas activo (focus)
  
  // Interacciones
  manualCorrections: number;         // detecciones editadas/eliminadas por clínico
  manualAdditions: number;           // detecciones añadidas manualmente
  filtersActivated: string[];        // ['clahe', 'contrast', ...] aplicados
  filtersToggleCount: number;        // cuántas veces se activaron/desactivaron
  
  // LLM
  llmInvoked: boolean;
  llmPreviewShownAt?: Date;
  llmFinalizedAt?: Date;
  llmTimeMs?: number;
  llmAcceptedUnchanged: boolean;     // ¿aceptó narración sin editar?
  
  // Pipeline IA (agregado de inference-metrics por imagen)
  pipelineStats?: {
    numImages: number;
    totalE2EMs: number;
    phaseMeans: {
      preprocess: number;
      inference: number;
      postprocess: number;
      nms: number;
      spatial: number;
      clinical: number;
    };
  };
  
  // Contexto clínico
  guidelineActive: string;           // ej 'ICO-2023'
  finalClassification?: string;      // severidad final emitida
  eye: 'OD' | 'OS' | 'both';
}
```

Índices: `sessionId`, `clinicianId`, `sessionCreatedAt`.

### 1.2. Instrumentación de eventos UI

Punto de instrumentación por evento:

| Evento | Archivo | Mecanismo |
|---|---|---|
| `sessionCreatedAt` | `SessionForm` al submit | hook `useSessionMetrics().start(sessionId)` |
| `firstImageLoadedAt` | `ImageGallery` / `useImageUploader` | al primer `onload` exitoso |
| `firstDetectionVisibleAt` | `inference-service.detectObjects` tras render | callback post-save |
| `classificationCompletedAt` | `classifyAndSaveImage` | al resolver promise |
| `sessionClosedAt` | `SessionView` cleanup o botón cerrar | `useSessionMetrics().close()` |
| `canvasTimeMs` | `AnnotationCanvas` | `focus`/`blur` + `visibilitychange` + acumulador |
| `manualCorrections` | `AnnotationCanvas` ops edit/delete | incrementar por op |
| `manualAdditions` | `AnnotationCanvas` ops create | incrementar por op |
| `filtersActivated` / `filtersToggleCount` | `image-processing-store` | suscripción a cambios |
| `llmInvoked` + tiempos | servicio LLM narración | wrap de llamadas |

### 1.3. Hook `useSessionMetrics`

Nuevo `src/hooks/useSessionMetrics.ts`. Fachada que:
- Inicializa row en Dexie al crear sesión
- Expone métodos: `markFirstLoad()`, `markFirstDetection()`, `markClassified()`, `incrementCorrection()`, `incrementAddition()`, `trackFilter(name, active)`, `markLlmInvoked()`, `markLlmFinalized(accepted)`, `close()`
- Escucha focus/blur del canvas para acumular `canvasTimeMs`
- Al `close()` calcula duraciones derivadas y agrega `pipelineStats` desde `inference-metrics-store`

### 1.4. Inclusión en informe PDF

`report-generator.ts` — sección opcional "Tiempos y métricas del caso" con datos del row correspondiente. Toggle en `ReportSettings`.

### Entregables Nivel 1
- [ ] Schema Dexie `sessionMetrics` + migración
- [ ] Hook `useSessionMetrics`
- [ ] Instrumentación en 8 puntos listados
- [ ] Sección opcional en PDF
- [ ] Tests unit del hook (mock Dexie)

---

## Nivel 2 — Agregados por clínico (persistentes)

Objetivo: dashboard personal del clínico con tendencias de uso, calidad y desacuerdo con el modelo.

### 2.0. Identidad del clínico

No hay auth. Crear UUID local al primer arranque:

```typescript
// src/stores/clinician-store.ts
clinicianId: string;        // crypto.randomUUID(), persist
displayName?: string;       // opcional, editable en Settings
createdAt: Date;
```

Todos los rows de `sessionMetrics` llevan `clinicianId`. En el futuro, si se añade auth real, migrar el UUID al usuario.

### 2.1. Métricas agregadas (calculadas on-demand)

Servicio `src/lib/analysis/clinician-aggregator.ts`:

```typescript
interface ClinicianAggregates {
  clinicianId: string;
  periodFrom: Date;
  periodTo: Date;
  
  // Volumen
  totalPatients: number;          // distinct patientId vía sessions
  totalSessions: number;
  totalImages: number;
  
  // Tiempos
  avgSessionTimeMs: number;
  medianSessionTimeMs: number;
  avgTimeToClassificationMs: number;
  avgCanvasTimeMs: number;
  
  // Distribución clasificaciones
  classificationDistribution: Record<string, number>;  // {no_dr: 42, mild: 10, ...}
  byGuideline: Record<string, Record<string, number>>; // guideline → distribución
  
  // Desacuerdo con modelo (señales)
  mostReclassifiedClasses: Array<{class: string, count: number, rate: number}>;
  mostManuallyAddedClasses: Array<{class: string, count: number, rate: number}>;
  
  // LLM
  llmUsageRate: number;           // % sesiones con LLM
  llmAcceptanceRate: number;      // % narraciones aceptadas sin edit
  
  // Filtros
  filterUsageDistribution: Record<string, number>;
}
```

Inputs: `db.sessionMetrics.where({clinicianId})` + joins con `db.sessions`, `db.detections` (para diff AI vs manual), `db.images`.

Filtros de rango: último día / semana / mes / todo.

### 2.2. Diff AI vs manual (señal de desacuerdo)

Al cerrar sesión, comparar para cada imagen:
- Detecciones `type='ai'` vs `type='manual'` finales
- Clase cambió → `reclassified` (incrementar por clase original)
- Detección manual sin contraparte AI → `manuallyAdded` (incrementar por clase)
- Detección AI eliminada → `rejected` (incrementar por clase)

Guardar en `sessionMetrics.diffCounters` o tabla auxiliar `detectionDiffs` si se quiere drill-down por detección.

### 2.3. Dashboard

Nueva ruta `/dashboard` (no dentro de Settings — vista propia). Componente `src/components/dashboard/ClinicianDashboard.tsx`.

Secciones:
1. **Resumen**: cards con KPIs (pacientes, sesiones, tiempo medio, severidades vistas)
2. **Actividad temporal**: line chart sesiones/día, heatmap horas
3. **Distribución clasificaciones**: pie/bar por severidad, filtro por guideline
4. **Desacuerdo con modelo**: bar chart top clases reetiquetadas/añadidas → útil para reporte de calidad del modelo
5. **Uso LLM**: ratio invocación/aceptación
6. **Filtros frecuentes**: ranking

Librería gráficos: verificar si `recharts` o `chart.js` ya está; si no, añadir `recharts` (tree-shakeable, ok para desktop Tauri).

Botón "Exportar métricas (JSON/CSV)" para uso local del clínico.

### Entregables Nivel 2
- [ ] Store/servicio `clinicianId` UUID
- [ ] `clinician-aggregator.ts` con todas las funciones de agregación
- [ ] Lógica diff AI vs manual al cerrar sesión
- [ ] Ruta `/dashboard` y componente completo
- [ ] Gráficos con recharts (6 secciones)
- [ ] Export JSON/CSV local
- [ ] Tests de agregador con DB fixture

---

## Nivel 3 — Export anonimizado opt-in (investigación)

Objetivo: contribuir agregados Nivel 2 sin PII al mismo repositorio colaborativo que recolecta correcciones de anotación. Estricto opt-in con consentimiento explícito.

### 3.0. Prerequisitos (bloqueantes)

Requieren decisión del usuario antes de implementar:
- **Endpoint del repositorio colaborativo**: ¿URL, protocolo, auth? Si ya existe para correcciones de anotación, reusar. Si no, definir.
- **Texto de consentimiento**: debe redactarlo alguien con criterio clínico/legal (no IA). Tiene que mencionar qué se envía, qué NO se envía, cómo revocar, retención.
- **Política de retención / revocación**: ¿puede el clínico pedir borrado de sus contribuciones anteriores?

### 3.1. Toggle + consentimiento

En Settings → nueva sección "Contribución a investigación":
- Switch OFF por defecto
- Al activar: modal de consentimiento (scroll completo obligatorio, checkbox explícito "He leído y acepto", botón habilitado solo tras check)
- Guarda en config: `research.optIn`, `research.consentVersion`, `research.acceptedAt`
- Si cambia versión del texto → invalidar opt-in, re-pedir

### 3.2. Anonimización

Función `anonymizeAggregates(ClinicianAggregates): AnonymousAggregates`:
- Strip: `clinicianId`, `displayName`, cualquier ID de paciente/sesión/imagen
- Strip: timestamps absolutos → solo mantener períodos relativos ("last_30_days")
- Strip: nombres de archivo, paths
- Mantener: distribuciones, counts, rates, medias, diffs anónimos
- Añadir: `contributionId` = nuevo UUID por envío (no rastreable al clínico)
- Añadir: `appVersion`, `modelVersion`

Tests: verificar que no quede ningún campo con PII usando denylist.

### 3.3. Cadencia de envío

Opciones:
- Manual: botón "Contribuir ahora" muestra preview del JSON a enviar antes de confirmar
- Automática: semanal/mensual en background (solo si `optIn=true`)

Recomendado: manual con preview primero. Añadir automática como opción secundaria tras validar.

### 3.4. Transporte

Reusar mecanismo de correcciones de anotación. Si es HTTP POST a endpoint conocido → mismo cliente, mismo rate limiting. Si es otro repo (ej git/issue), adaptar.

Logs locales de contribuciones enviadas (fecha, hash del payload) para trazabilidad — sin guardar el payload completo.

### 3.5. Revocación

Botón "Retirar consentimiento" → OFF el toggle + (si el endpoint lo soporta) envío de DELETE con `contributionId`s previos. Si no lo soporta, mensaje claro: "Contribuciones ya enviadas no pueden retirarse retroactivamente, pero no se enviarán nuevas".

### Entregables Nivel 3
- [ ] Definir endpoint + texto consentimiento (bloqueo usuario)
- [ ] Modal consentimiento + config persistencia
- [ ] `anonymizeAggregates()` + tests de denylist PII
- [ ] Preview pre-envío
- [ ] Cliente transporte (manual)
- [ ] Log local de contribuciones
- [ ] Flujo revocación

---

## Orden sugerido de implementación

1. **Nivel 1 schema + hook** (base — sin esto nada agrega)
2. **Nivel 1 instrumentación** (pocos puntos por PR, progresivo)
3. **clinicianId + diff AI/manual** (cimiento Nivel 2)
4. **Nivel 2 aggregator + dashboard**
5. **Nivel 3** solo después de tener decisiones de producto/legal

Estimación aproximada (dev único):
- Nivel 1: 3–4 días
- Nivel 2: 3–4 días (más tiempo en dashboard + recharts)
- Nivel 3: 2 días código + tiempo indefinido para decisiones de consentimiento/endpoint

## Riesgos

- **Performance canvas**: acumular `canvasTimeMs` con listeners mal escritos puede añadir overhead. Usar `requestIdleCallback` o intervalo 1s.
- **Diff AI vs manual**: si el clínico no "cierra" sesión explícitamente, el diff nunca se calcula. Alternativa: recalcular on-demand al abrir dashboard.
- **localStorage vs Dexie**: el store actual sigue siendo útil para timing pipeline en vivo, pero las métricas definitivas deben vivir en Dexie. Mantener ambos; el store se vuelca a Dexie al cerrar sesión.
- **Privacidad Nivel 3**: test de denylist PII no es suficiente por sí solo. Revisión manual del payload antes de habilitar envío en producción.
- **Consentimiento**: si cambia el texto, invalidar opt-in y re-pedir. No migrar automáticamente.
