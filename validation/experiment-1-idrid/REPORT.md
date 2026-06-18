# Experiment 1 — IDRiD lesion detection (object-detection metrics)

**Closing date:** 2026-04-21
**Model under test:** `detection-v2.0.0.onnx` (YOLO end-to-end, NMS integrated)
**Dataset:** IDRiD — Indian Diabetic Retinopathy Image Dataset, segmentation subset (test split, n = 81)
**Hardware:** CPU, ONNX Runtime, no batching
**Outcome:** ❌ **Negative result** — the model does not reach usable bounding-box detection quality on IDRiD lesions.

> **Headline:** mAP 0.24 (match IoU 0.5) / 0.30 (match IoU 0.1). Only the optic disc
> is localized well (AP 0.90–0.99); fine lesions (microaneurysms, hemorrhages, hard
> exudates) score AP < 0.10 even at a lenient match threshold. This negative result
> motivated the pivot to **image-level binary screening** validation — see
> [Experiment 2 (APTOS)](../experiment-2-aptos/REPORT.md).

---

## 1. Goal

Measure whether DIRD+ v2 reaches **object-detection grade** performance (per-lesion
bounding boxes, PASCAL VOC AP) on IDRiD, which provides pixel-level lesion masks
converted to bounding boxes as ground truth.

## 2. Setup

- **Ground truth:** IDRiD segmentation masks → connected components → bounding boxes,
  per lesion class.
- **Classes evaluated:** Microaneurysms, Hemorrhages, Hard exudates, Soft exudates,
  Optic disc.
- **Inference:** YOLO end-to-end ONNX (NMS integrated), conf ≥ 0.10, input 640×640.
- **AP method:** PASCAL VOC 11-point interpolation.
- **Match IoU sweep:** two operating points — **0.5** (strict, standard detection) and
  **0.1** (lenient, "is the lesion roughly located?").

## 3. Results

### 3.1 Match IoU = 0.5 (strict) — `results/match-iou-0.5/`

| Class | AP | GT boxes | Pred boxes | Best F1 |
|---|---:|---:|---:|---:|
| Microaneurysms | 0.000 | 3497 | 723 | 0.000 |
| Hemorrhages | 0.073 | 1900 | 254 | 0.077 |
| Hard exudates | 0.091 | 11640 | 1002 | 0.007 |
| Soft exudates | 0.139 | 150 | 54 | 0.212 |
| Optic disc | 0.904 | 81 | 101 | 0.945 |
| **mAP** | **0.241** | | | |

### 3.2 Match IoU = 0.1 (lenient) — `results/match-iou-0.1/`

| Class | AP | GT boxes | Pred boxes | Best F1 |
|---|---:|---:|---:|---:|
| Microaneurysms | 0.091 | 3497 | 723 | 0.030 |
| Hemorrhages | 0.087 | 1900 | 254 | 0.143 |
| Hard exudates | 0.091 | 11640 | 1002 | 0.074 |
| Soft exudates | 0.225 | 150 | 54 | 0.314 |
| Optic disc | 0.991 | 81 | 101 | 0.957 |
| **mAP** | **0.297** | | | |

**Timing:** ≈ 8–13 images/s on CPU.

## 4. Analysis

- **Optic disc** is detected almost perfectly (AP 0.90–0.99): one large, high-contrast,
  consistent object per image — the easy case.
- **Fine lesions fail.** Microaneurysms collapse to AP 0.000 at IoU 0.5 and only 0.091 at
  IoU 0.1. Hemorrhages and hard exudates behave the same. The model emits far fewer
  predicted boxes (e.g. 1002) than there are ground-truth boxes (11640 hard exudates),
  and the few it emits rarely overlap the tiny GT boxes enough to match.
- Raising the match tolerance from 0.5 → 0.1 only lifts mAP 0.24 → 0.30 — the boxes are
  not just slightly misplaced, they are largely **missing**. This is a recall problem at
  the lesion-instance level, not a localization-precision problem.
- IDRiD's mask-derived boxes are extremely dense and small; the detector was not trained
  to enumerate every individual lesion instance, so instance-level AP is the wrong yardstick
  for this model.

## 5. Conclusion

DIRD+ v2 is **not** a usable per-lesion bounding-box detector on IDRiD. The only class it
localizes reliably is the optic disc. **Negative result.**

The right way to validate this model is at the **image level** (does an image contain
pathology at all?), not at the lesion-instance level. That is exactly what
[Experiment 2 (APTOS)](../experiment-2-aptos/REPORT.md) does, where the same model reaches
AUC 0.95 / MCC 0.91 out-of-domain without retraining.

**Future work:** repeat an instance-level detection study on **Messidor** once
lesion-level annotations are available, and/or retrain with IDRiD-style dense lesion
boxes if per-lesion detection becomes a product requirement.

---

## 6. Reproducibility

### 6.1 Stack

```
python 3.x + onnxruntime
opencv-python-headless, numpy, pandas, scikit-learn, matplotlib, tqdm
```

### 6.2 Inputs

```
detection-v2.0.0.onnx                 (model weights — not versioned)
datasets/idrid/                       (IDRiD segmentation subset — download separately)
../models/detection-v2.0.0.json       (class metadata)
```

### 6.3 Run

```bash
cd validation/experiment-1-idrid/scripts

# (optional) build a COCO-format view of IDRiD masks
python idrid_to_coco.py

# strict match IoU = 0.5
python validate_idrid_e2e.py \
    --model detection-v2.0.0.onnx \
    --dataset datasets/idrid/full \
    --output ../results/match-iou-0.5 \
    --classes-json ../../models/detection-v2.0.0.json \
    --conf-threshold 0.1 --iou-threshold 0.5 --benchmark

# lenient match IoU = 0.1
python validate_idrid_e2e.py \
    --model detection-v2.0.0.onnx \
    --dataset datasets/idrid/full \
    --output ../results/match-iou-0.1 \
    --classes-json ../../models/detection-v2.0.0.json \
    --conf-threshold 0.1 --iou-threshold 0.1 --benchmark
```

### 6.4 Outputs (per run)

```
metrics_ap.json          AP per class + mAP + parameters + benchmark
results_per_image.csv     per-image predictions
pr_curves.png             precision/recall curves
validation_report.txt     human-readable summary
```

> Qualitative overlay images and the COCO export are large and regenerable; they are kept
> locally under `results/_local_heavy/` and are not versioned.
