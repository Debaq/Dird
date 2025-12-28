# Clases Pendientes y Estrategia de Entrenamiento

**Fecha de Actualización:** 27 de Diciembre de 2025
**Versión del Sistema:** v2.2025
**Modelo Actual:** YOLOv8n Diabetic Retinopathy Detection v1.0.1

---

## Introducción

Este documento detalla las clases patológicas adicionales requeridas para completar el sistema de clasificación de Retinopatía Diabética (RD), alineándolo con los estándares clínicos internacionales (ICDR/ETDRS). Se describen las prioridades de implementación, características visuales, datasets recomendados y la estrategia técnica para su incorporación.

**Estado Actual del Modelo:**
- ✅ **7 clases implementadas**
- ❌ **3 clases críticas pendientes**
- ⚠️ **Regla 4-2-1 aproximada**

---

## Estado Actual de Detección

### Clases Implementadas (v1.0.1)

| Clase | Estado | Uso en Clasificación | Refinamiento Adicional |
|:---|:---:|:---|:---|
| **Microaneurismas** | ✅ | Criterio para Mild/Moderate NPDR | - |
| **Hemorragias** | ✅ | Criterio para Moderate/Severe NPDR | - |
| **Exudados Duros** | ✅ | Indicador de filtración vascular | Detección indirecta de edema macular (planeado) |
| **Exudados Blandos** | ✅ | Indicador de isquemia retiniana | - |
| **Neovascularización** | ✅ | Criterio definitivo para PDR | - |
| **Disco Óptico** | ✅ | Landmark anatómico | ✅ Refinamiento OpenCV (HoughCircles) |
| **Fóvea** | ✅ | Landmark anatómico | - |

**Funcionalidades Derivadas:**
- ✅ Análisis de cuadrantes geométrico basado en disco óptico y fóvea
- ✅ Auto-detección de tipo de ojo (OD/OI) por posición relativa de landmarks
- ✅ Clasificación DR automática por imagen (5 niveles)
- ✅ Generación automática de máscaras circulares de disco óptico

**Archivo de Modelo:**
- Ubicación: GitHub (`https://raw.githubusercontent.com/Debaq/dird_models/main/`)
- Nombre: `detection-v1.0.1.onnx`
- Metadata: `detection-v1.0.1.json`
- Formato: YOLOv8n (ONNX)

---

## 1. Prioridad Crítica: IRMA (Anomalías Microvasculares Intraretinianas)

### Definición y Relevancia Clínica

Las Anomalías Microvasculares Intraretinianas (IRMA) son shunts vasculares que comunican arteriolas y vénulas dentro de la retina. Visualmente, se presentan como vasos finos y tortuosos con un aspecto irregular, de color rojo oscuro.

**Importancia:** Constituyen el **Criterio 3 de la regla 4-2-1** para el diagnóstico de Retinopatía Diabética No Proliferativa (NPDR) Severa.

**Regla 4-2-1 para NPDR Severa:**
1. Hemorragias severas en **4** cuadrantes
2. Arrosariamiento venoso en **2** o más cuadrantes
3. **IRMA en 1 o más cuadrantes** ← **CLASE FALTANTE**

### Diagnóstico Diferencial

Es crucial distinguir IRMA de la Neovascularización (NV):

| Característica | IRMA | Neovascularización |
|:---|:---|:---|
| **Ubicación** | Intraretiniana | Prerretiniana o sobre la retina |
| **Trayecto** | No cruza vasos mayores | Frecuentemente cruza vasos mayores |
| **Morfología** | Sin bucles definidos | Presencia de bucles |
| **Coloración** | Similar a la retina circundante | Más brillante/rojiza |
| **Grosor** | Vasos finos | Vasos más gruesos |
| **Significado** | NPDR Severa | PDR (Proliferativa) |

### Datasets Recomendados

