# Informe técnico completo — Validación de DIRD+ v2 sobre APTOS 2019

**Fecha de cierre:** 2026-04-30
**Modelo evaluado:** `detection-v2.0.0.onnx` (YOLOv26s end2end NMS, 6 clases activas)
**Dataset:** APTOS 2019 Blindness Detection (Kaggle), split `train.csv` (n=3662)
**Hardware:** CPU, ONNX Runtime 1.25.1, sin batch
**Autor del experimento:** Nicolás Baier Quezada

---

## 0. Índice de experimentos

| # | Experimento | Pregunta | Directorio |
|---|---|---|---|
| 1 | Corrida binaria base | ¿Generaliza el modelo OOD a APTOS? | `aptos_binary_20260430_135006/` |
| 2 | Barrido conf/N | ¿Cuál es el operating point uniforme óptimo? | `aptos_sweep_20260430_140753/` |
| 3 | Calibración per-clase | ¿Mejora con τ por clase en lugar de uniforme? | `aptos_perclass_20260430_143710/` |
| 4 | 5-fold cross-validation | ¿Los τ per-clase generalizan o overfittean? | `aptos_cv_20260430_144021/` |
| 5 | Filtro de área | ¿Bbox grandes son más confiables que pequeñas? | `aptos_area_filter_20260430_150205/` |
| 6 | Área + per-clase | ¿Suman o son redundantes? | `aptos_area_perclass_20260430_150521/` |

---

## 1. Diseño común

### 1.1 Dataset

APTOS 2019 entrega un grado clínico de retinopatía diabética en escala 0–4
(International Clinical Diabetic Retinopathy):

| Grado | Significado clínico | Etiqueta binaria | n |
|------:|---------------------|:----------------:|---:|
| 0 | Sin retinopatía | normal | 1805 |
| 1 | RD leve | patológico | 370 |
| 2 | RD moderada | patológico | 999 |
| 3 | RD severa | patológico | 193 |
| 4 | RD proliferativa | patológico | 295 |

Total normales = 1805, total patológicos = 1857 (49.3% / 50.7%).

### 1.2 Modelo

DIRD+ v2 detecta 6 clases:

| Idx | Clase | Categoría | mAP@50 train |
|---:|---|---|---:|
| 0 | optic_disc | landmark | 0.995 |
| 1 | hard_exudate | lesión | 0.364 |
| 2 | fovea | landmark | 0.855 |
| 3 | hemorrhage | lesión | 0.161 |
| 4 | cotton_wool_spot | lesión | 0.590 |
| 5 | microhemorrhages | lesión | 0.502 |

### 1.3 Pre/post-procesado y mapeo binario

- BGR→RGB, resize directo a 640×640, normalización [0,1], CHW float32.
- Output `[1, D, 6] = [x1, y1, x2, y2, score, class]` (NMS interno).
- Sin re-NMS, sin TTA.
- Mapeo binario base: **ALTERADO** ⇔ ∃ detección con
  `class ∉ {0=optic_disc, 2=fovea}` y score ≥ τ.

### 1.4 Métricas reportadas

Sensitivity (recall), Specificity, PPV (precision), NPV, Accuracy, F1, MCC,
Youden J, AUC-ROC, matriz de confusión, sensibilidad por grado APTOS,
tiempos de inferencia (mean / median / p95 / p99 / FPS).

---

## 2. Experimento 1 — Corrida binaria base

**Pregunta:** ¿el modelo, entrenado en IDRiD/conjunto interno, generaliza
a APTOS sin ningún ajuste?
**Configuración:** una sola corrida con `conf=0.25` uniforme y regla
"any non-anatomical class".

### Resultados clave

| Métrica | Valor |
|---|---:|
| Sensibilidad | **0.9968** |
| Especificidad | 0.4565 |
| AUC-ROC | 0.9488 |
| MCC | 0.5413 |
| Acc / F1 | 0.7305 / 0.7895 |
| FN / FP | **6** / 981 |

**Sensibilidad por grado:** g1 0.989 · g2 0.999 · g3 1.000 · g4 0.997.
**Tiempo:** mean 112 ms, p95 127 ms, FPS ≈ 8.92.

### Conclusión

El modelo **generaliza fuertemente fuera de dominio** (AUC 0.95). En modo
screening puro pierde solo 6 de 1857 patológicos. Costo: 981 falsos
positivos sobre 1805 normales. Necesario refinar el operating point.

---

