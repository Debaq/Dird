# Experiment 5 — Subgroup performance / fairness (TRIPOD+AI)

**Model:** detection-v2.0.0.onnx (DIRDv2r0), frozen weights — no retraining.
**Task:** binary screening (normal grade 0 vs pathological grade 1–4).
**Method:** NO re-inference. Reuses per-image predictions and raw detections already
produced by exp-2 (APTOS), exp-3 (Messidor), exp-4 (DDR).
**Script:** `scripts/run_fairness.py` · **Output:** `results/fairness.json`

This experiment closes the largest TRIPOD+AI gap (item: *fairness / subgroup evaluation*)
with the subgroups for which local metadata exists.

## Operating point caveat

Subgroup sensitivity/specificity use the **baseline operating point** stored in each
`01-binary/per_image.csv` (single conf ≥ 0.25, any lesion class). This is NOT the deployed
per-class calibrated point (PCT_fpr02). Numbers are therefore directional for fairness, not
the final clinical operating metrics. Lesion-channel AUC is threshold-free (unaffected).

## Subgroups evaluated (and why only these)

| Subgroup | Status | Source |
|---|---|---|
| **Severity** (ICDR grade 0–4) | ✅ done | `gt_grade` in per_image.csv |
| **Lesion type** (4 channels) | ✅ done | raw_detections.csv (max score/class/image) |
| **Site / population** (3 datasets) | ✅ done | cross-dataset comparison |
| Camera / device | ❌ no local metadata | — |
| Hospital / center | ❌ not recoverable | DDR filename prefix ≠ hospital (>5000 unique prefixes vs 147 hospitals) |
| Age / sex | ❌ not in public datasets | — |

---

## 1. By severity — sensitivity per ICDR grade

Grade 0 row reports **specificity**; grades 1–4 report **sensitivity** (detection rate).

| Grade | APTOS (India) | Messidor (Fr*) | DDR (China) |
|---|---|---|---|
| 0 (spec) | 0.457 (n=1805) | 0.699 (n=468) | 0.725 (n=6266) |
| **1 mild** | **0.989** (n=370) | **0.440** (n=207) | **0.511** (n=630) |
| 2 moderate | 0.999 (n=999) | 0.903 (n=290) | 0.820 (n=4477) |
| 3 severe | 1.000 (n=193) | 1.000 (n=71) | 0.983 (n=236) |
| 4 PDR | 0.997 (n=295) | 0.952 (n=21) | 0.892 (n=913) |

**Key finding — severity-dependent disparity.** Sensitivity for **mild DR (grade 1)
collapses out-of-distribution**: 0.99 in-domain (APTOS) → **0.44 Messidor / 0.51 DDR**.
Moderate-and-above DR (grades 2–4) stays high everywhere (0.82–1.00). Clinically the model
is a reliable **referable-DR** detector but misses early/mild disease in shifted populations.
This is the dominant fairness signal and the main limitation to disclose.

## 2. By lesion type — threshold-free discrimination (AUC vs binary label)

| Lesion channel | APTOS | Messidor | DDR |
|---|---|---|---|
| microhemorrhages | 0.988 | 0.821 | 0.803 |
| hard_exudate | 0.906 | 0.678 | 0.737 |
| cotton_wool_spot | 0.710 | 0.593 | 0.708 |
| **hemorrhage** | **0.639** | **0.561** | **0.597** |

**Finding.** `hemorrhage` is the weakest channel in every population (AUC 0.56–0.64),
confirming the model-card known issue (hemorrhage recall 0.17). `microhemorrhages` is the
strongest and carries most discriminative load. Degradation is uniform across channels OOD
(no single channel is the sole cause of the AUC drop).

## 3. By site / population — generalization

| | APTOS (India) | Messidor (Fr*) | DDR (China) |
|---|---|---|---|
| n | 3662 | 1057 | 12522 |
| AUC | 0.949 | 0.793* | 0.817 |
| Sens (baseline) | 0.997 | 0.754 | 0.805 |
| Spec (baseline) | 0.457 | 0.699 | 0.725 |
| MCC (baseline) | 0.541 | 0.452 | 0.532 |

\* Messidor confounded by preprocessed mirror (see exp-3). DDR is the clean external site.
Real population shift India→China costs ~0.13 AUC (0.95→0.82), no preprocessing artifact.

---

## Limitations

- Baseline operating point (not PCT_fpr02) for sens/spec — see caveat above.
- Camera/hospital/age/sex subgroups not assessable without external metadata.
- Messidor site confounded by preprocessing.
- Grade-1 n is modest in Messidor (207) / DDR (630) but the disparity is large and consistent.

## Reproduce

```bash
uv run --with numpy --with scikit-learn python3 \
  validation/experiment-5-fairness/scripts/run_fairness.py
```