1.  **IDRiD (Indian Diabetic Retinopathy Image Dataset)**
    - 516 imágenes con máscaras de segmentación de alta calidad
    - Anotaciones manuales por expertos
    - Contiene IRMA etiquetadas
    - URL: https://ieee-dataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid
    - **Formato:** Imágenes + máscaras de segmentación

2.  **DDR Dataset**
    - 757 imágenes con IRMA anotadas mediante *bounding boxes*
    - Dataset chino de alta calidad
    - Clases: MA, HE, EX, SE, NV, **IRMA**
    - **Formato:** Imágenes + YOLO format annotations

3.  **Messidor-2**
    - 1748 imágenes graduadas
    - Útil para validación cruzada
    - No tiene anotaciones de IRMA, requiere re-anotación

### Estrategia de Implementación

```
Estado: NO IMPLEMENTADO
Esfuerzo Total: 40-60 horas (incluyendo data labeling)
Impacto: CRÍTICO

Pasos:

1. Adquisición y Preparación de Datos (10-15 horas)
   - Descargar IDRiD y DDR
   - Convertir máscaras de IDRiD a bounding boxes (si se usa detección)
   - Validar anotaciones de DDR
   - Unificar formato a YOLO
   - Split: 70% entrenamiento, 15% validación, 15% test

2. Data Augmentation (2-4 horas)
   - Rotaciones (±15°)
   - Flip horizontal/vertical
   - Ajustes de brillo/contraste (±20%)
   - Zoom in/out (90%-110%)
   - Objetivo: Aumentar dataset 3-4x

3. Entrenamiento YOLOv8 (15-20 horas)
   - Partir de modelo pre-entrenado actual (transfer learning)
   - Añadir clase 'irma' (clase #8)
   - Batch size: 16
   - Epochs: 100-150
   - Early stopping con patience=20
   - Monitoreo de mAP50, precision, recall

4. Validación (5-8 horas)
   - Cross-validation con Messidor-2 (re-anotado)
   - Cálculo de métricas por clase
   - Análisis de casos falsos positivos/negativos
   - Ajuste de umbral de confianza específico para IRMA

5. Integración en Sistema (5-8 horas)
   - Actualizar metadata JSON con nueva clase
   - Subir modelo a GitHub
   - Actualizar ClassManager en frontend
   - Actualizar función checkSevereNPDR_421Rule()
   - Añadir traducción de 'irma' en i18n
   - Testing end-to-end

6. Documentación (3-5 horas)
   - Actualizar CLAUDE.md
   - Documentar métricas del modelo
   - Crear guía de interpretación de IRMA
```

**Criterios de Éxito:**
- mAP50 ≥ 0.75 para clase IRMA
- Precision ≥ 0.70
- Recall ≥ 0.70
- Baja tasa de confusión con neovascularización

### Implementación en Regla 4-2-1

**Archivo a Modificar:** `/src/lib/analysis/image-dr-classifier.ts`

**Actualización de Función:**

