#!/bin/bash
# Experiment 4 — DDR external validation (detection-v2.0.0, weights NOT retrained).
# Run from anywhere. Args are relative to the experiment ROOT (parent of scripts/);
# the python scripts resolve them against that root.
#
# Pipeline:
#   1. run_ddr_binary.py       -> single inference, raw dump + binary baseline + OOD AUC
#   2. run_ddr_frozen_tau.py   -> frozen APTOS per-class tau vs refit (clean external — raw images)
#   3. bootstrap_ddr_ci.py     -> 95% CIs on the frozen operating point
#   4. make_ddr_plots.py       -> figures
#
# Pre-req: prepare_ddr_dataset.py first (needs DDR DR_grading on disk).
# DDR son ~13k imágenes -> la inferencia en CPU tarda ~30-40 min.
#
# IMAGES = carpeta DR_grading (raíz de la columna relpath de labels.csv). Obligatorio.
#   IMAGES=../data/ddr/DR_grading ./run_ddr_full.sh
#
# Python env: default usa `uv run` con deps efímeras. Override: PY="python" ./run_ddr_full.sh
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SCRIPTS="$ROOT/scripts"

MODEL=../models/detection-v2.0.0.onnx
CSV=ddr_extracted/labels.csv
IMAGES=${IMAGES:?ERROR: definí IMAGES=<carpeta DR_grading>}
APTOS_CALIB=../experiment-2-aptos/results/03-perclass/perclass_calibration.json

PY=${PY:-uv run --quiet --with pandas --with scikit-learn --with numpy \
  --with onnxruntime --with opencv-python-headless --with matplotlib --with tqdm python3}

echo "[*] Runner: $PY"
echo "[*] Root:   $ROOT"
echo "[*] Modelo: $MODEL   CSV: $CSV   Imágenes: $IMAGES"

if [ ! -f "$ROOT/$CSV" ]; then
  echo "[ERROR] No existe $ROOT/$CSV — corré prepare_ddr_dataset.py primero." >&2
  exit 1
fi

$PY "$SCRIPTS/run_ddr_binary.py" --model "$MODEL" --csv "$CSV" --images "$IMAGES"
$PY "$SCRIPTS/run_ddr_frozen_tau.py" --aptos-calib "$APTOS_CALIB"
$PY "$SCRIPTS/bootstrap_ddr_ci.py"
$PY "$SCRIPTS/make_ddr_plots.py"

echo ""
echo "[OK] Listo. Resultados en $ROOT/results/  (01-binary, 03-frozen-tau, 04-bootstrap-ci, plots)"
echo "     Llená la tabla §2 del REPORT.md con frozen_tau.json + bootstrap_ci.json"
