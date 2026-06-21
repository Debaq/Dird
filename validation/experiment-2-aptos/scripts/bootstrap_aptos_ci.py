#!/usr/bin/env python3
"""
Sub-exp 7 — intervalos de confianza bootstrap sobre APTOS.

Convierte los estimadores puntuales del experimento en métricas con IC 95%
(percentil, resampleo de imágenes con reemplazo). Reporta:
  - AUC OOD (libre de umbral; score = máx sobre clases de lesión {1,3,4,5})
  - punto de operación recomendado PCT_fpr02 (τ congelados de 03-perclass):
    sensibilidad, especificidad, PPV, NPV, MCC, F1, accuracy

No re-infiere: reutiliza results/02-sweep/raw_detections.csv (gt_grade incluido)
y results/03-perclass/perclass_calibration.json. Determinista (seed=42).
"""
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import roc_auc_score

BASE = Path(__file__).parent.parent
RAW = BASE / "results" / "02-sweep" / "raw_detections.csv"
CALIB = BASE / "results" / "03-perclass" / "perclass_calibration.json"
LESION = [1, 3, 4, 5]
N_BOOT = 2000
SEED = 42


def point_metrics(y_true, y_pred, y_score):
    tp = int(((y_true == 1) & (y_pred == 1)).sum())
    tn = int(((y_true == 0) & (y_pred == 0)).sum())
    fp = int(((y_true == 0) & (y_pred == 1)).sum())
    fn = int(((y_true == 1) & (y_pred == 0)).sum())
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    ppv = tp / (tp + fp) if (tp + fp) else 0.0
    npv = tn / (tn + fn) if (tn + fn) else 0.0
    acc = (tp + tn) / len(y_true)
    f1 = 2 * tp / (2 * tp + fp + fn) if (2 * tp + fp + fn) else 0.0
    denom = np.sqrt(float(tp + fp) * (tp + fn) * (tn + fp) * (tn + fn))
    mcc = ((tp * tn - fp * fn) / denom) if denom > 0 else 0.0
    try:
        auc = float(roc_auc_score(y_true, y_score))
    except Exception:  # noqa: BLE001
        auc = float("nan")
    return {"sensitivity": sens, "specificity": spec, "ppv": ppv, "npv": npv,
            "accuracy": acc, "f1": f1, "mcc": mcc, "auc_roc": auc}


def main() -> None:
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BASE / "results" / "07-bootstrap-ci"
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(RAW)
    gt = raw.groupby("id_code")["gt_grade"].first()
    pivot = (raw[raw["class"].isin(LESION)]
             .groupby(["id_code", "class"])["score"].max().unstack(fill_value=0.0))
    for c in LESION:
        if c not in pivot.columns:
            pivot[c] = 0.0
    pivot = pivot.reindex(gt.index).fillna(0.0)

    y_true = (gt.values != 0).astype(int)
    scores = pivot[LESION].values
    y_score = scores.max(axis=1)

    calib = json.load(open(CALIB))
    tau = np.array([float(calib[str(c)]["tau_fpr02"]) for c in LESION])
    y_pred = (scores >= tau).any(axis=1).astype(int)

    n = len(y_true)
    point = point_metrics(y_true, y_pred, y_score)
    print(f"[*] N={n}  patológicos={int(y_true.sum())}  normales={int((y_true == 0).sum())}")
    print(f"[*] τ_fpr02 (congelados 03-perclass): "
          + ", ".join(f"{calib[str(c)]['name']}={t:.4f}" for c, t in zip(LESION, tau)))

    rng = np.random.default_rng(SEED)
    keys = list(point.keys())
    boot = {k: np.empty(N_BOOT) for k in keys}
    for b in range(N_BOOT):
        idx = rng.integers(0, n, n)  # resampleo de imágenes con reemplazo
        yt, yp, ys = y_true[idx], y_pred[idx], y_score[idx]
        m = point_metrics(yt, yp, ys)
        for k in keys:
            boot[k][b] = m[k]

    result = {
        "experiment": "APTOS bootstrap 95% CI (image-resample, percentile)",
        "n_images": int(n), "n_boot": N_BOOT, "seed": SEED,
        "operating_point": "PCT_fpr02 (per-class tau frozen from 03-perclass)",
        "tau_fpr02": {calib[str(c)]["name"]: float(t) for c, t in zip(LESION, tau)},
        "metrics": {},
    }
    lines = [f"APTOS bootstrap 95% CI — {ts}",
             f"N={n}  n_boot={N_BOOT}  seed={SEED}  resample=image-level",
             "Operating point: PCT_fpr02 (τ per-clase congelados de 03-perclass)",
             "AUC = libre de umbral (score = máx clases lesión)", "",
             f"{'metric':<14}{'point':>9}{'CI95_low':>11}{'CI95_high':>11}"]
    for k in keys:
        lo, hi = np.percentile(boot[k], [2.5, 97.5])
        result["metrics"][k] = {"point": point[k], "ci95_low": float(lo),
                                "ci95_high": float(hi), "boot_mean": float(boot[k].mean()),
                                "boot_std": float(boot[k].std())}
        lines.append(f"{k:<14}{point[k]:>9.4f}{lo:>11.4f}{hi:>11.4f}")

    json.dump(result, open(out_dir / "bootstrap_ci.json", "w"), indent=2)
    (out_dir / "report.txt").write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\n[OK] -> {out_dir}")


if __name__ == "__main__":
    main()