```typescript
// ANTES (actual):
function checkSevereNPDR_421Rule(
  quadrantLesions: QuadrantLesionCounts,
  quadrantAnalysis: QuadrantAnalysis
): { isSevere: boolean; criteria: string[] } {

  let isSevere = false;
  const criteria: string[] = [];

  // Criterio 1: Hemorragias severas en ≥4 cuadrantes
  const quadrantsWithSevereHemorrhages = Object.values(quadrantLesions).filter(
    q => q.hemorrhages >= 5 || q.microaneurysms >= 10
  ).length;

  if (quadrantsWithSevereHemorrhages >= 4) {
    isSevere = true;
    criteria.push(`Hemorragias severas en ${quadrantsWithSevereHemorrhages} cuadrantes (regla 4-2-1: criterio 1)`);
  }

  // Criterio 2: Aproximado con exudados blandos (NO ES REAL)
  const quadrantsWithBeading = Object.values(quadrantLesions).filter(
    q => q.softExudates >= 2
  ).length;

  if (quadrantsWithBeading >= 2) {
    isSevere = true;
    criteria.push(`Signos de isquemia en ${quadrantsWithBeading} cuadrantes (aproximación de criterio 2)`);
  }

  // Criterio 3: IRMA - NO IMPLEMENTADO
  // ...

  return { isSevere, criteria };
}

// DESPUÉS (con IRMA):
function checkSevereNPDR_421Rule(
  quadrantLesions: QuadrantLesionCounts,
  quadrantAnalysis: QuadrantAnalysis
): { isSevere: boolean; criteria: string[] } {

  let isSevere = false;
  const criteria: string[] = [];

  // Criterio 1: Hemorragias severas en ≥4 cuadrantes
  const quadrantsWithSevereHemorrhages = Object.values(quadrantLesions).filter(
    q => q.hemorrhages >= 5 || q.microaneurysms >= 10
  ).length;

  if (quadrantsWithSevereHemorrhages >= 4) {
    isSevere = true;
    criteria.push(`Hemorragias severas en ${quadrantsWithSevereHemorrhages} cuadrantes (regla 4-2-1: criterio 1)`);
  }

  // Criterio 2: Arrosariamiento venoso (PENDIENTE, aproximado)
  const quadrantsWithBeading = Object.values(quadrantLesions).filter(
    q => q.softExudates >= 2  // Aproximación, no es real
  ).length;

  if (quadrantsWithBeading >= 2) {
    isSevere = true;
    criteria.push(`Aproximación de arrosariamiento venoso en ${quadrantsWithBeading} cuadrantes (criterio 2 aproximado)`);
  }

  // Criterio 3: IRMA en ≥1 cuadrante ✅ IMPLEMENTADO
  const quadrantsWithIRMA = Object.values(quadrantLesions).filter(
    q => q.irma && q.irma >= 1  // Nueva propiedad
  ).length;

  if (quadrantsWithIRMA >= 1) {
    isSevere = true;
    criteria.push(`IRMA detectada en ${quadrantsWithIRMA} cuadrante(s) (regla 4-2-1: criterio 3)`);
  }

  return { isSevere, criteria };
}
```

**Actualizar Tipos:**

```typescript
// Archivo: /src/types/annotations.ts o /src/lib/analysis/image-dr-classifier.ts

interface LesionCounts {
  microaneurysms: number;
  hemorrhages: number;
  hardExudates: number;
  softExudates: number;
  neovascularization: number;
  irma: number;  // ← AÑADIR
}
```

---

## 2. Prioridad Crítica: Arrosariamiento Venoso (Venous Beading)

### Definición y Relevancia Clínica

El arrosariamiento venoso se define por fluctuaciones segmentarias en el calibre de las venas retinianas, alternando zonas de dilatación y constricción. Las venas afectadas adquieren una apariencia de "rosario" o "cuentas de collar".

**Importancia:** Es el **Criterio 2 de la regla 4-2-1** para NPDR Severa.

**Características Visuales:**
- Venas con calibre irregular
- Alternancia de segmentos dilatados y estrechos
- Patrón de "collar de perlas"
- Color rojo oscuro (venas)
- Más evidente en vénulas de segundo y tercer orden

### Desafíos Técnicos

La detección automática de arrosariamiento venoso es **extremadamente compleja** debido a:

1. **Sutileza de los cambios:** Variaciones de calibre del 20-30% (difíciles de detectar)
2. **Similitud con venas normales:** Requiere comparación de calibre a lo largo del vaso
3. **Necesidad de segmentación vascular:** No basta con bounding box, se requiere trazado del vaso
4. **Escasez de datasets:** Pocos datasets públicos con arrosariamiento venoso anotado

### Enfoque Incremental Recomendado

