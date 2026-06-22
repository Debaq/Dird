# Detección Avanzada de Anillos Circinados

## Resumen

Este documento describe el sistema mejorado de detección de patrones circinados (anillos de exudados duros) alrededor de la fóvea, que es un indicador clave de edema macular.

## Nuevas Métricas Implementadas

### 1. **Concentración Radial** (`calculateRadialConcentration`)

Mide qué tan consistentemente están posicionados los exudados a distancias similares de la fóvea.

**Retorna:**
- `concentration` (0-1): Score de concentración
  - **1.0** = todos los exudados a la misma distancia (anillo perfecto)
  - **0.0** = exudados a distancias muy variables (dispersos)
- `mean`: Distancia promedio en μm
- `stdDev`: Desviación estándar
- `coefficientOfVariation`: Variabilidad relativa (CV)

**Interpretación:**
- CV < 0.15: Excelente concentración (anillo bien definido)
- CV 0.15-0.3: Buena concentración (anillo con ligera variación)
- CV > 0.5: Pobre concentración (no es un anillo)

**Ejemplo:**
```typescript
// 5 exudados a ~400μm de la fóvea
const distances = [395, 405, 398, 402, 400]; // en μm

const result = calculateRadialConcentration(distances);
// result.concentration ≈ 0.98 (muy alta)
// result.mean ≈ 400
// result.coefficientOfVariation ≈ 0.01 (muy baja variación)
```

---

### 2. **Análisis de Brechas Angulares** (`calculateAngularGaps`)

Detecta brechas grandes entre exudados que indican anillos incompletos.

**Retorna:**
- `gaps`: Array con todas las brechas angulares
- `maxGapDegrees`: Brecha más grande en grados
- `completeness` (0-1): Score de completitud
  - **1.0** = sin brechas grandes (anillo completo)
  - **0.0** = brecha muy grande (anillo muy incompleto)
- `isComplete`: Boolean (true si brecha máxima < 90°)

**Interpretación:**
- Max gap < 60°: Anillo completo
- Max gap 60-120°: Anillo parcial (detectable pero incompleto)
- Max gap > 120°: Muy incompleto (probablemente no es anillo)

**Ejemplo:**
```typescript
// 4 exudados distribuidos con una brecha grande
const angles = [0, 1.5, 3.0, 4.5]; // en radianes

const result = calculateAngularGaps(angles);
// result.maxGapDegrees ≈ 90
// result.completeness ≈ 0.25 (anillo parcial)
// result.isComplete = false
```

---

### 3. **Ajuste de Círculo** (`fitCircleToPoints`)

Ajusta un círculo óptimo a los puntos usando el método de Kasa (least squares).

**Retorna:**
- `center`: Centro del círculo ajustado (x, y)
- `radius`: Radio en píxeles
- `meanError`: Error promedio de ajuste
- `fitQuality` (0-1): Calidad del ajuste
  - **1.0** = puntos forman círculo perfecto
  - **0.0** = puntos no siguen patrón circular

**Interpretación:**
- Error relativo < 0.1: Excelente ajuste circular
- Error relativo 0.1-0.3: Buen ajuste (anillo con irregularidades)
- Error relativo > 0.3: Pobre ajuste (no es circular)

**Ejemplo:**
```typescript
const points = [
  { x: 500, y: 400 },
  { x: 600, y: 500 },
  { x: 500, y: 600 },
  { x: 400, y: 500 }
]; // 4 puntos formando casi un círculo

const result = fitCircleToPoints(points);
// result.center ≈ { x: 500, y: 500 }
// result.radius ≈ 100
// result.fitQuality ≈ 0.95 (muy circular)
```

---

### 4. **Análisis Comprehensivo** (`analyzeCircinatePattern`)

Combina todas las métricas anteriores en un análisis unificado.

**Retorna: `CircinatePatternAnalysis`**

```typescript
{
  // Score general (0-1) - combinación ponderada de todas las métricas
  overallScore: number;

  // Métricas individuales (0-1)
  angularDispersion: number;      // Distribución uniforme alrededor de fóvea
  radialConcentration: number;    // Consistencia de distancia
  circleFitQuality: number;       // Qué tan circular es el patrón
  completeness: number;           // Ausencia de brechas grandes

  // Gap más grande
  maxAngularGapDegrees: number;

  // Clasificación del patrón
  isCompleteRing: boolean;        // Anillo completo (score ≥ 0.7 + sin brechas)
  isPartialRing: boolean;         // Anillo parcial (score 0.4-0.7 O métricas individuales buenas)

  // Datos del círculo ajustado
  fittedCircle?: {
    center: Point;
    radius: number;
    radiusMicrons: number;
    meanFitError: number;
  };

  // Estadísticas radiales
  radialStats?: {
    mean: number;              // Distancia promedio
    stdDev: number;            // Desviación estándar
    min: number;               // Exudado más cercano
    max: number;               // Exudado más lejano
    coefficientOfVariation: number;
  };
}
```

