# 🎯 CLASES FALTANTES Y ESTRATEGIA DE ENTRENAMIENTO

## 🔴 **PRIORIDAD 1: IRMA** (Intraretinal Microvascular Abnormalities)

### ¿Qué son?
- **Definición:** Shunts vasculares intraretinales que comunican arteriolas y vénulas
- **Aspecto visual:** Vasos finos tortuosos que parecen "arañas" o ramas dentro de la retina
- **Importancia:** ⭐⭐⭐⭐⭐ Criterio definitivo para NPDR severa (regla 4-2-1)

### Características distintivas:
```
IRMA vs Neovascularización:
┌─────────────────────────┬──────────────────────────┐
│ IRMA                    │ Neovascularización       │
├─────────────────────────┼──────────────────────────┤
│ Dentro de la retina     │ Sobre la retina          │
│ No cruza vasos mayores  │ Cruza vasos mayores      │
│ Sin bucles              │ Con bucles               │
│ Color similar a retina  │ Color más brillante      │
│ Indica NPDR severa      │ Indica PDR               │
└─────────────────────────┴──────────────────────────┘
```

### Datasets recomendados:
1. **IDRiD** (Indian Diabetic Retinopathy Image Dataset)
   - URL: https://ieee-dataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid
   - Contenido: 516 imágenes con IRMA anotadas
   - Formato: Máscaras de segmentación
   - Calidad: ⭐⭐⭐⭐⭐

2. **DDR Dataset** (Diabetic Retinopathy Detection)
   - URL: https://github.com/nkicsl/DDR-dataset
   - Contenido: 13,673 imágenes, 757 con IRMA
   - Formato: Bounding boxes + clasificación
   - Calidad: ⭐⭐⭐⭐

3. **Messidor-2**
   - URL: http://www.adcis.net/en/third-party/messidor2/
   - Contenido: 1,748 imágenes graduadas
   - Calidad: ⭐⭐⭐⭐

### Estrategia de anotación:
```python
# Características para anotar:
annotations = {
    "class": "irma",
    "bbox": [x, y, width, height],
    "attributes": {
        "location": "superior|inferior|nasal|temporal",
        "extent": "minimal|moderate|extensive",
        "clarity": "definite|questionable"  # Para filtrar luego
    }
}
```

### Posibles "arañas arteriales" del usuario:
- ✅ **Muy probablemente IRMA**
- Entrenar esta clase resolverá ese hallazgo

---

## 🔴 **PRIORIDAD 2: VENOUS BEADING** (Arrosariamiento Venoso)

### ¿Qué es?
- **Definición:** Dilataciones segmentarias de venas retinales (aspecto de "rosario" o "salchicha")
- **Aspecto visual:** Venas con zonas de dilatación y constricción alternadas
- **Importancia:** ⭐⭐⭐⭐⭐ Segundo criterio de regla 4-2-1

### Características distintivas:
```
Vena normal:  ━━━━━━━━━━━━━━━━━━━ (calibre uniforme)
Venous beading: ━━●━━●━━━●━━●━━━ (calibre irregular)
```

### ⚠️ **Desafío técnico:**
- **Difícil para detección automática** (cambios sutiles de calibre)
- **Recomendación:** Empezar con anotación manual + asistente de IA gradualmente

### Datasets recomendados:
1. **APTOS 2019**
   - URL: https://www.kaggle.com/c/aptos2019-blindness-detection
   - Contenido: 3,662 imágenes graduadas
   - Nota: No tiene anotaciones específicas, pero casos severos tienen venous beading
   - Requiere reannotación

2. **EyePACS**
   - URL: https://www.kaggle.com/c/diabetic-retinopathy-detection
   - Contenido: 88,702 imágenes
   - Similar a APTOS, requiere anotación

### Enfoque incremental:
```
Fase 1 (Corto plazo):
└── Solo anotación manual en su aplicación
    └── Los evaluadores marcan venous beading manualmente
        └── Acumular datos propios

Fase 2 (Mediano plazo):
└── Modelo simple de clasificación (sí/no venous beading por imagen)
    └── No requiere bounding boxes
        └── Más fácil de entrenar

Fase 3 (Largo plazo):
└── Detección precisa con bounding boxes
    └── Requiere muchas anotaciones (~500+)
```

---

## 🟡 **PRIORIDAD 3: MACULAR EDEMA**