```
Estado: NO IMPLEMENTADO
Esfuerzo Total: 60-80 horas (enfoque completo)
Impacto: CRÍTICO

Fase 1: Herramientas de Anotación Manual (8-12 horas)
  - Añadir herramienta de anotación de línea/polilínea en canvas
  - Permitir marcar segmentos de venas con arrosariamiento
  - Guardado en DB con clase 'venous_beading'
  - Contribución al sistema colaborativo

Fase 2: Clasificación Binaria a Nivel de Imagen (20-30 horas)
  - NO detectar ubicación exacta
  - Solo clasificar: presencia/ausencia de arrosariamiento en la imagen
  - Usar arquitectura de clasificación (no YOLO)
  - Modelos candidatos:
    * ResNet50
    * EfficientNetB0
    * Vision Transformer (ViT)
  - Dataset: EyePACS re-anotado + contribuciones propias
  - Integración: Flag binario en imageClassifications

Fase 3: Detección con Segmentación Vascular (Largo Plazo, 40-50 horas)
  - Segmentación de árbol vascular completo (U-Net)
  - Análisis de calibre a lo largo de vasos
  - Detección de variaciones >20%
  - Datasets: DRIVE, STARE, CHASE_DB1 (pre-entrenamiento vascular)
  - Fine-tuning con casos de RD
```

### Estrategia Práctica Recomendada

**Para cumplir regla 4-2-1 en el corto-mediano plazo:**

**Opción A: Aproximación con Exudados Blandos (Actual)**
- ⚠️ Uso temporal de exudados blandos como proxy de isquemia
- Advertencia clara en reporte de que es aproximación
- Mantener hasta que se implemente detección real

**Opción B: Clasificador Binario (Recomendado)**
```typescript
// Añadir campo en imageClassifications
venous_beading_detected: boolean | null;
venous_beading_confidence: number | null;

// Si venous_beading_detected = true en ≥2 cuadrantes
// (requiere procesar cada cuadrante por separado o estimar)

// En regla 4-2-1:
if (session.images.filter(img =>
  img.classification.venous_beading_detected === true
).length >= 2) {
  isSevere = true;
  criteria.push('Arrosariamiento venoso detectado en múltiples imágenes');
}
```

### Datasets Disponibles

**Datasets con Segmentación Vascular (para pre-entrenamiento):**
1. **DRIVE** - 40 imágenes con segmentación vascular manual
2. **STARE** - 20 imágenes con segmentación vascular
3. **CHASE_DB1** - 28 imágenes de niños

**Datasets de DR (para fine-tuning):**
1. **APTOS 2019** - 3,662 imágenes con clasificación de severidad
   - Re-anotar manualmente casos Severe NPDR con arrosariamiento
2. **Kaggle DR Detection** - 35,000+ imágenes
   - Filtrar casos con Severe NPDR
   - Anotación manual de arrosariamiento

**Crowdsourcing de Anotaciones:**
- Usar sistema de contribución de DIRD
- Solicitar a oftalmólogos usuarios que marquen casos
- Validación cruzada (≥2 expertos por imagen)

---

## 3. Prioridad Alta: Edema Macular

### Definición y Relevancia Clínica

Acumulación de fluido en la mácula, detectada idealmente con OCT. Aunque no altera el nivel de severidad de la RD según la escala ICDR, es **la causa principal de pérdida de visión** y determinante para el tratamiento (anti-VEGF, láser focal).

**Tipos:**
- **Edema Macular Clínicamente Significativo (CSME):** Exudados o engrosamiento dentro de 500μm del centro de la fóvea
- **Edema Macular Cistoide (CME):** Acumulación de fluido en capas retinianas (requiere OCT)
- **Edema Macular Difuso:** Engrosamiento retiniano generalizado

### Enfoques de Detección

#### A. Estimación Indirecta (Implementación Inmediata) ✅ RECOMENDADO

**Algoritmo geométrico basado en detecciones existentes:**

