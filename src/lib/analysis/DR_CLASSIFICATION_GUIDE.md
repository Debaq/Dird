# Guía de Clasificación de Retinopatía Diabética

## Descripción General

Este sistema implementa un clasificador automático de retinopatía diabética basado en:
- **Escala Internacional de Severidad de Retinopatía Diabética (ICDR)**
- **ETDRS (Early Treatment Diabetic Retinopathy Study)**

## Niveles de Severidad

| Nivel | Código | Descripción |
|-------|--------|-------------|
| Sin RD | `no_dr` | Sin microaneurismas ni otras lesiones |
| RDNP Leve | `mild_npdr` | Solo microaneurismas |
| RDNP Moderada | `moderate_npdr` | Más que microaneurismas pero menos que severa |
| RDNP Severa | `severe_npdr` | Cumple regla 4-2-1 (aproximada) |
| RD Proliferativa | `pdr` | Neovascularización presente |

## Criterios de Clasificación

### Regla 4-2-1 (RDNP Severa)
Cualquiera de los siguientes:
- Hemorragias severas en 4 cuadrantes
- Arrosariamiento venoso en 2+ cuadrantes
- IRMA en 1+ cuadrante

**Nota**: El sistema aproxima estos criterios basándose en conteos de lesiones.

### Factores de Riesgo Evaluados
- Duración de la diabetes
- Tipo de diabetes (Tipo 1 tiene mayor riesgo)
- Hipertensión arterial
- Dislipidemia
- Medicamentos actuales

## Uso del Sistema

### 1. Uso Programático

```typescript
import { classifySessionDR } from '@/lib/analysis/dr-classification-service';

// Clasificar una sesión específica
const classification = await classifySessionDR(sessionId);
console.log(JSON.stringify(classification, null, 2));
```

### 2. Hook de React

```tsx
import { useDRClassification } from '@/hooks/useDRClassification';

function MyComponent() {
  const { classification, classifySession } = useDRClassification();

  const handleClassify = async () => {
    await classifySession(sessionId);
  };

  return (
    <button onClick={handleClassify}>Clasificar</button>
  );
}
```

### 3. Componente Demo

```tsx
import { DRClassificationDemo } from '@/components/analysis/DRClassificationDemo';

<DRClassificationDemo sessionId={123} />
```

## Estructura del JSON de Salida

```json
{
  "timestamp": "2024-12-26T10:30:00.000Z",
  "overallSeverity": "moderate_npdr",
  "rightEye": {
    "eye": "OD",
    "severity": "moderate_npdr",
    "lesions": {
      "microaneurysms": 8,
      "hemorrhages": 3,
      "hardExudates": 5,
      "softExudates": 0,
      "neovascularization": 0
    },
    "criteria": [
      "Microaneurysms: 8",
      "Hemorrhages: 3",
      "Hard exudates: 5",
      "Multiple lesion types present"
    ],
    "confidence": "moderate"
  },
  "leftEye": {
    "eye": "OI",
    "severity": "mild_npdr",
    "lesions": {
      "microaneurysms": 4,
      "hemorrhages": 0,
      "hardExudates": 0,
      "softExudates": 0,
      "neovascularization": 0
    },
    "criteria": [
      "Only microaneurysms detected (4)"
    ],
    "confidence": "high"
  },
  "riskFactors": {
    "diabetesDuration": "high",
    "diabetesControl": "unknown",
    "hypertension": true,
    "dyslipidemia": false,
    "type1Diabetes": false
  },
  "recommendations": [
    "Refer to ophthalmologist",
    "Follow-up every 3-6 months",
    "Optimize glycemic control",
    "Blood pressure control is essential",
    "Long diabetes duration increases progression risk"
  ],
  "warnings": [
    "This is an AI-assisted suggestion, not a definitive diagnosis",
    "Clinical correlation and expert review required",
    "Quadrant-based analysis (4-2-1 rule) is approximated"
  ],
  "clinicalNotes": [
    "Patient has diabetes (type2)",
    "Diabetes duration: 18 years",
    "Current medications: Metformin, Enalapril"
  ]
}
```

## Ejemplos de Uso

### Ejemplo 1: Clasificación Simple

```typescript
// Clasificar la sesión actual
const result = await classifySessionDR(currentSessionId);

if (result) {
  console.log('Severidad:', result.overallSeverity);
  console.log('Recomendaciones:', result.recommendations);
}
```

### Ejemplo 2: Comparación Temporal

```typescript
import { compareSessionClassifications } from '@/lib/analysis/dr-classification-service';

// Comparar varias sesiones del mismo paciente
const classifications = await compareSessionClassifications([
  session1Id,
  session2Id,
  session3Id
]);

// Analizar progresión
classifications.forEach((c, idx) => {
  console.log(`Visita ${idx + 1}:`, c.overallSeverity);
});
```

### Ejemplo 3: Estadísticas Globales

```typescript
import { getGlobalStatistics } from '@/lib/analysis/dr-classification-service';

const stats = await getGlobalStatistics();
console.log('Pacientes de alto riesgo:', stats.highRiskPatients);
console.log('Distribución:', stats.classificationCounts);
```

## Integración en Reportes

El sistema puede integrarse en reportes PDF:

```typescript
import { exportClassificationJSON } from '@/lib/analysis/dr-classification-service';

const classification = await classifySessionDR(sessionId);
if (classification) {
  const jsonData = exportClassificationJSON(classification);

  // Incluir en PDF o exportar como archivo
  console.log(jsonData);
}
```

## Consideraciones Clínicas

### Limitaciones
1. **No es un diagnóstico definitivo**: Requiere confirmación por oftalmólogo
2. **Regla 4-2-1 aproximada**: No se analizan cuadrantes reales aún
3. **Depende de la calidad de las imágenes**: Imágenes de baja calidad afectan precisión
4. **No evalúa edema macular**: Solo se enfoca en lesiones de retinopatía

### Recomendaciones de Uso
1. **Siempre revisar manualmente** las clasificaciones antes de tomar decisiones clínicas
2. **Correlacionar con antecedentes** del paciente
3. **Usar como herramienta de screening**, no diagnóstico final
4. **Documentar** cualquier discrepancia entre AI y evaluación clínica

## Futuras Mejoras

- [ ] Análisis real por cuadrantes (integración con sistema de cuadrantes existente)
- [ ] Detección de edema macular
- [ ] Scoring de severidad más granular
- [ ] Machine learning para ajustar umbrales
- [ ] Integración con guías locales (además de ICDR)
- [ ] Exportación a formatos estándar (FHIR, DICOM SR)

## Referencias

1. **International Clinical Diabetic Retinopathy Severity Scale**
   - Wilkinson CP, et al. Ophthalmology. 2003;110(9):1677-1682.

2. **ETDRS Classification**
   - Early Treatment Diabetic Retinopathy Study Research Group. Ophthalmology. 1991;98(5):786-806.

3. **American Academy of Ophthalmology PPP**
   - Diabetic Retinopathy Preferred Practice Pattern, 2019.

## Soporte

Para preguntas o mejoras, consultar el equipo de desarrollo.
