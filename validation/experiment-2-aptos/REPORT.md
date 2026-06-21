# Experiment 2 — DIRD+ v2 validation on APTOS 2019 (binary screening)

**Closing date:** 2026-04-30
**Model under test:** `detection-v2.0.0.onnx` (YOLOv26s end-to-end NMS, 6 active classes)
**Dataset:** APTOS 2019 Blindness Detection (Kaggle), `train.csv` split (n = 3662)
**Hardware:** CPU, ONNX Runtime 1.25.1, no batching
**Experiment author:** Nicolás Baier Quezada
**Outcome:** ✅ **Strong positive result** — the model generalizes out-of-domain to APTOS
without retraining the weights.

> **Headline (two distinct claims, kept separate on purpose):**
> - **Out-of-domain generalization (threshold-free, no tuning):** AUC-ROC **0.95–0.97** on
>   n = 3662. This is the genuinely external result — the model weights were not retrained
>   and nothing was fit to APTOS.
> - **Best operating point (decision rule tuned on APTOS, 5-fold CV-validated):** Sens
>   **0.978** / Spec **0.931** / MCC **0.911 ± 0.015** at ≈ 9 FPS on CPU. The per-class
>   thresholds were calibrated on APTOS, so this is an *in-distribution* operating point
>   validated by cross-validation — **not** an externally validated threshold. External
>   threshold validation is pending (Messidor-2, §8.5).

---

## 0. Index of sub-experiments

| # | Sub-experiment | Question | Directory |
|---|---|---|---|
| 1 | Baseline binary run | Does the model generalize OOD to APTOS? | `results/01-binary/` |
| 2 | conf/N sweep | What is the best uniform operating point? | `results/02-sweep/` |
| 3 | Per-class calibration | Does per-class τ beat a uniform τ? | `results/03-perclass/` |
| 4 | 5-fold cross-validation | Do per-class τ generalize or overfit? | `results/04-cv/` |
| 5 | Area filter | Are large bboxes more reliable than small ones? | `results/05-area-filter/` |
| 6 | Area + per-class | Are they additive or redundant? | `results/06-area-perclass/` |

Master comparison plots: `results/master-plots/`.

---

## 1. Common design

### 1.1 Dataset

APTOS 2019 gives a clinical diabetic-retinopathy grade on a 0–4 scale
(International Clinical Diabetic Retinopathy):

| Grade | Clinical meaning | Binary label | n |
|------:|------------------|:------------:|---:|
| 0 | No retinopathy | normal | 1805 |
| 1 | Mild DR | pathological | 370 |
| 2 | Moderate DR | pathological | 999 |
| 3 | Severe DR | pathological | 193 |
| 4 | Proliferative DR | pathological | 295 |

Total normals = 1805, total pathological = 1857 (49.3% / 50.7%).

### 1.2 Model

DIRD+ v2 detects 6 classes:

| Idx | Class | Category | mAP@50 (train) |
|---:|---|---|---:|
| 0 | optic_disc | landmark | 0.995 |
| 1 | hard_exudate | lesion | 0.364 |
| 2 | fovea | landmark | 0.855 |
| 3 | hemorrhage | lesion | 0.161 |
| 4 | cotton_wool_spot | lesion | 0.590 |
| 5 | microhemorrhages | lesion | 0.502 |

### 1.3 Pre/post-processing and binary mapping

- BGR→RGB, direct resize to 640×640, normalization [0,1], CHW float32.
- Output `[1, D, 6] = [x1, y1, x2, y2, score, class]` (internal NMS).
- No re-NMS, no TTA.
- Baseline binary mapping: **ALTERED** ⇔ ∃ a detection with
  `class ∉ {0 = optic_disc, 2 = fovea}` and score ≥ τ.

### 1.4 Reported metrics

Sensitivity (recall), Specificity, PPV (precision), NPV, Accuracy, F1, MCC,
Youden's J, AUC-ROC, confusion matrix, sensitivity per APTOS grade, and inference
times (mean / median / p95 / p99 / FPS).

---

## 2. Sub-experiment 1 — Baseline binary run

**Question:** does the model, trained on IDRiD / internal data, generalize to APTOS with
no tuning?
**Setup:** a single run with uniform `conf = 0.25` and the "any non-anatomical class" rule.