```
Estado: NO IMPLEMENTADO (ver MEJORAS_INMEDIATAS.md)
Esfuerzo: 8-12 horas
Impacto: CRÍTICO

1. Localización del disco óptico (✅ ya detectado)
2. Localización de la fóvea (✅ ya detectado)
3. Estimación del radio macular:
   - Disco óptico = referencia de tamaño (~1.5mm)
   - Zona macular = 1.5 diámetros de disco desde fóvea
4. Cuantificación de exudados duros dentro de zona macular
5. Clasificación:
   - ≥5 exudados: Alto riesgo CSME
   - 3-4 exudados: Riesgo moderado
   - 1-2 exudados: Riesgo bajo
   - 0 exudados: Sin evidencia
```

**Ventajas:**
- ✅ No requiere nuevo modelo
- ✅ Usa detecciones existentes
- ✅ Implementación rápida
- ✅ Útil clínicamente como screening
- ✅ Datos ya disponibles

**Limitaciones:**
- ⚠️ No detecta engrosamiento retiniano real
- ⚠️ No detecta edema sin exudados
- ⚠️ Requiere confirmación con OCT

**Integración:**

```typescript
// Archivo: /src/lib/analysis/macular-edema-detector.ts (NUEVO)

export interface MacularEdemaAssessment {
  suspected: boolean;
  confidence: 'low' | 'moderate' | 'high';
  exudates_near_fovea: number;
  distance_from_fovea_dd: number | null;  // en diámetros de disco
  recommendation: string;
  requires_oct: boolean;
}

export function assessMacularEdemaRisk(
  detections: Detection[],
  imageWidth: number,
  imageHeight: number
): MacularEdemaAssessment {
  // Implementación completa en MEJORAS_INMEDIATAS.md sección 8
}

// Añadir campos a imageClassifications (schema v12):
macular_edema_suspected: boolean;
macular_edema_confidence: 'low' | 'moderate' | 'high' | null;
macular_exudates_count: number;
```

#### B. Segmentación de Fluido (Largo Plazo)

**Entrenamiento de modelos de segmentación específicos:**

```
Estado: NO IMPLEMENTADO
Esfuerzo: 80-100 horas
Impacto: ALTO (pero requiere OCT)

Desafío Principal:
- Datasets de fundoscopia NO muestran edema directamente
- Se requiere correlación con OCT para ground truth

Datasets Recomendados:
1. DIARETDB1 - 89 imágenes con segmentación de exudados
2. e-ophtha EX - 82 imágenes con exudados
3. Datasets con OCT correlacionado (limitados, privados)

Enfoque Alternativo:
- Usar exudados duros como proxy (ya implementable)
- Combinar con análisis de cuadrantes
- Validar con OCT en práctica clínica
```

**Recomendación:** Implementar enfoque A (indirecto) inmediatamente. Considerar enfoque B solo si se obtiene acceso a datasets con OCT correlacionado.

---

## 4. Prioridad Media: Hemorragias Vítreas y Prerretinianas

### Definición y Relevancia Clínica

Presencia de sangre en la cavidad vítrea (hemorragia vítrea) o anterior a la retina (hemorragia prerretiniana). Son signos indicativos de Retinopatía Diabética Proliferativa (PDR) avanzada.

**Características Visuales:**
- **Hemorragia Prerretiniana:**
  - Forma redondeada ("en bote")
  - Bien delimitada
  - Color rojo brillante
  - Nivel de fluido horizontal
- **Hemorragia Vítrea:**
  - Áreas difusas
  - Opacidades flotantes
  - Oscurecimiento de detalles retinianos
  - Puede ser densa (visión borrosa)

### Estrategia de Implementación

