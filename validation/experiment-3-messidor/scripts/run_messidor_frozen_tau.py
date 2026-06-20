#!/usr/bin/env python3
"""
Sub-exp 2 (Messidor) — VALIDACIÓN EXTERNA DEL UMBRAL (el resultado titular).

Toma los umbrales por-clase τ calibrados en APTOS (PCT_fpr02, congelados) y los aplica
TAL CUAL sobre Messidor, SIN recalibrar nada. Responde la pregunta abierta del REPORT
de APTOS §8.4/8.5: ¿el punto de operación generaliza a una 3ª población / otras cámaras?

Reglas evaluadas sobre el dump raw_detections.csv (de run_messidor_sweep.py):
  FROZEN_fpr02        : ALTERADA ⇔ ∃ clase c con score ≥ τ_apto[c]   (τ congelado de APTOS)
  FROZEN_fpr02_n2     : idem + ≥2 detecciones que pasen su τ
  FROZEN_fpr05        : idem con τ_fpr05 de APTOS
Para cuantificar el shift poblacional, además RE-CALIBRA τ sobre Messidor (fpr02) y reporta:
  REFIT_fpr02         : techo alcanzable si se recalibrara en Messidor
El gap FROZEN vs REFIT = costo de no haber visto Messidor. Si es chico, el τ de APTOS
es transportable (validación externa exitosa).
"""
import argparse
import json
from datetime import datetime
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef, roc_auc_score, roc_curve)

ANATOM = {0, 2}
LESION_CLASSES = [1, 3, 4, 5]
CLASS_NAMES = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}


def metrics_for(y_true, y_pred, y_score=None) -> dict:
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    out = {
        "TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp),
        "sensitivity": sens, "specificity": spec,
        "ppv": tp / (tp + fp) if (tp + fp) else 0.0,
        "npv": tn / (tn + fn) if (tn + fn) else 0.0,
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "f1": float(f1_score(y_true, y_pred, zero_division=0)),
        "mcc": float(matthews_corrcoef(y_true, y_pred)),
        "youden_j": sens + spec - 1.0,
    }
    if y_score is not None:
        try:
            out["auc_roc"] = float(roc_auc_score(y_true, y_score))
        except Exception:  # noqa: BLE001
            out["auc_roc"] = None
    return out


def per_image_class_scores(raw: pd.DataFrame) -> tuple[pd.DataFrame, np.ndarray, np.ndarray]:
    """Score máx por (imagen, clase de lesión). Devuelve matriz [N, 4 clases], gt_binary."""
    ids = raw["id_code"].drop_duplicates().tolist()
    idx = {v: i for i, v in enumerate(ids)}
    gt = raw.groupby("id_code")["gt_grade"].first()
    gt_bin = np.array([0 if int(gt[i]) == 0 else 1 for i in ids])
    mat = np.zeros((len(ids), len(LESION_CLASSES)), dtype=np.float32)
    sub = raw[raw["class"].isin(LESION_CLASSES)]
    for ci, c in enumerate(LESION_CLASSES):
        g = sub[sub["class"] == c].groupby("id_code")["score"].max()
        for img_id, sc in g.items():
            mat[idx[img_id], ci] = sc
    return pd.DataFrame(mat, columns=[CLASS_NAMES[c] for c in LESION_CLASSES], index=ids), mat, gt_bin