### Key results

| Metric | Value |
|---|---:|
| Sensitivity | **0.9968** |
| Specificity | 0.4565 |
| AUC-ROC | 0.9488 |
| MCC | 0.5413 |
| Acc / F1 | 0.7305 / 0.7895 |
| FN / FP | **6** / 981 |

**Sensitivity per grade:** g1 0.989 · g2 0.999 · g3 1.000 · g4 0.997.
**Timing:** mean 112 ms, p95 127 ms, FPS ≈ 8.92.

### Conclusion

The model **generalizes strongly out of domain** (AUC 0.95). In pure screening mode it
misses only 6 of 1857 pathological cases. Cost: 981 false positives over 1805 normals.
The operating point needs refining.

---

## 3. Sub-experiment 2 — conf and N sweep

**Question:** which uniform threshold and/or minimum detection count best balances
sens/spec?
**Setup:** 11 rules evaluated after a single inference pass (dump `raw_detections.csv`
with score ≥ 0.05). R1 = ∃ lesion at various τ; R2 = ≥K lesions at τ = 0.25;
R3 = combined `conf ≥ 0.40 ∧ N ≥ 2`.

### Main table

| Rule | Sens | Spec | PPV | NPV | MCC | J | AUC |
|---|---:|---:|---:|---:|---:|---:|---:|
| R1 conf≥0.25 | 0.9968 | 0.4565 | 0.654 | 0.993 | 0.541 | 0.453 | 0.9488 |
| R1 conf≥0.40 | 0.9812 | 0.6776 | 0.758 | 0.972 | 0.694 | 0.659 | 0.9456 |
| R1 conf≥0.50 | 0.9591 | 0.8216 | 0.847 | 0.951 | 0.789 | 0.781 | 0.9391 |
| R1 conf≥0.60 | 0.9122 | 0.8953 | 0.900 | 0.908 | 0.808 | 0.808 | 0.9210 |
| R1 conf≥0.70 | 0.8239 | 0.9346 | 0.928 | 0.838 | 0.762 | 0.759 | 0.8829 |
| R2 N≥2 conf=0.25 | 0.9779 | 0.6920 | 0.766 | 0.968 | 0.701 | 0.670 | 0.9642 |
| R2 N≥3 conf=0.25 | 0.9515 | 0.8155 | 0.841 | 0.942 | 0.775 | 0.767 | 0.9642 |
| R2 N≥5 conf=0.25 | 0.8783 | 0.9169 | 0.916 | 0.880 | 0.795 | 0.795 | 0.9642 |
| **R3 conf≥0.40 ∧ N≥2** | **0.9316** | **0.9180** | **0.921** | **0.929** | **0.850** | **0.850** | 0.9456 |

AUC using `count` as the score (0.964) > AUC using `max_score` (0.949) — the
**lesion count is more informative** than the max score alone.

### Conclusion

R3 is the best **uniform** point (MCC 0.85). But it under-uses the good classes: high-AUC
classes lose recall by using τ = 0.40, while noisy classes keep contaminating. Hypothesis
for Sub-exp 3: calibrate τ per class.

---

## 4. Sub-experiment 3 — Per-class calibration

**Question:** what is the optimal τ for each lesion class separately?
**Setup:** over the Sub-exp 2 dump, compute `max score per (image, class)` and the ROC
curve against the per-class binary GT. Three τ-selection methods:

- **Youden's J** — maximizes TPR − FPR (statistical operating point).
- **FPR ≤ 5%** — stricter, drops the common false positives.
- **FPR ≤ 2%** — very strict, prioritizes specificity.

### Resulting calibration

| Class | Class AUC | τ_youden | τ_fpr05 | τ_fpr02 | FP@0.25 over normals |
|---|---:|---:|---:|---:|---:|
| hard_exudate | 0.906 | 0.518 | 0.558 | **0.633** | 771 / 1805 |
| hemorrhage | 0.639 | 0.050 | 0.050 | 0.050 | 5 / 1805 |
| cotton_wool_spot | 0.710 | 0.050 | 0.745 | **0.853** | 212 / 1805 |
| microhemorrhages | **0.988** | 0.121 | 0.120 | **0.258** | 38 / 1805 |

**Findings:**

