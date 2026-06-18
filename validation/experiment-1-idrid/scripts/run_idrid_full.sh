#!/bin/bash
# Experiment 1 — IDRiD lesion detection (detection-v2.0.0, YOLO end-to-end).
# Run from this scripts/ directory. Paths are relative to the experiment root (..).
set -e

MODEL=../../models/detection-v2.0.0.onnx
DATASET=../datasets/idrid/full
CLASSES=../../models/detection-v2.0.0.json

# Strict match IoU = 0.5
python validate_idrid_e2e.py \
    --model "$MODEL" --dataset "$DATASET" --classes-json "$CLASSES" \
    --output ../results/match-iou-0.5 \
    --conf-threshold 0.1 --iou-threshold 0.5 --benchmark

# Lenient match IoU = 0.1
python validate_idrid_e2e.py \
    --model "$MODEL" --dataset "$DATASET" --classes-json "$CLASSES" \
    --output ../results/match-iou-0.1 \
    --conf-threshold 0.1 --iou-threshold 0.1 --benchmark