```
Estado: PARCIALMENTE IMPLEMENTADO
Esfuerzo: 15-20 horas
Impacto: MEDIO

Situación Actual:
- Clase 'hemorrhage' detecta hemorragias en general
- NO distingue entre:
  * Hemorragias intraretinianas (flame-shaped, dot-blot)
  * Hemorragias prerretinianas
  * Hemorragias vítreas

Propuesta:
- Extender clase existente con atributo de localización
- Alternativa: Añadir clases separadas

Opción 1: Atributo de Localización (Recomendado)
- Mantener clase 'hemorrhage'
- Añadir campo 'location': 'intraretinal' | 'preretinal' | 'vitreous'
- Entrenamiento con dataset re-anotado
- Clasificador auxiliar (ResNet) que toma RoI y clasifica tipo

Opción 2: Clases Separadas
- Nuevas clases:
  * 'hemorrhage_intraretinal'
  * 'hemorrhage_preretinal'
  * 'hemorrhage_vitreous'
- Más datos de entrenamiento requeridos
- Mayor complejidad de modelo
```

**Datasets:**
- EyePACS (filtrar casos PDR con hemorragias severas)
- Kaggle DR Detection (casos grado 4)
- Re-anotación manual con clasificación de tipo

**Integración en Clasificación:**
```typescript
// En classifier:
if (detections.some(d =>
  d.class === 'hemorrhage' &&
  (d.location === 'preretinal' || d.location === 'vitreous')
)) {
  severity = 'pdr';
  criteria.push('Hemorragia prerretiniana/vítrea detectada (PDR avanzada)');
}
```

---

## 5. Clases Adicionales de Interés (Prioridad Baja)

### A. Manchas Algodonosas (Cotton-Wool Spots)

**Estado:** Actualmente detectadas como 'soft_exudates' (✅)

**Nota:** Los exudados blandos y las manchas algodonosas son el mismo hallazgo (infartos retinianos superficiales). La clase actual es suficiente.

### B. Pliegues Retinianos

**Relevancia:** Indicador de desprendimiento de retina traccional en PDR severa
**Prioridad:** Baja (casos raros)
**Detección:** Visual evidente, no requiere IA urgentemente

### C. Cicatrices de Láser

**Relevancia:** Importante para seguimiento de pacientes tratados
**Prioridad:** Media
**Desafío:** Apariencia variable según técnica (PRP focal, rejilla)

**Propuesta:**
```
Clase: 'laser_scar'
Utilidad:
- Seguimiento de tratamiento previo
- Diferenciar DR natural vs tratada
- Evaluar efectividad de láser

Dataset:
- Imágenes de pacientes post-PRP
- Anotación manual de áreas tratadas
- Contribución de oftalmólogos en el sistema
```

---

## Resumen de Recursos y Datasets

### IRMA
- **Entrenamiento:** IDRiD (Segmentación), DDR (Detección)
- **Objetivo:** Integración en modelo YOLOv8 como clase adicional
- **Esfuerzo:** 40-60 horas
- **Prioridad:** **CRÍTICA**

### Arrosariamiento Venoso
- **Estrategia Corto Plazo:** Clasificador binario a nivel de imagen
- **Estrategia Largo Plazo:** Segmentación vascular + análisis de calibre
- **Datasets:** APTOS 2019 (re-anotado), contribuciones propias
- **Esfuerzo:** 60-80 horas (enfoque completo)
- **Prioridad:** **CRÍTICA**

### Edema Macular
- **Estrategia Inmediata:** Lógica geométrica sobre exudados duros existentes ✅
- **Estrategia Largo Plazo:** Segmentación con correlación OCT
- **Datasets:** DIARETDB1, e-ophtha EX
- **Esfuerzo:** 8-12 horas (enfoque indirecto), 80-100 horas (segmentación)
- **Prioridad:** **ALTA**

### Hemorragias Vítreas/Prerretinianas
- **Estrategia:** Extender clase 'hemorrhage' con atributo de localización
- **Datasets:** EyePACS (casos PDR severos, re-anotados)
- **Esfuerzo:** 15-20 horas
- **Prioridad:** **MEDIA**

---

## Roadmap Técnico Actualizado

### Fase 1: Optimización Inmediata (1-2 meses)