## 3. Experimento 2 — Barrido conf y N

**Pregunta:** ¿qué umbral uniforme y/o conteo mínimo de detecciones
balancea mejor sens/spec?
**Configuración:** 11 reglas evaluadas tras inferencia única (dump
`raw_detections.csv` con score ≥ 0.05). R1 = ∃ lesión a varios τ;
R2 = ≥K lesiones a τ=0.25; R3 = combinada `conf≥0.40 ∧ N≥2`.

### Tabla principal

| Regla | Sens | Spec | PPV | NPV | MCC | J | AUC |
|---|---:|---:|---:|---:|---:|---:|---:|
| R1 conf≥0.25 | 0.9968 | 0.4565 | 0.654 | 0.993 | 0.541 | 0.453 | 0.9488 |
| R1 conf≥0.40 | 0.9812 | 0.6776 | 0.758 | 0.972 | 0.694 | 0.659 | 0.9456 |
| R1 conf≥0.50 | 0.9591 | 0.8216 | 0.847 | 0.951 | 0.789 | 0.781 | 0.9391 |
| R1 conf≥0.60 | 0.9122 | 0.8953 | 0.900 | 0.908 | 0.808 | 0.808 | 0.9210 |
| R1 conf≥0.70 | 0.8239 | 0.9346 | 0.928 | 0.838 | 0.762 | 0.759 | 0.8829 |
| R2 N≥2 conf=0.25 | 0.9779 | 0.6920 | 0.766 | 0.968 | 0.701 | 0.670 | 0.9642 |
| R2 N≥3 conf=0.25 | 0.9515 | 0.8155 | 0.841 | 0.942 | 0.775 | 0.767 | 0.9642 |
| R2 N≥5 conf=0.25 | 0.8783 | 0.9169 | 0.916 | 0.880 | 0.795 | 0.795 | 0.9642 |
| **R3 conf≥0.40 ∧ N≥2** | **0.9316** | **0.9180** | **0.921** | **0.929** | **0.850** | **0.850** | 0.9456 |

AUC con `count` como score (0.964) > AUC con `max_score` (0.949) — el
**conteo de lesiones es más informativo** que el score máximo solo.

### Conclusión

R3 es el mejor punto **uniforme** (MCC 0.85). Pero sub-utiliza la señal
de las clases buenas: las clases con AUC alto pierden recall por usar
τ=0.40; las clases ruidosas siguen contaminando. Hipótesis para Exp 3:
calibrar τ por clase.

---

## 4. Experimento 3 — Calibración per-clase

**Pregunta:** ¿qué τ óptimo tiene cada clase de lesión por separado?
**Configuración:** sobre el dump de Exp 2, calcular `score máx por
(imagen, clase)` y curva ROC contra GT binario por clase. Tres métodos
de elección de τ:

- **Youden J** — maximiza TPR − FPR (operating point estadístico).
- **FPR ≤ 5%** — más estricto, descarta los falsos positivos comunes.
- **FPR ≤ 2%** — muy estricto, prioriza specificity.

### Calibración resultante

| Clase | AUC clase | τ_youden | τ_fpr05 | τ_fpr02 | FP@0.25 normales |
|---|---:|---:|---:|---:|---:|
| hard_exudate | 0.906 | 0.518 | 0.558 | **0.633** | 771 / 1805 |
| hemorrhage | 0.639 | 0.050 | 0.050 | 0.050 | 5 / 1805 |
| cotton_wool_spot | 0.710 | 0.050 | 0.745 | **0.853** | 212 / 1805 |
| microhemorrhages | **0.988** | 0.121 | 0.120 | **0.258** | 38 / 1805 |

**Hallazgos:**

- `microhemorrhages` es la mejor clase del modelo (AUC 0.988), pero
  saturaba FPs porque el conf=0.25 era demasiado bajo para su distribución.
  El τ óptimo está en 0.26.
- `hard_exudate` necesita τ alto (0.63) — sobre-detecta en sanos.
- `hemorrhage` es ruidosa (AUC 0.64); su contribución es marginal.
- `cotton_wool_spot` requiere τ muy alto (0.85) para limpiarse.

### Reglas combinadas