- `microhemorrhages` is the model's best class (AUC 0.988), but it saturated FPs because
  conf = 0.25 was too low for its distribution. Its optimal τ sits at 0.26.
- `hard_exudate` needs a high τ (0.63) — it over-detects in healthy eyes.
- `hemorrhage` is noisy (AUC 0.64); its contribution is marginal.
- `cotton_wool_spot` needs a very high τ (0.85) to clean up.

### Combined rules

| Rule | Sens | Spec | MCC | J |
|---|---:|---:|---:|---:|
| UNI_0.25 (baseline) | 0.997 | 0.456 | 0.541 | 0.453 |
| R3 (Sub-exp 2 uniform winner) | 0.932 | 0.918 | 0.850 | 0.850 |
| PCT_youden | 0.999 | 0.725 | 0.755 | 0.724 |
| PCT_fpr05 | 0.996 | 0.855 | 0.861 | 0.851 |
| **PCT_fpr02** | **0.978** | **0.933** | **0.913** | **0.911** |
| PCT_youden_n2 | 0.919 | 0.974 | 0.894 | 0.893 |
| PCT_fpr02_n2 | 0.747 | 0.997 | 0.767 | 0.745 |

### Conclusion

**Large qualitative jump:** PCT_fpr02 improves MCC from 0.85 → 0.913 over R3.
Sensitivity is almost unchanged (0.932 → 0.978) and specificity is similar
(0.918 → 0.933). **The right lever was per-class τ, not a uniform τ.**

---

## 5. Sub-experiment 4 — 5-fold cross-validation

**Question:** are the per-class τ from Sub-exp 3 dataset-specific (overfitting) or stable?
**Setup:** StratifiedKFold k = 5, seed = 42. Per fold: calibrate τ on train
(4/5 ≈ 2930 imgs), evaluate on test (1/5 ≈ 732 imgs).

### Threshold stability

| Method | hard_exudate | hemorrhage | cotton_wool_spot | microhemorrhages |
|---|---|---|---|---|
| Youden | 0.5228 ± 0.010 | 0.0502 ± 0.0002 | 0.0502 ± 0.0002 | 0.1274 ± 0.010 |
| FPR = 2% | 0.6337 ± 0.0003 | 0.0502 ± 0.0002 | 0.8534 ± 0.0012 | 0.2573 ± 0.016 |
| FPR = 5% | 0.5568 ± 0.003 | 0.0502 ± 0.0002 | 0.7421 ± 0.004 | 0.1218 ± 0.008 |

Maximum coefficient of variation (CV = σ/μ): 8% (microhemorrhages, FPR = 2% method).
All others < 1%.

### Metrics with CV

| Rule | Sens | Spec | MCC | J |
|---|---|---|---|---|
| UNI_0.25 | 0.997 ± 0.003 | 0.456 ± 0.022 | 0.541 ± 0.018 | 0.453 ± 0.022 |
| **PCT_fpr02** | **0.978 ± 0.013** | **0.931 ± 0.004** | **0.911 ± 0.015** | **0.909 ± 0.014** |
| PCT_youden_n2 | 0.915 ± 0.014 | 0.974 ± 0.006 | 0.890 ± 0.018 | 0.889 ± 0.018 |
| PCT_fpr05 | 0.996 ± 0.005 | 0.855 ± 0.015 | 0.861 ± 0.010 | 0.851 ± 0.012 |

### Conclusion

**No overfitting.** PCT_fpr02 reproduces its MCC ≈ 0.91 in every fold with deviation
≤ 0.015. The τ are extremely stable — the calibration done over the full `train.csv` is
the population-optimal calibration for this model.

---

## 6. Sub-experiment 5 — Area filter

**Question:** are the FPs small detections (noise/artifacts)? If so, a minimum-area filter
should help without retraining.
**Setup:** re-inference storing bboxes (cache `raw_detections_bbox.csv`, 156167
detections). MIN_AREA ∈ {0, 50, 100, 200, 400, 800} pixels over the original image. Apply
the filter **before** the decision rule.

### Removals by area

