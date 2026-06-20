#!/bin/bash
# Experiment 3 — Messidor external threshold validation (detection-v2.0.0, weights NOT retrained).
# Run from anywhere. All paths below are relative to the experiment ROOT (the parent of scripts/),
# because the python scripts resolve their args against that root (base = __file__.parent.parent).
#
# Pipeline:
#   1. run_messidor_sweep.py       -> single inference, raw dump + binary baseline + OOD AUC
#   2. run_messidor_frozen_tau.py  -> apply FROZEN APTOS per-class tau (the headline) + refit gap
#   3. make_messidor_plots.py      -> figures
#
# Pre-req: run prepare_messidor_dataset.py first (needs the dataset on disk).
#
# Python env: this repo's global python lacks pandas/onnx. Either activate your venv, or
# leave the default below which uses `uv run` with ephemeral deps. Override with e.g.:
#   PY="python" ./run_messidor_full.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$ROOT/scripts"

# Paths relative to ROOT (the python scripts prepend ROOT themselves).
MODEL=../models/detection-v2.0.0.onnx
CSV=messidor_extracted/labels.csv
# Imágenes: por defecto donde prepare las dejó si usaste --copy-images; si no, apuntá a la
# carpeta original (root-relative) con IMAGES=... ./run_messidor_full.sh
IMAGES=${IMAGES:-../data/messidor2/IMAGES}
APTOS_CALIB=../experiment-2-aptos/results/03-perclass/perclass_calibration.json

# Runner: uv con deps efímeras (cambialo a "python" si tenés venv activo).
PY=${PY:-uv run --quiet --with pandas --with scikit-learn --with numpy \
  --with onnxruntime --with opencv-python-headless --with matplotlib --with tqdm python3}

echo "[*] Runner: $PY"
echo "[*] Root:   $ROOT"
echo "[*] Modelo: $MODEL   CSV: $CSV   Imágenes: $IMAGES"

# 0. sanity
if [ ! -f "$ROOT/$CSV" ]; then
  echo "[ERROR] No existe $ROOT/$CSV — corré prepare_messidor_dataset.py primero." >&2
  exit 1
fi

# 1. inferencia única -> dump + baseline binario + AUC OOD
$PY "$SCRIPTS/run_messidor_sweep.py" --model "$MODEL" --csv "$CSV" --images "$IMAGES"

# 2. validación externa: tau congelados de APTOS vs refit en Messidor
$PY "$SCRIPTS/run_messidor_frozen_tau.py" --aptos-calib "$APTOS_CALIB"

# 3. figuras
$PY "$SCRIPTS/make_messidor_plots.py"

echo ""
echo "[OK] Listo. Resultados en $ROOT/results/  (01-binary, 03-frozen-tau, plots)"
echo "     Llená la tabla §2 del REPORT.md con frozen_tau.json + 01-binary/metrics.json"