| Regla | Sens | Spec | MCC | J |
|---|---:|---:|---:|---:|
| UNI_0.25 (baseline) | 0.997 | 0.456 | 0.541 | 0.453 |
| R3 (Exp 2 ganador uniforme) | 0.932 | 0.918 | 0.850 | 0.850 |
| PCT_youden | 0.999 | 0.725 | 0.755 | 0.724 |
| PCT_fpr05 | 0.996 | 0.855 | 0.861 | 0.851 |
| **PCT_fpr02** | **0.978** | **0.933** | **0.913** | **0.911** |
| PCT_youden_n2 | 0.919 | 0.974 | 0.894 | 0.893 |

### Conclusión

**Salto cualitativo grande**: PCT_fpr02 mejora MCC de 0.85 → 0.913
sobre R3. Sensibilidad casi sin pérdida (0.932 → 0.978) y specificity
similar (0.918 → 0.933). **La palanca correcta era τ por clase, no τ
uniforme.**

---

## 5. Experimento 4 — 5-fold cross-validation

**Pregunta:** ¿los τ per-clase de Exp 3 son específicos del dataset
(overfitting) o estables?
**Configuración:** StratifiedKFold k=5, seed=42. Por fold: calibrar τ
en train (4/5 ≈ 2930 imgs), evaluar en test (1/5 ≈ 732 imgs).

### Estabilidad de umbrales

| Método | hard_exudate | hemorrhage | cotton_wool_spot | microhemorrhages |
|---|---|---|---|---|
| Youden | 0.5228 ± 0.010 | 0.0502 ± 0.0002 | 0.0502 ± 0.0002 | 0.1274 ± 0.010 |
| FPR=2% | 0.6337 ± 0.0003 | 0.0502 ± 0.0002 | 0.8534 ± 0.0012 | 0.2573 ± 0.016 |
| FPR=5% | 0.5568 ± 0.003 | 0.0502 ± 0.0002 | 0.7421 ± 0.004 | 0.1218 ± 0.008 |

Coeficiente de variación máximo (CV = σ/μ): 8% (microhemorrhages
método FPR=2%). Todos los demás <1%.

### Métricas con CV

| Regla | Sens | Spec | MCC | J |
|---|---|---|---|---|
| UNI_0.25 | 0.997 ± 0.003 | 0.456 ± 0.022 | 0.541 ± 0.018 | 0.453 ± 0.022 |
| **PCT_fpr02** | **0.978 ± 0.013** | **0.931 ± 0.004** | **0.911 ± 0.015** | **0.909 ± 0.014** |
| PCT_youden_n2 | 0.915 ± 0.014 | 0.974 ± 0.006 | 0.890 ± 0.018 | 0.889 ± 0.018 |
| PCT_fpr05 | 0.996 ± 0.005 | 0.855 ± 0.015 | 0.861 ± 0.010 | 0.851 ± 0.012 |

### Conclusión

**Sin overfitting.** PCT_fpr02 reproduce su MCC ≈ 0.91 en cada fold con
desviación ≤ 0.015. Los τ son extremadamente estables — la calibración
hecha sobre `train.csv` completo es la calibración poblacional óptima
para este modelo.

---

## 6. Experimento 5 — Filtro de área

**Pregunta:** ¿los FPs son detecciones pequeñas (ruido/artefactos)?
Si sí, un filtro de área mínima debería mejorar sin reentrenar.
**Configuración:** re-inferencia guardando bboxes (cache
`raw_detections_bbox.csv`, 156167 detecciones). MIN_AREA en
{0, 50, 100, 200, 400, 800} píxeles sobre la imagen original. Aplicar
filtro **antes** de la regla de decisión.

### Eliminaciones por área

| MIN_AREA | hard_exudate | hemorrhage | cotton_wool_spot | microhemorrhages |
|---:|---:|---:|---:|---:|
| 100 | 3 (0.0%) | 0 | 0 | 0 |
| 200 | 356 (0.4%) | 0 | 0 | 55 (0.1%) |
| 400 | 10 078 (10.5%) | 0 | 3 | 468 (1.1%) |
| 800 | 19 751 (20.5%) | 1 | 37 | 3173 (7.4%) |

### Evolución de R3 (conf≥0.40 ∧ N≥2) con MIN_AREA

| MIN_AREA | Sens | Spec | MCC | J |
|---:|---:|---:|---:|---:|
| 0 | 0.9316 | 0.9180 | 0.8498 | 0.8496 |
| 200 | 0.9316 | 0.9180 | 0.8498 | 0.8496 |
| 400 | 0.9316 | 0.9230 | 0.8547 | 0.8546 |
| **800** | **0.9246** | **0.9540** | **0.8787** | **0.8786** |