| MIN_AREA | hard_exudate | hemorrhage | cotton_wool_spot | microhemorrhages |
|---:|---:|---:|---:|---:|
| 100 | 3 (0.0%) | 0 | 0 | 0 |
| 200 | 356 (0.4%) | 0 | 0 | 55 (0.1%) |
| 400 | 10 078 (10.5%) | 0 | 3 | 468 (1.1%) |
| 800 | 19 751 (20.5%) | 1 | 37 | 3173 (7.4%) |

### Evolution of R3 (conf≥0.40 ∧ N≥2) with MIN_AREA

| MIN_AREA | Sens | Spec | MCC | J |
|---:|---:|---:|---:|---:|
| 0 | 0.9316 | 0.9180 | 0.8498 | 0.8496 |
| 200 | 0.9316 | 0.9180 | 0.8498 | 0.8496 |
| 400 | 0.9316 | 0.9230 | 0.8547 | 0.8546 |
| **800** | **0.9246** | **0.9540** | **0.8787** | **0.8786** |

### Conclusion

Hypothesis **partially confirmed**: at MIN_AREA = 800, MCC does improve 0.85 → 0.88
(+0.03), but it stays below PCT_fpr02 (Sub-exp 3, MCC 0.913). The filter works because it
removes exactly the noisy classes (`hard_exudate` 20.5%, `microhemorrhages` 7.4%) — but
per-class calibration already does this better in a score-driven way.

---

## 7. Sub-experiment 6 — Area + per-class combined

**Question:** are the area filter and per-class calibration additive (they add up) or
redundant (same information)?
**Setup:** for each MIN_AREA ∈ {0, 200, 400, 800, 1200}, recalibrate τ_c over the filtered
set and re-evaluate the PCT rules.

### Results (PCT_fpr02 rule)

| MIN_AREA | τ hard_exud | class AUC | Sens | Spec | MCC |
|---:|---:|---:|---:|---:|---:|
| 0 | 0.633 | 0.906 | 0.9785 | 0.9330 | 0.9129 |
| 400 | 0.633 | 0.907 | 0.9785 | 0.9330 | 0.9129 |
| 800 | 0.611 | 0.946 | 0.9779 | 0.9324 | 0.9118 |
| **1200** | 0.558 | 0.956 | 0.9790 | 0.9324 | 0.9129 |

Analogous behavior on `microhemorrhages` (AUC 0.988 → 0.984 at area = 800).

### Conclusion

**They are redundant levers.** Per-class calibration already picks the τ that discards
low-quality detections — and small detections tend to have low scores, so filtering them
explicitly adds no information. The class's internal AUC improves with the filter, but the
τ readjusts and compensates: the final result is invariant.

---

## 8. Synthesis and final recommendation

### 8.1 Master table of best points

| Sub-experiment | Operating point | Sens | Spec | MCC | J |
|---|---|---:|---:|---:|---:|
| 1 — baseline | conf = 0.25 uniform | **0.997** | 0.456 | 0.541 | 0.453 |
| 2 — sweep | R3 (conf≥0.40 ∧ N≥2) | 0.932 | 0.918 | 0.850 | 0.850 |
| 3 — per-class | **PCT_fpr02** | 0.978 | 0.933 | **0.913** | **0.911** |
| 4 — CV | PCT_fpr02 (CV) | 0.978 ± 0.013 | 0.931 ± 0.004 | 0.911 ± 0.015 | 0.909 ± 0.014 |
| 5 — area | R3 + area = 800 | 0.925 | 0.954 | 0.879 | 0.879 |
| 6 — combined | PCT_fpr02 + area = 1200 | 0.979 | 0.932 | 0.913 | 0.911 |

### 8.2 Recommended operating point for production

**Rule PCT_fpr02 (no area filter):**

```python
# Per-class thresholds (calibrated on APTOS 2019, validated with 5-fold CV)
TAU = {
    "hard_exudate":     0.63,
    "microhemorrhages": 0.26,
    "cotton_wool_spot": 0.85,
    "hemorrhage":       0.05,   # weak class (AUC 0.64), contributes little
}

# ALTERED  ⇔  ∃ class c with score(c) ≥ TAU[c]
# NORMAL   ⇔  only landmarks detected (optic_disc, fovea) or nothing
```

**Expected performance (validated, 5-fold CV):**

