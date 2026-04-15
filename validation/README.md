# Validación Científica DIRD+

Scripts de validación para evaluar los modelos ONNX de DIRD+ sobre datasets públicos de referencia.

## Estructura

```
validation/
├── validate_dird.py          # Script principal de validación
├── datasets/                 # Datasets (ignorado por git, descargar manualmente)
│   ├── aptos2019/
│   │   ├── train.csv
│   │   └── train_images/
│   └── idrid/
│       └── ...
├── results/                  # Resultados generados (ignorado por git)
└── README.md
```

## Setup

```bash
pip install onnxruntime numpy opencv-python pandas scikit-learn matplotlib Pillow tqdm
```

## Dataset APTOS 2019

Descargar desde Kaggle: [aptos2019-blindness-detection](https://www.kaggle.com/c/aptos2019-blindness-detection/data)

Colocar en `datasets/aptos2019/`:
- `train.csv` — labels (columnas: id_code, diagnosis)
- `train_images/` — ~3,600 imágenes .png

## Uso

```bash
python validate_dird.py \
    --model /path/to/detection-model.onnx \
    --csv datasets/aptos2019/train.csv \
    --images datasets/aptos2019/train_images/ \
    --output results/aptos2019/ \
    --classes-json /path/to/detection-metadata.json \
    --conf-threshold 0.5 \
    --iou-threshold 0.45 \
    --benchmark \
    --n-benchmark 100
```

## Outputs

| Archivo | Contenido |
|---------|-----------|
| `metrics_binary.json` | Sensitivity, specificity, AUC-ROC, accuracy, F1 |
| `metrics_grading.json` | Quadratic Weighted Kappa, per-class accuracy |
| `benchmark.json` | Tiempos de inferencia (mean, std, median) |
| `roc_curve.png` | Curva ROC 300 DPI |
| `confusion_matrix.png` | Matriz de confusión normalizada 300 DPI |
| `results_per_image.csv` | Predicción por imagen |
| `validation_report.txt` | Resumen legible de todas las métricas |
