# DIRD+ — Scientific validation

Validation of the DIRD+ ONNX model (`detection-v2.0.0`) against public reference fundus
datasets. Each experiment is self-contained: its own report, scripts and results.

## Layout

```
validation/
├── models/                 # model metadata (JSON); weights live in the dird_models repo
├── experiment-1-idrid/     # Exp 1 — lesion detection metrics on IDRiD  (negative result)
│   ├── REPORT.md
│   ├── scripts/
│   └── results/
├── experiment-2-aptos/     # Exp 2 — binary screening on APTOS 2019      (positive result)
│   ├── REPORT.md
│   ├── scripts/
│   └── results/
├── experiment-3-messidor/  # Exp 3 — external threshold validation       (preliminary)
│   ├── REPORT.md
│   ├── scripts/
│   └── results/
└── README.md
```

## Experiments

| # | Dataset | Task | Result | Headline |
|---|---------|------|--------|----------|
| [1](experiment-1-idrid/REPORT.md) | IDRiD (n=81) | Per-lesion bounding-box detection (mAP) | ❌ Negative | mAP 0.24–0.30; only the optic disc is localized well. Wrong metric for this model. |
| [2](experiment-2-aptos/REPORT.md) | APTOS 2019 (n=3662) | Image-level binary screening (normal vs pathological) | ✅ Positive | Sens 0.978 / Spec 0.931 / MCC 0.91, AUC 0.95–0.97, OOD, no retraining. |
| [3](experiment-3-messidor/REPORT.md) | Messidor-2 mirror (n=1057) | External threshold validation (frozen APTOS per-class τ) | ⚠️ Preliminary | Threshold transports (frozen ≈ refit, ΔMCC≈0); absolute AUC 0.81 / MCC 0.50 but **confounded by the preprocessed mirror** — raw-ADCIS re-run pending. |

**Why two experiments?** Experiment 1 tested the model as an instance-level lesion
detector on IDRiD and failed — IDRiD's dense mask-derived boxes are the wrong yardstick for
this model. That negative result motivated Experiment 2, which validates the same model at
the **image level** on APTOS, where it generalizes strongly.

## Experiment 3 — Messidor (preliminary)

Experiment 3 applies the APTOS-calibrated per-class thresholds **frozen** to Messidor-2
to test whether the operating point transports to a third population (the open question of
[APTOS report §8.5](experiment-2-aptos/REPORT.md)). The threshold **does** transport
(frozen ≈ refit, ΔMCC ≈ 0), but the run used the **preprocessed Messidor-2 mirror**
(`_PP.png`, cropped/resized), so the absolute AUC drop (0.96 → 0.81) is confounded by the
mirror's preprocessing and cannot be read as a true generalization figure. A clean re-run
on raw ADCIS images is the pending next step. See the
[Exp 3 report §2.1](experiment-3-messidor/REPORT.md) for the confounder discussion.

## Setup

```bash
pip install onnxruntime numpy opencv-python-headless pandas scikit-learn matplotlib Pillow tqdm
```

Datasets are not versioned — download them separately and place them under each
experiment's `datasets/` directory. Model weights (`*.onnx`) live in the `dird_models`
repository. See each experiment's `REPORT.md` (§ Reproducibility) for the exact run order.

## What is / isn't versioned

- **Versioned:** reports, scripts, metrics (`*.json`, summary `*.csv`), plots (`*.png`).
- **Not versioned:** model weights (`*.onnx`/`*.pt`), raw datasets, overlay imagery, the
  COCO export, and raw detection dumps (`raw_detections*.csv`) — all large and regenerable.