- Sens 0.978 ± 0.013
- Spec 0.931 ± 0.004
- PPV 0.938, NPV 0.977
- MCC 0.911 ± 0.015, Youden's J 0.909
- AUC-ROC 0.967

### 8.3 Alternative modes by use case

| Mode | Rule | Sens | Spec | When to use |
|---|---|---:|---:|---|
| **Max-sensitivity screening** | conf≥0.25 uniform | 0.997 | 0.456 | Mass screening where no case may be missed |
| **Balanced production** | **PCT_fpr02** | **0.978** | **0.933** | **Recommended default** |
| High-specificity assistive | PCT_youden_n2 | 0.915 | 0.974 | Triage where over-flagging is costly |
| Confirmation | PCT_fpr02 + N≥2 | 0.747 | 0.997 | Second opinion / second line |

### 8.4 Limitations

- Validation on **APTOS 2019 train.csv** — a single dataset, a single cohort (India,
  heterogeneous cameras). Ideally cross-validate with Messidor-2 or EyePACS to confirm
  generalization to other populations.
- APTOS provides no lesion-level annotations, so IoU/mAP cannot be measured. Validation is
  at the per-image binary classification level.
- Times measured on CPU; on GPU / in the Tauri bundle, 5–10× lower latencies are expected.
- The `hemorrhage` class shows low AUC (0.64); improving it requires retraining with more
  balanced data, not calibration.

### 8.5 Recommended next steps

1. **Deployable today:** integrate the PCT_fpr02 per-class τ into the Tauri product
   (post-processing inference adjustment).
2. **External validation:** repeat Sub-exp 3–4 on Messidor-2 or EyePACS to confirm the
   population τ.
3. **Priority retraining** (next model version):
   - Recall on `hemorrhage` (AUC 0.64 — weak class).
   - Reduce over-detection on `hard_exudate` (FPR ≈ 43% in healthy eyes).
   - Possible split of `microhemorrhages` ↔ `microaneurysm` with dedicated annotations.
4. **Product:** expose the {screening / balanced / high-spec} modes as a UI toggle per the
   clinician's preference.

---

## 9. Reproducibility

### 9.1 Stack

```
python 3.x + venv
onnxruntime 1.25.1
opencv-python-headless
numpy, pandas, scikit-learn, tqdm, matplotlib
seed: numpy.random.seed(42)
```

### 9.2 Scripts and run order

```bash
cd validation/experiment-2-aptos/scripts

# Sub-exp 1 — baseline run at conf = 0.25
python run_aptos_binary_experiment.py

# Sub-exp 2 — rule sweep + dump raw_detections.csv (no bbox)
python run_aptos_sweep.py

# Sub-exp 3 — per-class calibration (reuses Sub-exp 2 dump)
python run_aptos_perclass.py

# Sub-exp 4 — 5-fold CV of per-class τ (reuses Sub-exp 2 dump)
python run_aptos_cv.py

# Sub-exp 5 — area filter (re-infers and creates raw_detections_bbox.csv)
python run_aptos_area_filter.py

# Sub-exp 6 — area × per-class (reuses Sub-exp 5 cache)
python run_aptos_area_perclass.py

# Plots
python make_aptos_plots.py
python make_perclass_plots.py
python make_cv_plots.py
python make_remaining_plots.py
```

All paths are resolved relative to the experiment root (`experiment-2-aptos/`). Each
`run_aptos_*.py` accepts `--model`, `--csv` and `--images`; pass the model weights with
`--model ../models/detection-v2.0.0.onnx` (or place the `.onnx` at the experiment root).

> `scripts/prepare_aptos_dataset.py` (and `README_prepare_aptos.md`) is an **unrelated
> utility** that carves a 500-image subset for human markers — it is *not* part of this
> validation pipeline.

### 9.3 Inputs

Relative to `experiment-2-aptos/`:

```
aptos_extracted/train.csv                   (3662 rows; APTOS 2019 train split)
aptos_extracted/train_images/*.png
../models/detection-v2.0.0.onnx             (model weights — not versioned; pass via --model)
```

### 9.4 Outputs