---

## Ponderación de Métricas

El `overallScore` combina las métricas con estos pesos:

```typescript
const weights = {
  angularDispersion: 0.30,     // 30% - Distribución alrededor de fóvea
  radialConcentration: 0.25,   // 25% - Consistencia de distancia
  completeness: 0.25,          // 25% - Sin brechas grandes
  circleFitQuality: 0.20       // 20% - Ajuste geométrico
};
```

---

## Clasificación de Patrones

### **Anillo Completo** (`isCompleteRing`)
- Score general ≥ 0.7
- Y brecha máxima < 90°
- **Significado clínico:** Patrón circinado bien establecido, fuerte indicador de edema macular

### **Anillo Parcial** (`isPartialRing`)
- Score 0.4-0.7 con brechas, O
- Dispersión angular ≥ 0.5 + concentración radial ≥ 0.6, O
- Completitud ≥ 0.5

- **Significado clínico:** Patrón circinado en formación o incompleto, aún relevante para diagnóstico

### **No es Anillo**
- Score < 0.4
- **Significado clínico:** Exudados dispersos sin patrón circular definido

---

## Integración con el Sistema

El análisis avanzado se activa automáticamente cuando:
1. `circinate_pattern_detection` está habilitado en criterios clínicos
2. Hay 3 o más exudados en la zona foveal

**Resultado incluido en `MacularEdemaResult`:**

```typescript
interface MacularEdemaResult {
  // ... campos existentes ...

  // Nuevo campo con análisis detallado
  circinateAnalysis?: CircinatePatternAnalysis;
}
```

---

## Mensajes de Advertencia

El sistema genera advertencias descriptivas:

```typescript
// Anillo completo
"Complete circinate ring detected (score: 82%)"

// Anillo parcial
"Partial circinate pattern detected (score: 58%, max gap: 105°)"

// Fallback (< 3 exudatos)
"Circinate pattern detected (dispersion: 65%)"
```

---

## Ejemplo de Uso

```typescript
import { detectMacularEdema } from '@/lib/analysis/macular-edema-detector';

const result = detectMacularEdema(detections, fovea, calibration, criteria);

if (result.circinateAnalysis) {
  console.log(`Overall Score: ${result.circinateAnalysis.overallScore.toFixed(2)}`);
  console.log(`Complete Ring: ${result.circinateAnalysis.isCompleteRing}`);
  console.log(`Partial Ring: ${result.circinateAnalysis.isPartialRing}`);

  if (result.circinateAnalysis.fittedCircle) {
    console.log(`Fitted circle radius: ${result.circinateAnalysis.fittedCircle.radiusMicrons.toFixed(0)} μm`);
  }

  if (result.circinateAnalysis.radialStats) {
    console.log(`Mean distance: ${result.circinateAnalysis.radialStats.mean.toFixed(0)} μm`);
    console.log(`Variation: ${(result.circinateAnalysis.radialStats.coefficientOfVariation * 100).toFixed(1)}%`);
  }
}
```

---

## Casos Clínicos Detectables

### Caso 1: Anillo Completo y Bien Definido
- 8 exudados duros a ~450μm de la fóvea
- Distribuidos uniformemente (cada 45°)
- **Resultado:**
  - `overallScore`: ~0.85
  - `isCompleteRing`: true
  - `maxAngularGapDegrees`: ~45°

### Caso 2: Anillo Parcial con Brecha
- 5 exudados duros concentrados en 270° alrededor de la fóvea
- Todos a ~400μm
- Brecha de 90° en un lado
- **Resultado:**
  - `overallScore`: ~0.55
  - `isPartialRing`: true
  - `maxAngularGapDegrees`: 90°

### Caso 3: Inicio de Formación
- 3 exudados duros formando triángulo irregular
- Distancias variables (350-500μm)
- **Resultado:**
  - `overallScore`: ~0.35
  - `isPartialRing`: posiblemente false (depende de métricas individuales)
  - Sistema aún detecta y reporta patrón emergente

---

## Ventajas del Sistema

1. **Tolerancia a Anillos Incompletos:** Detecta patrones parciales que son clínicamente relevantes
2. **Múltiples Métricas:** No depende de una sola medida, más robusto
3. **Información Detallada:** Provee datos para análisis clínico profundo
4. **Ajuste Geométrico:** El círculo ajustado puede usarse para visualización
5. **Backward Compatible:** Funciona con el sistema existente sin romper nada

---

## Referencias

- **Método de Kasa:** Algebraic circle fitting para ajuste rápido de círculos
- **ETDRS:** Early Treatment Diabetic Retinopathy Study - estándar para mediciones
- **EMCS:** Clinically Significant Macular Edema criteria
