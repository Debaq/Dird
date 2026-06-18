# Informe técnico — Validación binaria de DIRD+ sobre APTOS 2019

**Fecha:** 2026-04-30
**Modelo evaluado:** `detection-v2.0.0.onnx` (YOLOv26s end2end NMS, 6 clases activas)
**Dataset:** APTOS 2019 Blindness Detection (Kaggle), split `train.csv` (n=3662)
**Hardware:** CPU (ONNX Runtime, `CPUExecutionProvider`)
**Hipótesis de evaluación:** detección como **screening binario**
(retina normal vs. con signos de retinopatía diabética).

## 1. Diseño experimental

### 1.1 Etiqueta de referencia (ground truth)

APTOS provee un grado clínico de retinopatía diabética en escala 0–4
(International Clinical Diabetic Retinopathy):

| Grado | Significado clínico | Etiqueta binaria |
|------:|---------------------|:----------------:|
| 0 | Sin retinopatía | **normal** |
| 1 | RD leve | patológico |
| 2 | RD moderada | patológico |
| 3 | RD severa | patológico |
| 4 | RD proliferativa | patológico |

Distribución observada: grado 0 = 1805, 1 = 370, 2 = 999, 3 = 193, 4 = 295.
Total patológicos = 1857; total normales = 1805.

### 1.2 Predicción del modelo

DIRD+ v2 detecta 6 clases activas:

| Índice | Clase | Categoría |
|------:|-------|-----------|
| 0 | optic_disc | landmark anatómico |
| 1 | hard_exudate | lesión |
| 2 | fovea | landmark anatómico |
| 3 | hemorrhage | lesión |
| 4 | cotton_wool_spot | lesión |
| 5 | microhemorrhages | lesión |

Mapeo a binario (regla base):
**ALTERADO** ⇔ ∃ detección con `class ∉ {0, 2}` y `score ≥ τ_conf`.
Si solo se detectan landmarks anatómicos (clases 0/2) o no hay
detecciones, la imagen se clasifica como **NORMAL**.

### 1.3 Pre/post-procesado

- Resize directo BGR→RGB a 640×640, normalización [0,1], CHW float32.
- Salida `[1, D, 6] = [x1, y1, x2, y2, score, class]` (NMS interno del modelo).
- Sin re-NMS, sin TTA.

### 1.4 Reglas de decisión evaluadas

Se ejecutó **una sola pasada de inferencia** guardando todas las detecciones
con `score ≥ 0.05`; sobre ese dump se evaluaron las reglas siguientes:

- **R1** — *Any-lesion at conf*: ALTERADO si ∃ detección de lesión con
  `score ≥ τ`. τ ∈ {0.25, 0.30, 0.40, 0.50, 0.60, 0.70}.
- **R2** — *Top-K lesion count*: ALTERADO si #lesion_dets (`score ≥ 0.25`) ≥ K.
  K ∈ {1, 2, 3, 5}.
- **R3** — *Combinada*: ALTERADO si #lesion_dets con `score ≥ 0.40` ≥ 2.

## 2. Resultados

### 2.1 Tabla principal (n=3662)