**Implementaciones sin Nuevo Modelo:**
1. ✅ **Análisis de cuadrantes** - COMPLETADO
2. ✅ **Refinamiento de disco óptico con OpenCV** - COMPLETADO
3. ⏳ **Detección indirecta de Edema Macular** - PLANEADO (8-12 horas)
   - Algoritmo geométrico basado en fóvea + exudados duros
   - Integración en clasificación
   - Alertas en UI y reportes
4. ⏳ **Sistema de alertas de hallazgos críticos** - PLANEADO (8-12 horas)
   - Incluir alerta de edema macular sospechado
   - Priorización por urgencia

**Total Esfuerzo Fase 1:** 16-24 horas

### Fase 2: Desarrollo de Modelo IRMA (3-4 meses)

1. **Preparación de Datasets** (10-15 horas)
   - Descarga y validación de IDRiD y DDR
   - Conversión de formatos
   - Data augmentation

2. **Entrenamiento YOLOv8 con clase IRMA** (15-20 horas)
   - Transfer learning desde modelo actual
   - Añadir clase 'irma'
   - Optimización de hiperparámetros

3. **Validación y Testing** (5-8 horas)
   - Cross-validation
   - Análisis de métricas
   - Ajuste de umbral de confianza

4. **Integración en Sistema** (5-8 horas)
   - Actualizar metadata JSON
   - Subir modelo a GitHub
   - Actualizar regla 4-2-1
   - Testing end-to-end

5. **Validación Clínica Preliminar** (5-8 horas)
   - Evaluación con oftalmólogo
   - Ajustes finales

**Total Esfuerzo Fase 2:** 40-59 horas

### Fase 3: Clasificador de Arrosariamiento Venoso (5-6 meses)

**Enfoque Incremental:**

1. **Herramientas de Anotación** (8-12 horas)
   - Implementar en canvas
   - Sistema de contribución

2. **Recolección de Datos** (Continuo)
   - Campaña de anotación con usuarios oftalmólogos
   - Objetivo: 200-300 imágenes anotadas

3. **Clasificador Binario** (20-30 horas)
   - Entrenamiento ResNet/EfficientNet
   - Integración a nivel de imagen
   - No requiere ubicación exacta

4. **Integración en Regla 4-2-1** (5-8 horas)
   - Actualizar criterio 2
   - Validación

**Total Esfuerzo Fase 3:** 33-50 horas

### Fase 4: Consolidación (7-12 meses)

1. **Refinamiento con Datos Propios**
   - Ajuste de modelos con contribuciones reales
   - Validación continua

2. **Hemorragias Clasificadas por Tipo** (15-20 horas)
   - Extender clase hemorrhage
   - Re-entrenamiento

3. **Validación Clínica Extensiva**
   - Estudio con 200-300 imágenes
   - Comparación con gold standard (oftalmólogos)
   - Cálculo de sensibilidad/especificidad

4. **Ciclo de Mejora Continua**
   - Incorporación de feedback
   - Actualización de umbrales

---

## Tabla de Prioridades y Estado

| Clase | Estado Actual | Prioridad | Esfuerzo | Impacto en Regla 4-2-1 | Fecha Objetivo |
|:---|:---:|:---:|:---:|:---:|:---|
| **IRMA** | ❌ | CRÍTICA | 40-60h | ✅ Criterio 3 | Q1 2026 |
| **Arrosariamiento Venoso** | ❌ | CRÍTICA | 60-80h | ✅ Criterio 2 | Q2 2026 |
| **Edema Macular (indirecto)** | ❌ | ALTA | 8-12h | ⚠️ Tratamiento | Inmediato |
| **Hemorragias Clasificadas** | ⚠️ | MEDIA | 15-20h | ⚠️ PDR avanzada | Q2 2026 |
| **Edema Macular (segmentación)** | ❌ | BAJA | 80-100h | ⚠️ Requiere OCT | Largo plazo |
| **Cicatrices de Láser** | ❌ | BAJA | 30-40h | ➖ Seguimiento | Futuro |