def tau_at_fpr(scores_norm: np.ndarray, target_fpr: float, floor: float = 0.05) -> float:
    """τ tal que FPR sobre TODOS los normales ≤ target_fpr (mismo criterio que APTOS:
    el score por imagen es 0 si no hubo detección de esa clase).
    Si ≤target_fpr de los normales tienen detección, el cuantil cae en 0 -> se usa el
    menor score positivo (con piso `floor`, igual que el min_score del dump de APTOS)."""
    if scores_norm.size == 0:
        return 1.0
    q = float(np.quantile(scores_norm, 1.0 - target_fpr))
    if q <= 0.0:
        pos = scores_norm[scores_norm > 0]
        return float(max(pos.min(), floor)) if pos.size else 1.0
    return q


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--raw", default="results/02-sweep/raw_detections.csv")
    ap.add_argument("--aptos-calib",
                    default="../experiment-2-aptos/results/03-perclass/perclass_calibration.json")
    ap.add_argument("--output", default="results")
    args = ap.parse_args()

    base = Path(__file__).parent.parent
    raw = pd.read_csv(base / args.raw)
    calib = json.load(open((base / args.aptos_calib).resolve()))
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = base / args.output / "03-frozen-tau"
    out_dir.mkdir(parents=True, exist_ok=True)

    score_df, mat, gt_bin = per_image_class_scores(raw)
    norm_mask = gt_bin == 0

    # τ congelados de APTOS (índices string en el json)
    tau_apto_fpr02 = {c: float(calib[str(c)]["tau_fpr02"]) for c in LESION_CLASSES}
    tau_apto_fpr05 = {c: float(calib[str(c)]["tau_fpr05"]) for c in LESION_CLASSES}

    # τ recalibrados sobre Messidor (techo)
    tau_refit_fpr02 = {}
    for ci, c in enumerate(LESION_CLASSES):
        tau_refit_fpr02[c] = tau_at_fpr(mat[norm_mask, ci], 0.02)

    def apply_rule(tau_map: dict, n_min: int = 1):
        passed = np.zeros_like(mat, dtype=bool)
        for ci, c in enumerate(LESION_CLASSES):
            passed[:, ci] = mat[:, ci] >= tau_map[c]
        n_pass = passed.sum(axis=1)
        pred = (n_pass >= n_min).astype(int)
        score = mat.max(axis=1)  # score continuo para AUC (libre de τ)
        return pred, score

    rules = {}
    for name, tau_map, n_min in [
        ("FROZEN_fpr02", tau_apto_fpr02, 1),
        ("FROZEN_fpr02_n2", tau_apto_fpr02, 2),
        ("FROZEN_fpr05", tau_apto_fpr05, 1),
        ("REFIT_fpr02", tau_refit_fpr02, 1),
    ]:
        pred, score = apply_rule(tau_map, n_min)
        rules[name] = metrics_for(gt_bin, pred, score)

    # AUC externo libre de umbral (score = máx sobre clases de lesión)
    auc_ext = None
    try:
        auc_ext = float(roc_auc_score(gt_bin, mat.max(axis=1)))
    except Exception:  # noqa: BLE001
        pass

    result = {
        "experiment": "Messidor external threshold validation (frozen APTOS per-class tau)",
        "n_images": int(len(gt_bin)), "n_normals": int(norm_mask.sum()),
        "n_pathological": int((~norm_mask).sum()),
        "auc_ood_threshold_free": auc_ext,
        "tau_frozen_from_aptos_fpr02": {CLASS_NAMES[c]: tau_apto_fpr02[c] for c in LESION_CLASSES},
        "tau_refit_on_messidor_fpr02": {CLASS_NAMES[c]: tau_refit_fpr02[c] for c in LESION_CLASSES},
        "rules": rules,
        "gap_frozen_vs_refit_mcc": (rules["REFIT_fpr02"]["mcc"] - rules["FROZEN_fpr02"]["mcc"]),
        "timestamp": ts,
    }
    json.dump(result, open(out_dir / "frozen_tau.json", "w"), indent=2)
    pd.DataFrame(rules).T.to_csv(out_dir / "rules_summary.csv")
    score_df.assign(gt_binary=gt_bin).to_csv(out_dir / "per_image_class_scores.csv")

    lines = [
        f"Messidor external threshold validation — {ts}",
        f"N={len(gt_bin)}  normales={int(norm_mask.sum())}  patológicas={int((~norm_mask).sum())}",
        f"AUC OOD (threshold-free) = {auc_ext if auc_ext is None else f'{auc_ext:.4f}'}",
        "",
        "τ congelados (APTOS PCT_fpr02) vs τ recalibrados (Messidor fpr02):",
    ]
    for c in LESION_CLASSES:
        lines.append(f"  {CLASS_NAMES[c]:<18} frozen={tau_apto_fpr02[c]:.4f}   refit={tau_refit_fpr02[c]:.4f}")
    lines += ["", f"{'rule':<18} {'sens':>7} {'spec':>7} {'mcc':>7} {'f1':>7} {'auc':>7}"]
    for name, m in rules.items():
        lines.append(f"{name:<18} {m['sensitivity']:>7.4f} {m['specificity']:>7.4f} "
                     f"{m['mcc']:>7.4f} {m['f1']:>7.4f} {m.get('auc_roc') or 0:>7.4f}")
    lines += ["",
              f"GAP MCC (refit - frozen) = {result['gap_frozen_vs_refit_mcc']:+.4f}  "
              "(chico = τ de APTOS transportable -> validación externa OK)"]
    (out_dir / "report.txt").write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\n[OK] -> {out_dir}")


if __name__ == "__main__":
    main()