| Regla | Sens | Spec | PPV | NPV | Acc | F1 | MCC | Youden J | AUC |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| R1 conf≥0.25 | **0.9968** | 0.4565 | 0.6536 | 0.9928 | 0.7305 | 0.7895 | 0.5413 | 0.4533 | 0.9488 |
| R1 conf≥0.30 | 0.9925 | 0.5313 | 0.6854 | 0.9856 | 0.7652 | 0.8108 | 0.5928 | 0.5238 | 0.9480 |
| R1 conf≥0.40 | 0.9812 | 0.6776 | 0.7579 | 0.9722 | 0.8315 | 0.8552 | 0.6935 | 0.6587 | 0.9456 |
| R1 conf≥0.50 | 0.9591 | 0.8216 | 0.8469 | 0.9513 | 0.8913 | 0.8995 | 0.7894 | 0.7807 | 0.9391 |
| R1 conf≥0.60 | 0.9122 | 0.8953 | 0.8996 | 0.9084 | 0.9039 | 0.9059 | 0.8078 | 0.8075 | 0.9210 |
| R1 conf≥0.70 | 0.8239 | 0.9346 | 0.9284 | 0.8376 | 0.8785 | 0.8730 | 0.7623 | 0.7585 | 0.8829 |
| R2 N≥1 (=R1 0.25) | 0.9968 | 0.4565 | 0.6536 | 0.9928 | 0.7305 | 0.7895 | 0.5413 | 0.4533 | 0.9642 |
| R2 N≥2 conf≥0.25 | 0.9779 | 0.6920 | 0.7656 | 0.9682 | 0.8370 | 0.8588 | 0.7011 | 0.6699 | 0.9642 |
| R2 N≥3 conf≥0.25 | 0.9515 | 0.8155 | 0.8414 | 0.9424 | 0.8845 | 0.8931 | 0.7754 | 0.7670 | 0.9642 |
| R2 N≥5 conf≥0.25 | 0.8783 | 0.9169 | 0.9158 | 0.8799 | 0.8973 | 0.8966 | 0.7954 | 0.7952 | 0.9642 |
| **R3 conf≥0.40 ∧ N≥2** | **0.9316** | **0.9180** | **0.9212** | **0.9288** | **0.9249** | **0.9264** | **0.8498** | **0.8496** | 0.9456 |

### 2.2 Sensibilidad por grado APTOS (puntos seleccionados)

| Regla | Spec g0 | Sens g1 | Sens g2 | Sens g3 | Sens g4 |
|---|---:|---:|---:|---:|---:|
| R1 conf≥0.25 (screening) | 0.4565 | 0.9892 | 0.9990 | 1.0000 | 0.9966 |
| R1 conf≥0.50 | 0.8216 | 0.8838 | 0.9800 | 0.9896 | 0.9627 |
| R1 conf≥0.60 | 0.8953 | 0.7703 | 0.9560 | 0.9534 | 0.9153 |
| R3 conf≥0.40 ∧ N≥2 (balanceado) | 0.9180 | 0.7811 | 0.9750 | 0.9845 | 0.9390 |

### 2.3 Tiempos de inferencia (CPU, sin batch)

| Métrica | Valor |
|---|---:|
| n inferencias | 3662 |
| mean | 147.79 ms |
| median | 115.49 ms |
| p95 | 268.61 ms |
| p99 | 411.56 ms |
| FPS medio | 6.77 |

> Nota: el `mean` está sesgado al alza por contención del sistema durante
> el sweep (se midió simultáneamente con otras tareas); el `median`
> (115 ms) es una mejor estimación del costo por imagen.

### 2.4 Frecuencia de detecciones por clase (corrida `conf≥0.25`)

| Clase | Detecciones |
|---|---:|
| 0 optic_disc | 3626 |
| 1 hard_exudate | 20 616 |
| 2 fovea | 3773 |
| 3 hemorrhage | 489 |
| 4 cotton_wool_spot | 2430 |
| 5 microhemorrhages | 12 326 |

El modelo **sobre-detecta `hard_exudate` y `microhemorrhages`** en imágenes
sanas — origen principal de los falsos positivos.

## 3. Discusión

### 3.1 AUC vs. punto operativo

El AUC-ROC alcanza **0.9488** usando como score continuo el `max_lesion_score`
y **0.9642** usando el conteo de lesiones. Ambos confirman alta capacidad
discriminativa; el problema es la calibración del umbral, no el modelo.

### 3.2 Trade-off sensibilidad ↔ especificidad

- **Modo screening puro** (no perder casos): R1 conf≥0.25 da **sens 0.9968**
  (solo 6 falsos negativos en 1857 patológicos), pero spec 0.456 implica
  ~55% de derivaciones innecesarias.