**Leyenda:**
- ✅ Implementado
- ⚠️ Parcialmente implementado
- ❌ No implementado
- ➖ No afecta directamente

---

## Consideraciones Técnicas Importantes

### 1. Arquitectura del Sistema

El sistema actual soporta **modelos dinámicos**:
- ✅ Clases se cargan desde metadata JSON
- ✅ ClassManager se actualiza automáticamente
- ✅ Traducciones extensibles vía i18n
- ✅ Rainbow Mode para nuevas clases
- ✅ Clases custom por usuario

**Implicación:** Añadir nuevas clases es relativamente sencillo, el sistema está preparado.

### 2. Versionado de Modelos

**Sistema Actual:**
- Modelos versionados: `detection-v1.0.1.onnx`
- Metadata correspondiente: `detection-v1.0.1.json`
- Almacenado por sesión qué modelo se usó

**Al Añadir Nueva Clase:**
- Incrementar versión: `detection-v1.1.0.onnx`
- Actualizar metadata JSON
- Mantener modelos antiguos para compatibilidad

### 3. Migración de Datos

**Sesiones Procesadas con Modelo Antiguo:**
- Se preserva versión del modelo utilizado
- Se puede reprocesar con modelo nuevo (duplicar sesión)
- Comparación entre modelos (útil para validación)

### 4. Sistema de Contribución

**Aprovechamiento del Sistema Colaborativo:**
- Solicitar a usuarios que anoten casos específicos (IRMA, arrosariamiento)
- Sistema de tokens incentiva contribuciones
- Validación cruzada con múltiples anotadores
- **Potencial para crear datasets de alta calidad**

---

## Métricas de Éxito

### Para IRMA

**Objetivos Mínimos:**
- mAP50 ≥ 0.75
- Precision ≥ 0.70
- Recall ≥ 0.70
- Tasa de confusión con NV < 10%

**Validación Clínica:**
- Sensibilidad ≥ 80% (comparado con oftalmólogo)
- Especificidad ≥ 85%
- Kappa de Cohen ≥ 0.75 (concordancia sustancial)

### Para Arrosariamiento Venoso (Clasificador Binario)

**Objetivos Mínimos:**
- Accuracy ≥ 0.80
- Sensitivity ≥ 0.75
- Specificity ≥ 0.85
- AUC-ROC ≥ 0.85

### Para Edema Macular (Indirecto)

**Objetivos:**
- Sensitivity ≥ 70% (screening, priorizar falsos positivos bajos)
- Specificity ≥ 80%
- Correlación con OCT (en subset validado) ≥ 0.70

---

## Conclusión

El sistema DIRD v2.2025 ha alcanzado un nivel sólido de detección de lesiones básicas de RD, con **7 clases implementadas** y funcionalidades avanzadas como análisis de cuadrantes y refinamiento de disco óptico.

**Brechas Críticas Identificadas:**
1. **IRMA** - Esencial para regla 4-2-1 completa
2. **Arrosariamiento Venoso** - Esencial para regla 4-2-1 completa
3. **Edema Macular** - Crítico para decisiones de tratamiento

**Roadmap Realista:**
- **Inmediato (1-2 meses):** Detección indirecta de edema macular (8-12 horas)
- **Corto plazo (3-4 meses):** Modelo IRMA (40-60 horas)
- **Mediano plazo (5-6 meses):** Clasificador de arrosariamiento venoso (60-80 horas)

**Inversión Total Estimada:** 108-152 horas de desarrollo

Con la implementación de estas tres clases críticas, el sistema DIRD alcanzará **≥95% de cumplimiento** con los estándares internacionales ICDR/ETDRS, posicionándose como una herramienta de screening de DR de clase mundial.

---

**Documento actualizado por:** Sistema de Auditoría Técnica DIRD
**Fecha:** 27 de Diciembre de 2025
**Versión del Sistema:** v2.2025
**Próxima Revisión:** Marzo 2026
