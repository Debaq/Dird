# Experiment 4 — DIRD+ v2 external validation on DDR (China)

**Status:** 🚧 scaffold ready — awaiting dataset + run
**Model under test:** `detection-v2.0.0.onnx` (YOLOv26s end-to-end NMS, 6 active classes) — **weights not retrained**
**Dataset:** DDR (Nankai/nkicsl), DR_grading subset, ICDR grade 0–4 (grade 5 = ungradable, dropped). Chinese population, 147 hospitals, 42 camera types. Raw images.
**Hardware:** CPU, ONNX Runtime, no batching
**Experiment author:** Nicolás Baier Quezada

> **Purpose — the 2nd clean external dataset (exp-2 §11.2 #3).**
> APTOS gave AUC 0.95 OOD and a CV-validated operating point; Messidor (exp-3) confirmed
> *threshold transportability* but its absolute AUC was confounded by a preprocessed mirror.
> DDR is the **clean** external test: a genuinely different population (China) and camera mix,
> with **raw** images — no preprocessing confounder. It turns "n = 1 external dataset" into a
> pattern and is the evidence a reviewer needs for the generalization claim.

---

## 0. Index of sub-experiments

| # | Sub-experiment | Question | Directory |
|---|---|---|---|
| 1 | Binary baseline OOD | Does AUC generalize to a Chinese population? | `results/01-binary/` |
| 2 | Frozen-τ external validation | Do APTOS per-class τ hold on DDR, no refit? | `results/03-frozen-tau/` |
| 3 | Bootstrap 95% CI | How tight is the frozen operating point on DDR? | `results/04-bootstrap-ci/` |

(`results/02-sweep/` holds the single-inference `raw_detections.csv` cache — not versioned.)

---

## 1. Design

- **Threshold-free OOD AUC**: max lesion score vs binary GT (0 = normal, ≥1 = DR). Nothing fit to DDR.
- **External threshold validation**: apply the **frozen APTOS PCT_fpr02 τ**
  (hard_exudate 0.633 · hemorrhage 0.050 · cotton_wool_spot 0.853 · microhemorrhages 0.258)
  unchanged; compare to a τ refit on DDR. Small `MCC(refit) − MCC(frozen)` ⇒ transports.
- **Bootstrap CIs** (2000 iter, image resample, seed 42) on the frozen operating point.
- Anatomical classes `{0 optic_disc, 2 fovea}` never count as pathology.

This is **the clean version of exp-3**: raw images, different population, large n.

---

## 2. Results

> _Pending run. Fill from `results/01-binary/metrics.json`, `results/03-frozen-tau/frozen_tau.json`
> and `results/04-bootstrap-ci/bootstrap_ci.json` once DDR is on disk._

| Metric | APTOS (in-dist, CV) | DDR frozen-τ [95% CI] | DDR refit-τ |
|---|---|---|---|
| AUC OOD (threshold-free) | 0.95–0.97 | _TBD_ | — |
| Sensitivity | 0.978 | _TBD_ | _TBD_ |
| Specificity | 0.931 | _TBD_ | _TBD_ |
| MCC | 0.911 | _TBD_ | _TBD_ |
| GAP MCC (refit − frozen) | — | _TBD_ | — |

**Headline (to confirm):** _TBD_

---

## 3. How to reproduce

```bash
cd validation/experiment-4-ddr/scripts

# 0. Normalize (manual download first — see README_prepare_ddr.md)
python prepare_ddr_dataset.py --grading-dir ../../data/ddr/DR_grading --output ../ddr_extracted

# 1-4. Full pipeline (DDR ~13k imgs -> ~30-40 min CPU)
IMAGES=../../data/ddr/DR_grading ./run_ddr_full.sh
```

Paths resolve relative to `experiment-4-ddr/`. Model weights, raw images and the
`raw_detections*.csv` cache are gitignored.

---

## 4. Inputs / outputs

```
ddr_extracted/labels.csv             id_code, diagnosis(0..4), relpath, split
../models/detection-v2.0.0.onnx      model weights (not versioned)
../data/ddr/DR_grading/...           raw images (not versioned)

results/
├── 01-binary/        metrics.json, per_image.csv, roc_curve.json
├── 02-sweep/         raw_detections.csv   (cache — not versioned)
├── 03-frozen-tau/    frozen_tau.json, rules_summary.csv, per_image_class_scores.csv, report.txt
├── 04-bootstrap-ci/  bootstrap_ci.json, report.txt
└── plots/            01..10 (.png, 300 dpi)
```