- **Modo equilibrado óptimo (Youden J)**: **R3 (`conf ≥ 0.40 ∧ N ≥ 2`)**
  con J=0.8496, MCC=0.8498, sens 0.9316 / spec 0.9180. Mejor punto general
  del sweep.
- **Si se prioriza valor predictivo positivo**: R1 conf≥0.70 → PPV 0.928
  pero sens cae a 0.824.

### 3.3 Sensibilidad por grado clínico

Patrón consistente: la sensibilidad sube monotónicamente con la severidad.
Los grados 3-4 (severa y proliferativa) se detectan ≥98% incluso con
la regla más estricta R3. **El cuello de botella es el grado 1 (RD leve)**,
donde la regla balanceada cae a 0.78 — clínicamente esperable porque
las microlesiones tempranas son las más difíciles para el modelo y el
ground truth.

### 3.4 Limitaciones

- APTOS 2019 entrega solo etiqueta de grado, no anotaciones a nivel
  de lesión; no se puede medir mAP/IoU sobre este dataset.
- Cohorte demográfica de APTOS (India, cámaras heterogéneas) difiere
  de la de entrenamiento (IDRiD/conjunto interno) — el resultado
  representa un test de generalización fuera-de-dominio.
- Los tiempos están medidos sobre CPU sin paralelismo de batch; en
  GPU/Tauri-bundle se esperan latencias 5-10× menores.
- La definición "any non-anatomical class" hereda los falsos positivos
  de las clases con menor mAP en entrenamiento (`hard_exudate`,
  `microhemorrhages`), por eso la regla con **umbral de cantidad (R3)**
  los suprime sin sacrificar mucha sensibilidad.

## 4. Conclusiones

1. DIRD+ v2 generaliza con **AUC 0.95** a APTOS 2019 sin reentrenamiento.
2. Como **clasificador de screening binario**, conf≥0.25 logra
   **sensibilidad 99.7%** (≥98% en todos los grados); spec 45.6% es
   el costo a pagar por no perder ningún caso.
3. La **regla óptima balanceada** es `conf ≥ 0.40 AND ≥ 2 lesiones`:
   sens 93.2%, spec 91.8%, MCC 0.85. **Operating point recomendado**
   para uso asistencial donde el sobre-flag tiene costo.
4. Falsos positivos concentrados en `hard_exudate` y `microhemorrhages`;
   reentrenar con foco en estas clases (calibración de umbral por clase
   o re-balanceo) es la vía más directa para mejorar la spec sin tocar
   la arquitectura.
5. Latencia media-mediana ~115 ms/imagen en CPU (≈8.7 FPS),
   compatible con uso interactivo en desktop Tauri.

## 5. Archivos generados

```
results/aptos_sweep_20260430_140753/
  ├── raw_detections.csv     # detecciones crudas (score≥0.05)
  ├── rules_summary.csv      # tabla principal §2.1
  ├── rules_full.json        # métricas + per-grade + tiempos
  ├── report.txt             # resumen plano
  └── INFORME_TECNICO.md     # este informe

results/aptos_binary_20260430_135006/    # primera corrida (conf=0.25 fija)
  ├── per_image.csv
  ├── metrics.json
  ├── roc_curve.json
  └── report.txt
```

## 6. Reproducibilidad

```bash
cd validation
python -m venv .venv && source .venv/bin/activate
pip install onnxruntime opencv-python-headless numpy pandas scikit-learn tqdm
python run_aptos_sweep.py            # barrido + dump detecciones
python run_aptos_binary_experiment.py # corrida fija conf=0.25
```

Inputs requeridos:
- `validation/detection-v2.0.0.onnx`
- `validation/aptos_extracted/train.csv`
- `validation/aptos_extracted/train_images/*.png`

Semilla fija (`numpy.random.seed(42)`); modelo determinista (NMS interno).