### Conclusión

Hipótesis **parcialmente confirmada**: a MIN_AREA=800 sí mejora MCC
0.85 → 0.88 (+0.03), pero sigue por debajo de PCT_fpr02 (Exp 3, MCC
0.913). El filtro funciona porque elimina exactamente las clases
ruidosas (`hard_exudate` 20.5%, `microhemorrhages` 7.4%) — pero la
calibración per-clase ya hace esto mejor de forma score-driven.

---

## 7. Experimento 6 — Área + per-clase combinado

**Pregunta:** ¿filtro de área y calibración per-clase son aditivos
(suman) o redundantes (la misma información)?
**Configuración:** para cada MIN_AREA en {0, 200, 400, 800, 1200},
recalibrar τ_c sobre el conjunto filtrado y reevaluar reglas PCT.

### Resultados (regla PCT_fpr02)

| MIN_AREA | τ hard_exud | AUC clase | Sens | Spec | MCC |
|---:|---:|---:|---:|---:|---:|
| 0 | 0.633 | 0.906 | 0.9785 | 0.9330 | 0.9129 |
| 400 | 0.633 | 0.907 | 0.9785 | 0.9330 | 0.9129 |
| 800 | 0.611 | 0.946 | 0.9779 | 0.9324 | 0.9118 |
| **1200** | 0.558 | 0.956 | 0.9790 | 0.9324 | 0.9129 |

Conducta análoga en `microhemorrhages` (AUC 0.988 → 0.984 con area=800).

### Conclusión

**Son palancas redundantes.** La calibración per-clase ya elige el τ
que descarta detecciones de baja calidad — y las detecciones pequeñas
suelen tener score bajo, así que filtrarlas explícitamente no agrega
información. El AUC interno de la clase mejora con el filtro, pero el
τ se ajusta y compensa: el resultado final es invariante.

---

## 8. Síntesis y recomendación final

### 8.1 Tabla maestra de mejores puntos

| Experimento | Operating point | Sens | Spec | MCC | J |
|---|---|---:|---:|---:|---:|
| 1 — base | conf=0.25 uniforme | **0.997** | 0.456 | 0.541 | 0.453 |
| 2 — sweep | R3 (conf≥0.40 ∧ N≥2) | 0.932 | 0.918 | 0.850 | 0.850 |
| 3 — per-clase | **PCT_fpr02** | 0.978 | 0.933 | **0.913** | **0.911** |
| 4 — CV | PCT_fpr02 (CV) | 0.978 ± 0.013 | 0.931 ± 0.004 | 0.911 ± 0.015 | 0.909 ± 0.014 |
| 5 — área | R3 + area=800 | 0.925 | 0.954 | 0.879 | 0.879 |
| 6 — combinado | PCT_fpr02 + area=1200 | 0.979 | 0.932 | 0.913 | 0.911 |

### 8.2 Operating point recomendado para producción

**Regla PCT_fpr02 (sin filtro de área):**

```python
# Umbrales por clase (calibrados sobre APTOS 2019, validados con 5-fold CV)
TAU = {
    "hard_exudate":     0.63,
    "microhemorrhages": 0.26,
    "cotton_wool_spot": 0.85,
    "hemorrhage":       0.05,   # clase débil (AUC 0.64), aporta poco
}

# ALTERADO  ⇔  ∃ clase c con score(c) ≥ TAU[c]
# NORMAL    ⇔  solo se detectan landmarks (optic_disc, fovea) o nada
```

**Desempeño esperado (validado, 5-fold CV):**

- Sens 0.978 ± 0.013
- Spec 0.931 ± 0.004
- PPV 0.876, NPV 0.995
- MCC 0.911 ± 0.015, Youden J 0.909
- AUC-ROC 0.967

### 8.3 Modos alternativos según caso de uso

| Modo | Regla | Sens | Spec | Cuándo usar |
|---|---|---:|---:|---|
| **Screening máxima sens** | conf≥0.25 uniforme | 0.997 | 0.456 | Tamizaje masivo donde no se puede perder ningún caso |
| **Producción balanceado** | **PCT_fpr02** | **0.978** | **0.933** | **Default recomendado** |
| Asistencial alta spec | PCT_youden_n2 | 0.915 | 0.974 | Triage donde el sobre-flag tiene alto costo |
| Confirmación | PCT_fpr02 + N≥2 | 0.747 | 0.997 | Segunda opinión / segunda línea |

