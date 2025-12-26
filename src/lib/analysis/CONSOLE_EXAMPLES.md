# Ejemplos para Consola del Navegador

## Cómo probar el sistema de clasificación

Abre la consola del navegador (F12) y ejecuta estos comandos:

### 1. Importar funciones necesarias

```javascript
// En desarrollo, estas funciones estarán disponibles globalmente
// o las puedes importar dinámicamente:

const { classifySessionDR, classifyPatientDR, getGlobalStatistics } =
  await import('/src/lib/analysis/dr-classification-service.ts');
```

### 2. Clasificar una sesión específica

```javascript
// Reemplaza '1' con el ID de tu sesión
const result = await classifySessionDR(1);

// El resultado ya se imprime automáticamente en la consola
// pero puedes acceder a propiedades específicas:
console.log('Severidad:', result.overallSeverity);
console.log('Recomendaciones:', result.recommendations);
```

### 3. Clasificar el último estudio de un paciente

```javascript
// Reemplaza '1' con el ID del paciente
const result = await classifyPatientDR(1);
```

### 4. Ver estadísticas globales

```javascript
const stats = await getGlobalStatistics();
console.log('Total pacientes:', stats.totalPatients);
console.log('Alto riesgo:', stats.highRiskPatients);
console.log('Distribución:', stats.classificationCounts);
```

### 5. Comparar sesiones

```javascript
const { compareSessionClassifications } =
  await import('/src/lib/analysis/dr-classification-service.ts');

// Compara sesiones 1, 2 y 3
const comparisons = await compareSessionClassifications([1, 2, 3]);
```

### 6. Acceso directo desde window (si está configurado)

Si las funciones se exportan globalmente:

```javascript
// Clasificar sesión
window.classifySession(1);

// Clasificar paciente
window.classifyPatient(1);

// Estadísticas
window.getDRStatistics();
```

### 7. Crear datos de prueba

```javascript
// Si necesitas crear datos de prueba para probar el clasificador:
const { db } = await import('/src/lib/db/schema.ts');

// Listar pacientes
const patients = await db.patients.toArray();
console.log('Pacientes:', patients);

// Listar sesiones de un paciente
const sessions = await db.sessions.where('patientId').equals(1).toArray();
console.log('Sesiones:', sessions);

// Ver detecciones de una imagen
const detections = await db.detections.where('imageId').equals(1).toArray();
console.log('Detecciones:', detections);
```

### 8. Exportar clasificación como JSON

```javascript
const { exportClassificationJSON } =
  await import('/src/lib/analysis/dr-classification-service.ts');

const result = await classifySessionDR(1);
const json = exportClassificationJSON(result);

// Copiar al portapapeles
await navigator.clipboard.writeText(json);
console.log('JSON copiado al portapapeles!');

// O descargar como archivo
const blob = new Blob([json], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url;
a.download = `clasificacion-dr-${Date.now()}.json`;
a.click();
```

## Ejemplos de Salida

### Ejemplo 1: Sin Retinopatía

```json
{
  "timestamp": "2024-12-26T10:30:00.000Z",
  "overallSeverity": "no_dr",
  "rightEye": {
    "eye": "OD",
    "severity": "no_dr",
    "lesions": {
      "microaneurysms": 0,
      "hemorrhages": 0,
      "hardExudates": 0,
      "softExudates": 0,
      "neovascularization": 0
    },
    "criteria": ["No retinopathy lesions detected"],
    "confidence": "high"
  },
  "recommendations": [
    "Annual screening recommended",
    "Maintain good glycemic control"
  ]
}
```

### Ejemplo 2: RDNP Moderada

```json
{
  "timestamp": "2024-12-26T10:30:00.000Z",
  "overallSeverity": "moderate_npdr",
  "rightEye": {
    "eye": "OD",
    "severity": "moderate_npdr",
    "lesions": {
      "microaneurysms": 12,
      "hemorrhages": 6,
      "hardExudates": 8,
      "softExudates": 0,
      "neovascularization": 0
    },
    "criteria": [
      "Microaneurysms: 12",
      "Hemorrhages: 6",
      "Hard exudates: 8",
      "Multiple lesion types present"
    ],
    "confidence": "moderate"
  },
  "recommendations": [
    "Refer to ophthalmologist",
    "Follow-up every 3-6 months",
    "Optimize glycemic control"
  ]
}
```

### Ejemplo 3: RD Proliferativa

```json
{
  "timestamp": "2024-12-26T10:30:00.000Z",
  "overallSeverity": "pdr",
  "rightEye": {
    "eye": "OD",
    "severity": "pdr",
    "lesions": {
      "microaneurysms": 15,
      "hemorrhages": 8,
      "hardExudates": 10,
      "softExudates": 2,
      "neovascularization": 3
    },
    "criteria": [
      "Neovascularization detected (3 areas)"
    ],
    "confidence": "high"
  },
  "recommendations": [
    "URGENT: Immediate referral to retina specialist required",
    "Consider pan-retinal photocoagulation (PRP)",
    "Follow-up within 2-4 weeks"
  ],
  "warnings": [
    "This is an AI-assisted suggestion, not a definitive diagnosis",
    "Clinical correlation and expert review required"
  ]
}
```

## Debugging

### Ver estructura de datos

```javascript
// Ver esquema de la base de datos
const { db } = await import('/src/lib/db/schema.ts');
console.log('Tablas:', db.tables.map(t => t.name));

// Contar registros
console.log('Pacientes:', await db.patients.count());
console.log('Sesiones:', await db.sessions.count());
console.log('Imágenes:', await db.images.count());
console.log('Detecciones:', await db.detections.count());
```

### Verificar clases detectadas

```javascript
// Ver qué clases se están detectando
const { db } = await import('/src/lib/db/schema.ts');
const detections = await db.detections.toArray();
const classes = new Set(detections.map(d => d.class));
console.log('Clases detectadas:', Array.from(classes));
```

### Limpiar consola

```javascript
clear(); // Limpia la consola
```

## Tips

1. **Usar `await`**: Todas las funciones son asíncronas, no olvides usar `await`
2. **IDs correctos**: Verifica que los IDs de sesión/paciente existan en la base de datos
3. **Datos necesarios**: El clasificador necesita imágenes con detecciones para funcionar
4. **Consola persistente**: Activa "Preserve log" en la consola para no perder mensajes al navegar
