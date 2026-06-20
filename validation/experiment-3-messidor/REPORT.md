# Experiment 3 — DIRD+ v2 external threshold validation on Messidor

**Status:** ⚠️ first run done on the **preprocessed Messidor-2 mirror** — result is confounded (see §2.1); a clean re-run on ADCIS raw images is pending.
**Closing date:** 2026-06-20 (preliminary)
**Model under test:** `detection-v2.0.0.onnx` (YOLOv26s end-to-end NMS, 6 active classes) — **weights not retrained**
**Dataset:** Messidor-2 — **preprocessed mirror** (`mariaherrerot/messidor2preprocess`, `_PP.png`), adjudicated ICDR grade 0–4 (Krause et al. 2018). N = 1057 of 1748 gradable images present in the mirror.
**Hardware:** CPU, ONNX Runtime, no batching (mean 163 ms/img, ≈ 6 FPS)
**Experiment author:** Nicolás Baier Quezada

> **Data attribution.** The Messidor-2 images are **kindly provided by the Messidor program
> partners** (see <https://www.adcis.net/en/third-party/messidor/>). Cite Decencière et al.
> 2014 (database), Abràmoff et al. 2013, and Krause et al. 2018 (adjudicated grades) — see
> [REFERENCES.md](../../REFERENCES.md) §Public Datasets.

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

Run `20260620_160112`, N = 1057 (468 normal / 589 pathological), grades {0:468, 1:207, 2:290, 3:71, 4:21}.

| Metric | APTOS (CV, in-dist) | Messidor frozen-τ | Messidor refit-τ |
|---|---|---|---|
| AUC OOD (threshold-free) | 0.95–0.97 | **0.813** | — |
| Sensitivity | 0.978 | 0.672 | 0.543 |
| Specificity | 0.931 | 0.831 | 0.929 |
| PPV / NPV | 0.938 / 0.977 | 0.834 / 0.668 | 0.907 / 0.618 |
| MCC | 0.911 | **0.503** | 0.498 |

Frozen vs refit per-class τ (FPR = 2% over normals):

| Class | τ frozen (APTOS) | τ refit (Messidor) |
|---|---|---|
| hard_exudate | 0.633 | 0.653 |
| hemorrhage | 0.050 | 0.054 |
| cotton_wool_spot | 0.853 | 0.316 |
| microhemorrhages | 0.258 | 0.487 |

**`GAP MCC (refit − frozen) = −0.0049`** — refitting τ on Messidor does **not** beat the
frozen APTOS τ (it is marginally worse). Other rules: `FROZEN_fpr05` 0.793/0.688 (MCC 0.484),
`FROZEN_fpr02_n2` 0.256/0.994 (MCC 0.352, high-specificity mode).

**Headline (two claims, kept separate):**
- ✅ **Threshold transportability — CONFIRMED.** The APTOS per-class τ sit at essentially
  the same operating point on Messidor (gap ≈ 0). The decision rule is **not overfit to
  APTOS** — this answers the open question of Experiments 2 §8.5.
- ⚠️ **Absolute OOD discrimination drops sharply** on this dataset: AUC 0.95–0.97 → **0.813**,
  MCC 0.91 → **0.50**. *But this number is confounded — see §2.1.*

### 2.1 Confounder — preprocessed mirror, not raw ADCIS

The images used are the **preprocessed mirror** (`_PP.png`: cropped + resized to ~600 px),
**not** the raw ADCIS fundus. That preprocessing differs from how APTOS images were fed to
the model, so an unknown share of the AUC drop is an **artifact of the mirror's preprocessing**,
not a genuine Messidor population/camera shift. The set is also a subset (1057 / 1748).

> **We cannot conclude "the model fails to generalize to Messidor" from this run.** The
> transportability result (gap ≈ 0) is robust to the confounder (frozen and refit see the
> *same* images), but the absolute AUC must be re-measured on **raw ADCIS images** before
> any generalization claim. That re-run is the next step.

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
└── plots/          01_roc_ood · 02_roc_per_class · 03_score_dist_binary ·
                    04_score_dist_per_class · 05_per_grade_detection ·
                    06_confusion_matrices · 07_tau_frozen_vs_refit ·
                    08_rules_comparison · 09_rules_sens_spec_scatter ·
                    10_aptos_vs_messidor  (.png, 300 dpi)
```