### ¿Qué es?
- **Definición:** Acumulación de fluido en la mácula
- **Importancia:** ⭐⭐⭐⭐⭐ Principal causa de pérdida de visión en DM
- **Nota:** No afecta severidad de DR, pero es CRÍTICO para decisión de tratamiento

### Enfoques de detección:

#### Opción A: Análisis indirecto (más fácil)
```typescript
// Basado en hallazgos existentes
function estimateMacularEdemaRisk(
  hardExudates: Detection[],
  imageSize: { width: number; height: number },
  opticDiscLocation: { x: number; y: number }
): 'none' | 'suspected' | 'likely' {
  // Calcular centro macular (2.5 DD temporal al disco)
  const macularCenter = {
    x: opticDiscLocation.x + (2.5 * discDiameter),
    y: opticDiscLocation.y
  };

  // Contar exudados duros en zona macular (círculo de 3000μm = ~1 DD)
  const exudatesInMacula = hardExudates.filter(exudate => {
    const distance = Math.sqrt(
      Math.pow(exudate.bbox.x - macularCenter.x, 2) +
      Math.pow(exudate.bbox.y - macularCenter.y, 2)
    );
    return distance <= discDiameter;
  });

  if (exudatesInMacula.length === 0) return 'none';
  if (exudatesInMacula.length < 3) return 'suspected';
  return 'likely';
}
```

#### Opción B: Segmentación de fluido (óptimo pero difícil)
- Requiere modelo de segmentación separado
- Necesita imágenes con anotaciones de edema
- Idealmente con OCT correlacionado

### Datasets recomendados:
1. **DIARETDB1**
   - URL: http://www.it.lut.fi/project/imageret/diaretdb1/
   - Contenido: 89 imágenes con exudados duros anotados
   - Útil para enfoque indirecto

2. **Kaggle Diabetic Macular Edema**
   - Varios datasets con OCT + fotografías de fondo

### Recomendación:
```
1. Implementar YA: Estimación indirecta (Opción A)
   └── Usar detecciones existentes de hard_exudate
       └── Solo lógica geométrica

2. Futuro: Modelo de segmentación (Opción B)
   └── Cuando tengan recursos para entrenamiento
```

---

## 🟡 **PRIORIDAD 4: VITREOUS/PRERETINAL HEMORRHAGE**

### ¿Qué es?
- **Definición:** Sangre en cavidad vítrea o delante de la retina
- **Aspecto visual:** Áreas densas oscuras, puede bloquear visión de retina subyacente
- **Importancia:** ⭐⭐⭐⭐ Signo de PDR avanzada

### Características distintivas:
```
Hemorragia retinal:     • Dentro de la retina
                       • Bordes definidos
                       • Patrón puntiforme/en llama

Hemorragia preretinal: • Delante de la retina
                       • Nivel de fluido (boat-shaped)
                       • Bordes menos definidos

Hemorragia vítrea:     • En cavidad vítrea
                       • Puede bloquear vista de retina
                       • Densidad variable
```

### Datasets recomendados:
1. **EyePACS** (casos avanzados)
2. **Kaggle DR Detection** (filtrar grados 3-4)

### Estrategia:
```
Fase 1: Extender clase "hemorrhage" existente
└── Añadir atributo "location"
    ├── "intraretinal"
    ├── "preretinal"
    └── "vitreous"

Fase 2: Clases separadas si necesario
```

---

## 🟢 **PRIORIDAD 5: FIBROUS PROLIFERATION**

### ¿Qué es?
- **Definición:** Tejido fibroso que crece junto con neovascularización
- **Importancia:** ⭐⭐⭐ Riesgo de desprendimiento de retina por tracción
- **Desafío:** Difícil de distinguir de neovascularización en fotografías

### Recomendación:
- **Baja prioridad** para modelo automático
- Mejor como anotación manual por ahora

---

## 📊 **RESUMEN DE DATASETS**

### Para IRMA (Alta prioridad):
```
1. IDRiD (516 imágenes con IRMA)
   ├── Descargar de: https://ieee-dataport.org/open-access/indian-diabetic-retinopathy-image-dataset-idrid
   ├── Formato: Máscaras de segmentación
   └── Usar para: Entrenamiento YOLOv8 segmentación

2. DDR Dataset (757 con IRMA de 13,673 total)
   ├── GitHub: https://github.com/nkicsl/DDR-dataset
   ├── Formato: Bounding boxes
   └── Usar para: Entrenamiento YOLOv8 detección
```