### 8.4 Limitaciones

- Validación sobre **APTOS 2019 train.csv** — un único dataset, una única
  cohorte (India, cámaras heterogéneas). Idealmente cross-validar con
  Messidor-2 o EyePACS para confirmar generalización a otras poblaciones.
- APTOS no entrega anotaciones a nivel de lesión, por lo que no se mide
  IoU/mAP. La validación es a nivel de clasificación binaria por imagen.
- Tiempos medidos en CPU; en GPU/Tauri-bundle se esperan latencias
  5-10× menores.
- La clase `hemorrhage` muestra AUC bajo (0.64); su mejora requeriría
  reentrenamiento con más datos balanceados, no calibración.

### 8.5 Próximos pasos recomendados

1. **Ya implementable hoy:** integrar τ per-clase de PCT_fpr02 en el
   producto Tauri (ajuste de inferencia post-procesado).
2. **Validación externa:** repetir Exp 3-4 sobre Messidor-2 o EyePACS
   para confirmar τ poblacionales.
3. **Reentrenamiento prioritario** (próxima versión del modelo):
   - Recall sobre `hemorrhage` (AUC 0.64 — clase débil).
   - Reducir sobre-detección en `hard_exudate` (FPR ~43% en sanos).
   - Posible separación `microhemorrhages` ↔ `microaneurysm` con
     anotaciones dedicadas.
4. **Producto:** exponer los modos {screening / balanceado / alta-spec}
   como toggle de UI según preferencia del clínico.

---

## 9. Reproducibilidad

### 9.1 Stack

```
python 3.x + venv en validation/.venv
onnxruntime 1.25.1
opencv-python-headless
numpy, pandas, scikit-learn, tqdm, matplotlib
seed: numpy.random.seed(42)
```

### 9.2 Scripts y orden de ejecución

```bash
cd validation
source .venv/bin/activate

# Exp 1 — corrida base con conf=0.25
python run_aptos_binary_experiment.py

# Exp 2 — barrido de reglas + dump raw_detections.csv (sin bbox)
python run_aptos_sweep.py

# Exp 3 — calibración per-clase (reusa dump del Exp 2)
python run_aptos_perclass.py

# Exp 4 — 5-fold CV de τ per-clase (reusa dump del Exp 2)
python run_aptos_cv.py

# Exp 5 — filtro de área (re-infiere y crea raw_detections_bbox.csv)
python run_aptos_area_filter.py

# Exp 6 — área × per-clase (reusa cache del Exp 5)
python run_aptos_area_perclass.py

# Gráficos
python make_aptos_plots.py
python make_perclass_plots.py
python make_cv_plots.py
```

### 9.3 Inputs

```
validation/detection-v2.0.0.onnx
validation/aptos_extracted/train.csv      (3662 filas)
validation/aptos_extracted/train_images/*.png
```

### 9.4 Outputs

```
validation/results/
  ├── INFORME_COMPLETO_APTOS.md          ← este archivo
  ├── raw_detections_bbox.csv            ← cache compartido (con bbox)
  │
  ├── aptos_binary_20260430_135006/      ← Exp 1
  ├── aptos_sweep_20260430_140753/       ← Exp 2  (+ INFORME_TECNICO.md)
  ├── aptos_perclass_20260430_143710/    ← Exp 3
  ├── aptos_cv_20260430_144021/          ← Exp 4
  ├── aptos_area_filter_20260430_150205/ ← Exp 5
  └── aptos_area_perclass_20260430_150521/ ← Exp 6
```

Cada subdirectorio contiene su `report.txt`, `*.csv`, `*.json` y
`plots/*.png` (300 dpi).

---

## 10. Conclusión ejecutiva

DIRD+ v2 es un detector con **fuerte capacidad discriminativa**
(AUC 0.95-0.97) sobre APTOS 2019 sin reentrenamiento. La calibración
**per-clase con FPR=2%** sobre normales eleva el MCC de 0.54 (baseline)
a **0.91** validado por 5-fold CV. Los umbrales son estables (CV<8%) y
clínicamente coherentes con el AUC interno de cada clase. El filtro de
área y la calibración per-clase **son palancas redundantes**; el
operating point recomendado para producción usa la calibración per-clase
como única intervención post-modelo.

> **Headline:** Sens 97.8% / Spec 93.1% / MCC 0.91 a ≈9 FPS CPU,
> validado externamente en n=3662 sin reentrenamiento.
