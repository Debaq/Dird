# Experiment 4 — DIRD+ v2 external validation on DDR (China)

**Status:** ✅ run complete (2026-06-20). The clean external dataset — confirms threshold transportability; quantifies the OOD discrimination drop.
**Model under test:** `detection-v2.0.0.onnx` (YOLOv26s end-to-end NMS, 6 active classes) — **weights not retrained**
**Dataset:** DDR (Nankai/nkicsl), DR_grading subset, ICDR grade 0–4 (grade 5 = ungradable, 1151 dropped). Chinese population, 147 hospitals, 42 camera types. **Raw images** (2400×2400 typ.). N = 12 522 (6266 normal / 6256 pathological).
**Hardware:** CPU, ONNX Runtime, no batching (mean 159 ms/img, ≈ 6.3 FPS; full run ≈ 45 min)
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

Run `20260620_212002`, N = 12 522 (6266 normal / 6256 pathological). Grades {0:6266, 1:630, 2:4477, 3:236, 4:913}. Bootstrap: 2000 iters, image resample, seed 42.

| Metric | APTOS (in-dist, CV) | **DDR frozen-τ [95% CI]** | DDR refit-τ |
|---|---|---|---|
| AUC OOD (threshold-free) | 0.95–0.97 | **0.840 [0.833, 0.847]** | — |
| Sensitivity | 0.978 | **0.603 [0.592, 0.616]** | 0.585 |
| Specificity | 0.931 | **0.914 [0.907, 0.921]** | 0.932 |
| PPV / NPV | 0.938 / 0.977 | 0.875 / 0.698 | 0.895 / 0.692 |
| MCC | 0.911 | **0.544 [0.531, 0.558]** | 0.551 |

**`GAP MCC (refit − frozen) = +0.0065`** — refitting τ on DDR does **not** beat the frozen
APTOS τ. Frozen vs refit per-class τ are close (hard_exudate 0.633 vs 0.713, hemorrhage
0.050 vs 0.050, cotton_wool_spot 0.853 vs 0.742, microhemorrhages 0.258 vs 0.321).

Alternative frozen operating points (same APTOS calibration, no refit):

| Rule | Sens | Spec | MCC |
|---|---|---|---|
| FROZEN_fpr02 | 0.603 | 0.914 | 0.544 |
| **FROZEN_fpr05** | **0.732** | **0.846** | **0.582** |
| FROZEN_fpr02_n2 | 0.279 | 0.992 | 0.387 |

**Headline (two claims, kept separate):**
- ✅ **Threshold transportability — CONFIRMED, and clean.** On a genuinely different population
  (China), with **raw images** (no mirror confounder), refitting τ on DDR gives no gain over the
  frozen APTOS τ (ΔMCC = +0.0065). Transportability now rests on **two** external datasets
  (Messidor §3 + DDR), one of them confounder-free. This settles the open question of Exp 2 §8.5.
- ⚠️ **Absolute OOD discrimination drops** — AUC 0.95 → **0.840**, MCC 0.91 → **0.54**. This is a
  *real* population/camera shift (not a preprocessing artifact). At the APTOS FPR-2% point the rule
  turns **conservative** on DDR (sens 0.60 / spec 0.91); the FPR-5% frozen point rebalances it
  (sens 0.73 / spec 0.85, MCC 0.58) without any DDR-specific fitting.

### 2.1 The emerging pattern (3 datasets)

| Dataset | Population | Images | AUC OOD | Confounder |
|---|---|---|---|---|
| APTOS | India | raw | 0.95 (in-dist) | — |
| Messidor-2 | France | preprocessed mirror | 0.81 | ⚠️ mirror preprocessing |
| **DDR** | China | **raw** | **0.84** | none |

The model **discriminates strongly in-domain (AUC 0.95) and degrades out-of-domain (0.81–0.84),
but its operating point is stable/transportable across populations**. The honest claim is not
"generalizes perfectly" — it is "generalizes with a *quantified* drop and a *stable, transportable*
threshold". DDR removes the doubt that Messidor's drop was a mirror artifact: the drop is real, and
modest (AUC still 0.84 on a Chinese population the model never saw).

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