### Para Venous Beading (Alta prioridad):
```
1. Fase inicial: Anotación manual en DIRD
   └── Acumular 100-200 casos propios

2. Futuro: APTOS 2019 + reannotación
```

### Para Edema Macular (Alta prioridad - enfoque indirecto):
```
1. Implementar con clases existentes (hard_exudate)
   └── No requiere nuevo dataset inicialmente

2. Futuro: DIARETDB1 para validación
```

---

## 🛠️ **PIPELINE DE ENTRENAMIENTO RECOMENDADO**

### 1. Preparación de datos:
```bash
# Estructura de carpetas
data/
├── images/
│   ├── train/
│   ├── val/
│   └── test/
└── labels/
    ├── train/
    ├── val/
    └── test/

# Formato YOLO (labels/train/image001.txt)
# class_id center_x center_y width height
0 0.5 0.5 0.1 0.1  # microaneurysm
1 0.3 0.4 0.2 0.15  # hemorrhage
5 0.6 0.7 0.15 0.12 # irma (NUEVO)
```

### 2. Entrenamiento YOLOv8:
```python
from ultralytics import YOLO

# Cargar modelo pre-entrenado
model = YOLO('yolov8n.pt')

# Configuración de clases
classes = [
    'microaneurysm',
    'hemorrhage',
    'hard_exudate',
    'soft_exudate',
    'neovascularization',
    'irma',  # NUEVO
    # 'venous_beading',  # FUTURO
]

# Entrenar
results = model.train(
    data='retinopathy.yaml',
    epochs=100,
    imgsz=640,
    batch=16,
    device='0',  # GPU
    patience=20,  # Early stopping
    save_period=10,
    # Data augmentation
    hsv_h=0.015,
    hsv_s=0.7,
    hsv_v=0.4,
    degrees=10,
    translate=0.1,
    scale=0.5,
    flipud=0.5,
    fliplr=0.5
)
```

### 3. Validación médica:
```python
# Validar con oftalmólogo
# Calcular métricas por clase
for class_name in classes:
    precision = ...
    recall = ...
    f1_score = ...

    print(f"{class_name}:")
    print(f"  Precision: {precision:.3f}")
    print(f"  Recall: {recall:.3f}")
    print(f"  F1: {f1_score:.3f}")

# Requisitos mínimos por clase:
# - IRMA: Recall > 0.70 (preferible > 0.80)
# - Venous beading: Recall > 0.60 (más difícil)
```

---

## 📅 **ROADMAP SUGERIDO**

### Mes 1-2:
- [ ] Implementar mejoras inmediatas (cuadrantes, umbrales)
- [ ] Implementar detección indirecta de edema macular
- [ ] Empezar anotación manual de IRMA en casos propios

### Mes 3-4:
- [ ] Descargar y preparar datasets IDRiD + DDR
- [ ] Entrenar modelo con clase IRMA
- [ ] Validar con oftalmólogos (min 100 casos)

### Mes 5-6:
- [ ] Integrar modelo con IRMA en producción
- [ ] Empezar recolección de casos con venous beading
- [ ] Entrenar clasificador simple venous beading (sí/no)

### Mes 7-12:
- [ ] Refinar todos los modelos
- [ ] Validación clínica amplia (500+ casos)
- [ ] Publicación de resultados

---

## 🎓 **CONCLUSIÓN**

**Para responder a "arañas arteriales":**
- ✅ Muy probablemente se refiere a **IRMA**
- ✅ Es una clase CRÍTICA que falta
- ✅ Datasets disponibles para entrenar
- ✅ Debe ser su siguiente prioridad de entrenamiento

**Orden de implementación recomendado:**
```
1. PRIMERO: Mejoras de código (sin entrenar)
   └── Cuadrantes, umbrales, edema macular indirecto

2. SEGUNDO: Entrenar IRMA
   └── Usar IDRiD + DDR datasets

3. TERCERO: Sistema de anotación manual venous beading
   └── Acumular datos propios

4. CUARTO: Modelo de venous beading
   └── Cuando tengan suficientes anotaciones
```

**Tiempo estimado total:** 6-9 meses para sistema completo de nivel clínico
