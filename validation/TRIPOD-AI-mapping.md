# TRIPOD+AI mapping — DIRD+ DR screening model

Maps DIRD+ validation evidence to the **TRIPOD+AI** reporting checklist
(Collins et al., *BMJ* 2024). Legend: ✅ covered · 🟡 partial · ❌ missing · N/A.

Two repos hold the evidence:
- **`Dird/validation/`** — model *evaluation* (this repo). External validation, metrics, fairness.
- **`dird_models/`** — model *artifacts* + dev `MODEL_CARD.md`. Development/training items live here.

Model under evaluation: `detection-v2.0.0.onnx` (DIRDv2r0, YOLOv26s, frozen weights).
Task: binary DR screening (normal grade 0 vs pathological 1–4).

---

## Title & abstract
| Item | Status | Evidence / gap |
|---|---|---|
| 1 Title | 🟡 | REPORTs descriptive; no formal manuscript title |
| 2 Abstract | ❌ | No TRIPOD-format structured abstract |

## Introduction
| Item | Status | Evidence / gap |
|---|---|---|
| 3a Background, clinical context, **intended use** | ✅ | `validation/README.md` §Intended use; `dird_models/MODEL_CARD.md` §2 |
| 3b Objectives | ✅ | `validation/README.md` |

## Methods — data & participants
| Item | Status | Evidence / gap |
|---|---|---|
| 4a Data source / design (dev) | ❌→see `dird_models/MODEL_CARD.md` | training source not in any local repo |
| 4a Data source / design (eval) | ✅ | exp-2/3/4 REPORTs (APTOS/Messidor/DDR) |
| 4b Dates | 🟡 | model trained 2026-04-21; eval dataset dates partial |
| 5a Setting & eligibility (eval) | ✅ | per-dataset (India/France/China, n, grade dist) |
| 5b Treatments | N/A | diagnostic, non-interventional |
| 6 Outcome (definition) | ✅ | binary from ICDR grade (0 vs 1–4) |
| 6b Outcome blinding | ✅ | pre-existing dataset labels, independent of model |
| 7 Predictors (inputs) | ✅ | fundus 640×640 + 6 detection classes; `model-interface.md` |
| 7b Predictor blinding | ✅ | automated inference, label-blind |
| 8 Sample size | 🟡 | eval n reported (3662/1057/12522); no a-priori justification; dev n ❌ |
| 9 Missing data / gradability | 🟡 | DDR drops grade-5 ungradable (1151); dev gradability criteria ❌ |

## Methods — analysis (AI core)
| Item | Status | Evidence / gap |
|---|---|---|
| 10a Predictor handling | ✅ | per-class conf thresholds (PCT_fpr02), N≥k rules — exp-2 |
| 10b Model development (architecture, selection, internal val) | 🟡→`MODEL_CARD.md` | architecture known; hyperparams/splits/seed ❌ |
| 10c AI specifics (software, versions, compute) | 🟡→`MODEL_CARD.md` | ONNX/ultralytics known; versions/hardware/seed ❌ |
| 10d Performance measures | ✅✅ | AUC, sens, spec, MCC, PPV/NPV, F1, J, mAP — with bootstrap 95% CI |
| 11 Risk groups / operating points | ✅ | R3, PCT_fpr02, FROZEN_fpr05 |
| 12 Eval vs dev differences | ✅✅ | 3 external sites, population shift, threshold transport (ΔMCC≈0) |

## Open science
| Item | Status | Evidence / gap |
|---|---|---|
| 13a Funding | ❌ | undeclared |
| 13b Conflicts of interest | ❌ | undeclared |
| 13c Protocol / registration | ❌ | no pre-registration |
| 13d Data sharing | 🟡 | public datasets cited; own training data not shared |
| 13e Code sharing | ✅ | validation scripts versioned per experiment |

## Patient & public involvement / fairness
| Item | Status | Evidence / gap |
|---|---|---|
| 14 PPI | ❌ | none |
| 15 **Fairness / subgroup eval** | 🟡 | **exp-5** done: severity, lesion-type, site. Camera/hospital/age/sex ❌ (no metadata) |

## Results
| Item | Status | Evidence / gap |
|---|---|---|
| 16 Participant flow | 🟡 | per-dataset n in/out; no flow diagram |
| 17 Characteristics (demographics) | 🟡 | grade distribution ✅; age/sex ❌ (public datasets) |
| 18 Model specification (final thresholds) | ✅ | per-class τ explicit (exp-2 03-perclass) |
| 19 Performance + uncertainty | ✅✅ | bootstrap 95% CI (exp-2, exp-4) |
| 20 Subgroup results | ✅ | exp-5 REPORT.md + results/fairness.json |

## Discussion
| Item | Status | Evidence / gap |
|---|---|---|
| 21 Limitations | ✅ | Messidor mirror confound, hemorrhage low recall, micro-class merge, IDRiD negative, mild-DR sensitivity drop |
| 22 Interpretation / clinical use | ✅ | `validation/README.md` §Clinical risk; `MODEL_CARD.md` §2 |

---

## Fairness summary (exp-5)

- **Severity disparity (dominant):** mild-DR (grade 1) sensitivity 0.99 in-domain → **0.44 Messidor / 0.51 DDR**. Referable DR (grade ≥2) stays 0.82–1.00. Model misses early disease OOD.
- **Lesion channels:** `hemorrhage` weakest everywhere (AUC 0.56–0.64); `microhemorrhages` strongest (0.80–0.99).
- **Site shift:** AUC India 0.95 → China 0.82 (real); Messidor 0.79 confounded by preprocessing.

## Priority gaps to close
1. **Dev documentation** → `dird_models/MODEL_CARD.md`: training data source/size, hyperparameters, splits, seed, gradability. *Only the trainer holds these — not on disk.*
2. **Open science** (13a–c): funding, COI, (pre)registration.
3. **Participant flow diagram** (item 16).

*Closed: intended-use + clinical-risk statement (items 3a, 22).*

## Strengths (publication-grade already)
Metrics + bootstrap CI · multi-site external validation · threshold transportability · honest limitations · subgroup/fairness analysis · shared code.
