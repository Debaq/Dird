# Experiment 3 — DIRD+ v2 external threshold validation on Messidor

**Status:** 🚧 in progress (scaffold ready, awaiting dataset + run)
**Closing date:** _TBD_
**Model under test:** `detection-v2.0.0.onnx` (YOLOv26s end-to-end NMS, 6 active classes) — **weights not retrained**
**Dataset:** Messidor-2 (ADCIS), adjudicated DR grade 0–4 — *fallback:* Messidor-1 (grade 0–3)
**Hardware:** CPU, ONNX Runtime, no batching
**Experiment author:** Nicolás Baier Quezada

> **Purpose (the open question from Experiment 2 §8.4–8.5):**
> APTOS gave AUC 0.95–0.97 OOD (threshold-free) and a strong operating point
> (Sens 0.978 / Spec 0.931 / MCC 0.911) — but that operating point's per-class
> thresholds **were calibrated on APTOS**, so it was *in-distribution*, only
> CV-validated. Experiment 3 answers: **do those frozen APTOS thresholds transport
> to a third population / different cameras (Messidor) without recalibration?**

---

## 0. Index of sub-experiments

| # | Sub-experiment | Question | Directory |
|---|---|---|---|
| 1 | Binary baseline OOD | Does AUC generalize to Messidor too? | `results/01-binary/` |
| 2 | **Frozen-τ external validation** | Do APTOS per-class τ hold on Messidor with no refit? | `results/03-frozen-tau/` |

(`results/02-sweep/` holds the single-inference `raw_detections.csv` cache — not versioned.)

---

## 1. Design

### 1.1 Two distinct claims (kept separate, same discipline as Exp 2)

- **Threshold-free OOD generalization:** AUC-ROC of the max lesion score vs binary GT.
  Nothing fit to Messidor → genuinely external. _Target: confirm ≈ 0.95._
- **External threshold validation:** apply the **frozen APTOS PCT_fpr02 τ** (below)
  unchanged. Compare against a τ **refit on Messidor**. A small `MCC(refit) − MCC(frozen)`
  gap ⇒ the operating point is transportable (the result Exp 2 said was pending).

### 1.2 Frozen thresholds carried over from APTOS (PCT_fpr02)

| Class (idx) | τ (frozen) |
|---|---|
| hard_exudate (1) | 0.6334 |
| hemorrhage (3) | 0.0501 |
| cotton_wool_spot (4) | 0.8525 |
| microhemorrhages (5) | 0.2583 |

Anatomical classes `{0 optic_disc, 2 fovea}` never count as pathology.
Rule `FROZEN_fpr02`: image = altered ⇔ ∃ lesion class `c` with `score ≥ τ[c]`.

### 1.3 Binary mapping

Messidor grade `0` → normal; grade `≥1` → pathological (identical to APTOS, so the
binary GT is comparable across datasets).

---

## 2. Results

> _Pending run. Fill from `results/01-binary/metrics.json` and
> `results/03-frozen-tau/frozen_tau.json` once the dataset is in place._

| Metric | APTOS (CV, in-dist) | Messidor frozen-τ | Messidor refit-τ |
|---|---|---|---|
| AUC OOD (threshold-free) | 0.95–0.97 | _TBD_ | — |
| Sensitivity | 0.978 | _TBD_ | _TBD_ |
| Specificity | 0.931 | _TBD_ | _TBD_ |
| MCC | 0.911 | _TBD_ | _TBD_ |

**Headline (to confirm):** _TBD_

---

## 3. How to reproduce

```bash
cd validation/experiment-3-messidor/scripts

# 0. Normalize the dataset (manual download first — see README_prepare_messidor.md)
python prepare_messidor_dataset.py --source messidor2 \
  --csv ../../data/messidor2/messidor_data.csv \
  --images ../../data/messidor2/IMAGES --output ../messidor_extracted

# 1. Single inference -> raw dump + binary baseline + OOD AUC
python run_messidor_sweep.py --model ../../models/detection-v2.0.0.onnx \
  --csv ../messidor_extracted/labels.csv --images ../../data/messidor2/IMAGES

# 2. External threshold validation (frozen APTOS τ vs refit)
python run_messidor_frozen_tau.py

# 3. Figures
python make_messidor_plots.py
```

Paths resolve relative to `experiment-3-messidor/`. Model weights and raw images are
gitignored (`../models/`, `../data/`); the `raw_detections*.csv` cache is gitignored too.

---

## 4. Inputs / outputs

```
messidor_extracted/labels.csv            id_code, diagnosis(0..4), ext
../models/detection-v2.0.0.onnx          model weights (not versioned)
../data/messidor2/IMAGES/*               raw images (not versioned)

results/
├── 01-binary/      metrics.json, per_image.csv, roc_curve.json
├── 02-sweep/       raw_detections.csv   (cache — not versioned)
├── 03-frozen-tau/  frozen_tau.json, rules_summary.csv, per_image_class_scores.csv, report.txt
└── plots/          01_roc_ood.png, 02_tau_frozen_vs_refit.png, 03_rules_comparison.png
```