```
results/
  ├── 01-binary/         ← Sub-exp 1
  ├── 02-sweep/          ← Sub-exp 2  (raw_detections.csv cache — not versioned)
  ├── 03-perclass/       ← Sub-exp 3
  ├── 04-cv/             ← Sub-exp 4
  ├── 05-area-filter/    ← Sub-exp 5  (raw_detections_bbox.csv cache — not versioned)
  ├── 06-area-perclass/  ← Sub-exp 6
  └── master-plots/      ← cross-experiment comparison figures
```

Each sub-directory contains its `report.txt`, `*.csv`, `*.json` and `plots/*.png` (300 dpi).

---

## 10. Executive conclusion

DIRD+ v2 is a detector with **strong discriminative power** (AUC 0.95–0.97) on APTOS 2019
without retraining. **Per-class calibration at FPR = 2%** over normals raises MCC from 0.54
(baseline) to **0.91**, validated by 5-fold CV. The thresholds are stable (CV < 8%) and
clinically consistent with each class's internal AUC. The area filter and per-class
calibration **are redundant levers**; the recommended production operating point uses
per-class calibration as the only post-model intervention.

> **Headline (claims kept separate):** Out-of-domain discrimination is **AUC 0.95–0.97**
> (threshold-free, nothing fit to APTOS) — the genuinely external result. The **Sens 0.978
> / Spec 0.931 / MCC 0.911** operating point is *in-distribution*: its per-class thresholds
> were calibrated on APTOS and validated by 5-fold CV (not externally). Model weights were
> not retrained. External threshold validation is pending (Messidor-2).

---

## 11. Statistical rigor

### 11.1 Bootstrap 95% confidence intervals (`results/07-bootstrap-ci/`)

Image-level resampling with replacement, 2000 iterations, seed 42, full APTOS set
(n = 3662). Operating point = PCT_fpr02 (per-class τ from §3); AUC = threshold-free
(max lesion score). Script: `bootstrap_aptos_ci.py`.

| Metric | Point | 95% CI |
|---|---|---|
| Sensitivity | 0.9785 | [0.9711, 0.9847] |
| Specificity | 0.9330 | [0.9210, 0.9441] |
| PPV | 0.9376 | [0.9265, 0.9479] |
| NPV | 0.9768 | [0.9690, 0.9834] |
| Accuracy | 0.9560 | [0.9489, 0.9623] |
| F1 | 0.9576 | [0.9507, 0.9636] |
| MCC | 0.9129 | [0.8991, 0.9253] |
| AUC-ROC | 0.9493 | [0.9415, 0.9563] |

Intervals are narrow (≈ ±1 pt) thanks to n = 3662 — the estimates are stable, not artifacts
of a lucky split. (The AUC here, 0.949, uses the raw max-lesion score with a 0.05 floor; the
0.95–0.97 headline range spans the alternative score definitions in §2–3.)

### 11.2 Audit — strengths and limitations (for publication)

**Sound:**
- The 5-fold CV (§4) is **leak-free**: ONNX weights are frozen (never retrained); only the
  decision threshold τ is calibrated on each fold's train split and applied to its test split.
  Per-class τ are stable across folds (CV < 8%).
- Large, near-balanced sample (1805 normal / 1857 pathological); deterministic, seeded.

**To address before journal submission:**
1. *Operating-point selection multiplicity (moderate).* ~12 rules were evaluated on the full
   set and PCT_fpr02 chosen. CV validates the **chosen** rule's stability, not the selection.
   We report **all** rules and label PCT_fpr02 as *in-distribution*; the paper must state the
   rule family was the search space.
2. *AUC score definition (minor).* The ROC uses the per-image max lesion score with a 0.05
   confidence floor; sub-0.05 detections read as 0 → "near-threshold-free above 0.05", not
   strictly threshold-free. State the score definition explicitly.
3. *Single clean external dataset (moderate).* OOD generalization rests on APTOS alone
   (Messidor-2 confounded, Exp 3 §2.1). A second **public** external set (DDR, DiaRetDB1, or
   IDRiD at image level) is needed to turn n = 1 external into a pattern.
4. *Per-class AUC is a proxy (minor).* It measures whether class-c presence discriminates
   *any* DR against the image-level binary GT — not class-c localization (Exp 1's remit, where
   the model is weak). Do not claim lesion-level accuracy from it.
5. *Independence (minor).* APTOS `id_code`s are treated as independent images; if any patient
   contributed > 1 image, resampling should be patient-level. State the assumption.
