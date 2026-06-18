#!/usr/bin/env python3
"""
Calibración per-clase de umbrales sobre APTOS.
Reusa raw_detections.csv del sweep (no re-infiere).

Por cada clase de lesión c ∈ {1,3,4,5}:
  - calcula score máx por imagen (0 si no hay detección de c)
  - curva ROC contra GT binario (g0 vs g1-4)
  - umbrales candidatos:
      τ_youden  : maximiza Youden J de esa clase
      τ_fpr05   : FPR sobre normales = 5%
      τ_fpr10   : FPR sobre normales = 10%

Reglas evaluadas:
  PCT_youden  : ALTERADO ⇔ ∃ c con score ≥ τ_youden[c]
  PCT_fpr05   : idem con τ_fpr05
  PCT_fpr10   : idem con τ_fpr10
  PCT_youden_n2 : PCT_youden + requiere ≥2 detecciones (cualquier clase) que pasen su τ

También baseline uniformes para comparar.
"""
import json
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef, roc_auc_score, roc_curve)
from datetime import datetime

BASE = Path(__file__).parent
SWEEP = BASE / "results" / "aptos_sweep_20260430_140753"
RAW_CSV = SWEEP / "raw_detections.csv"
CSV = BASE / "aptos_extracted" / "train.csv"

ANATOM = {0, 2}
LESION_CLASSES = [1, 3, 4, 5]
CLASS_NAMES = {0: "optic_disc", 1: "hard_exudate", 2: "fovea",
               3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}


def metrics_for(y_true, y_pred, y_score=None):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    out = {
        "TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp),
        "sensitivity": sens, "specificity": spec,
        "ppv": tp / (tp + fp) if (tp + fp) else 0.0,
        "npv": tn / (tn + fn) if (tn + fn) else 0.0,
        "accuracy": accuracy_score(y_true, y_pred),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "mcc": matthews_corrcoef(y_true, y_pred),
        "youden_j": sens + spec - 1.0,
    }
    if y_score is not None:
        try:
            out["auc_roc"] = float(roc_auc_score(y_true, y_score))
        except Exception:
            out["auc_roc"] = None
    return out


def per_grade_breakdown(df_pred):
    out = {}
    for g in [0, 1, 2, 3, 4]:
        sub = df_pred[df_pred["gt_grade"] == g]
        if not len(sub):
            continue
        if g == 0:
            out[str(g)] = {"n": int(len(sub)),
                           "specificity": float((sub["pred"] == 0).mean())}
        else:
            out[str(g)] = {"n": int(len(sub)),
                           "sensitivity": float((sub["pred"] == 1).mean())}
    return out


def main():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BASE / "results" / f"aptos_perclass_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(RAW_CSV)
    gt_df = pd.read_csv(CSV)[["id_code", "diagnosis"]]
    gt_df["gt_binary"] = (gt_df["diagnosis"] != 0).astype(int)
    gt_df = gt_df.rename(columns={"diagnosis": "gt_grade"})
    print(f"[*] raw detections: {len(raw)}  imágenes: {gt_df.shape[0]}")

    # Score máx por (imagen, clase). Score 0 si no hay detección de esa clase
    pivot = (raw[raw["class"] >= 0]
             .groupby(["id_code", "class"])["score"].max()
             .unstack(fill_value=0.0))
    for c in LESION_CLASSES:
        if c not in pivot.columns:
            pivot[c] = 0.0
    pivot = pivot[LESION_CLASSES].reset_index()

    df = gt_df.merge(pivot, on="id_code", how="left").fillna(0.0)
    print(f"[*] merged: {df.shape[0]}")

    # ----- Calibración per-clase -----
    perclass = {}
    for c in LESION_CLASSES:
        y = df["gt_binary"].values
        s = df[c].values
        try:
            auc = float(roc_auc_score(y, s))
            fpr, tpr, thr = roc_curve(y, s)
            j = tpr - fpr
            i_y = int(np.argmax(j))
            tau_youden = float(thr[i_y])
            # τ para FPR ≤ 5% / 10%
            mask05 = fpr <= 0.05
            mask10 = fpr <= 0.10
            tau_fpr05 = float(thr[mask05][-1]) if mask05.any() else float(thr[0])
            tau_fpr10 = float(thr[mask10][-1]) if mask10.any() else float(thr[0])
        except Exception:
            auc, tau_youden, tau_fpr05, tau_fpr10 = None, 0.5, 0.5, 0.5
        perclass[c] = {
            "name": CLASS_NAMES[c],
            "auc_per_class": auc,
            "tau_youden": tau_youden,
            "tau_fpr05": tau_fpr05,
            "tau_fpr10": tau_fpr10,
            "sens_at_youden": float(tpr[i_y]),
            "spec_at_youden": float(1 - fpr[i_y]),
            "n_normals_with_det": int((df[df["gt_binary"] == 0][c] >= 0.25).sum()),
            "n_pathol_with_det": int((df[df["gt_binary"] == 1][c] >= 0.25).sum()),
        }

    print("\n[*] Calibración per-clase:")
    for c, d in perclass.items():
        print(f"  c{c} {d['name']:18s} AUC={d['auc_per_class']:.3f} "
              f"τ_youden={d['tau_youden']:.3f} τ_fpr05={d['tau_fpr05']:.3f} "
              f"τ_fpr10={d['tau_fpr10']:.3f}")

    # ----- Reglas -----
    rules_eval = []

    def eval_rule(name, taus, min_count=1):
        """taus: dict[class]->thr.  ALTERADO si #classes con score≥τ ≥ min_count."""
        votes = np.zeros(len(df), dtype=int)
        score_max = np.zeros(len(df))
        for c, t in taus.items():
            v = (df[c].values >= t).astype(int)
            votes += v
            sc = df[c].values * (df[c].values >= t)
            score_max = np.maximum(score_max, sc)
        pred = (votes >= min_count).astype(int)
        m = metrics_for(df["gt_binary"].values, pred, score_max)
        m["rule"] = name
        m["taus"] = {int(k): float(v) for k, v in taus.items()}
        m["min_count"] = min_count
        tmp = df.copy(); tmp["pred"] = pred
        m["per_grade"] = per_grade_breakdown(tmp)
        rules_eval.append(m)
        return m

    # Baselines uniformes
    eval_rule("UNI_0.25", {c: 0.25 for c in LESION_CLASSES})
    eval_rule("UNI_0.40", {c: 0.40 for c in LESION_CLASSES})
    eval_rule("UNI_0.40_n2", {c: 0.40 for c in LESION_CLASSES}, min_count=2)

    # Per-class
    eval_rule("PCT_youden",  {c: perclass[c]["tau_youden"] for c in LESION_CLASSES})
    eval_rule("PCT_fpr05",   {c: perclass[c]["tau_fpr05"] for c in LESION_CLASSES})
    eval_rule("PCT_fpr10",   {c: perclass[c]["tau_fpr10"] for c in LESION_CLASSES})
    eval_rule("PCT_youden_n2", {c: perclass[c]["tau_youden"] for c in LESION_CLASSES},
              min_count=2)
    eval_rule("PCT_fpr10_n2",  {c: perclass[c]["tau_fpr10"] for c in LESION_CLASSES},
              min_count=2)

    # Híbrida: para clases ruidosas (1,5) τ ALTO; para limpias (3,4) τ BAJO
    HYBRID_HIGH = {1: max(0.50, perclass[1]["tau_fpr10"]),
                   5: max(0.50, perclass[5]["tau_fpr10"]),
                   3: 0.25, 4: 0.25}
    eval_rule("HYBRID_noisy_high", HYBRID_HIGH)
    HYBRID_HIGH_n2 = HYBRID_HIGH.copy()
    eval_rule("HYBRID_noisy_high_n2", HYBRID_HIGH_n2, min_count=2)

    # Hyper-strict per-class: usar τ que da FPR=2%
    fpr02 = {}
    for c in LESION_CLASSES:
        y = df["gt_binary"].values; s = df[c].values
        fpr, tpr, thr = roc_curve(y, s)
        m2 = fpr <= 0.02
        fpr02[c] = float(thr[m2][-1]) if m2.any() else float(thr[0])
        perclass[c]["tau_fpr02"] = fpr02[c]
    eval_rule("PCT_fpr02", fpr02)

    # ----- Salida -----
    rows = []
    for r in rules_eval:
        rows.append({"rule": r["rule"], **{k: r[k] for k in
                    ["sensitivity", "specificity", "ppv", "npv",
                     "accuracy", "f1", "mcc", "youden_j", "auc_roc",
                     "TP", "FP", "FN", "TN"]}})
    summary = pd.DataFrame(rows)
    summary.to_csv(out_dir / "rules_summary.csv", index=False)

    with open(out_dir / "perclass_calibration.json", "w") as f:
        json.dump(perclass, f, indent=2)
    with open(out_dir / "rules_full.json", "w") as f:
        json.dump(rules_eval, f, indent=2)

    # Reporte
    L = [f"APTOS per-class calibration — {ts}", f"N={len(df)}",
         "",
         "Calibración per-clase (sobre score máx por imagen):",
         f"{'class':20s} {'AUC':>6s} {'τ_youden':>10s} {'τ_fpr05':>10s} "
         f"{'τ_fpr10':>10s} {'τ_fpr02':>10s}  norm/path con det@0.25"]
    for c in LESION_CLASSES:
        d = perclass[c]
        L.append(f"  c{c} {d['name']:16s} {d['auc_per_class']:6.4f} "
                 f"{d['tau_youden']:10.4f} {d['tau_fpr05']:10.4f} "
                 f"{d['tau_fpr10']:10.4f} {d['tau_fpr02']:10.4f}  "
                 f"{d['n_normals_with_det']}/{d['n_pathol_with_det']}")
    L.append("")
    L.append(f"{'rule':24s} {'sens':>6s} {'spec':>6s} {'ppv':>6s} "
             f"{'npv':>6s} {'acc':>6s} {'f1':>6s} {'mcc':>6s} {'J':>6s} {'AUC':>6s}")
    for r in rules_eval:
        L.append(f"{r['rule']:24s} {r['sensitivity']:6.4f} {r['specificity']:6.4f} "
                 f"{r['ppv']:6.4f} {r['npv']:6.4f} {r['accuracy']:6.4f} "
                 f"{r['f1']:6.4f} {r['mcc']:6.4f} {r['youden_j']:6.4f} "
                 f"{r['auc_roc'] if r['auc_roc'] else 0:6.4f}")
    L.append("")
    L.append("Per-grade detalle:")
    for r in rules_eval:
        L.append(f"  {r['rule']}  τ={r['taus']}  min_count={r['min_count']}")
        for g, d in r["per_grade"].items():
            k = "spec" if g == "0" else "sens"
            v = d.get("specificity", d.get("sensitivity"))
            L.append(f"    grado {g} (n={d['n']:4d}): {k}={v:.4f}")

    (out_dir / "report.txt").write_text("\n".join(L))
    print("\n".join(L))
    print(f"\n[OK] {out_dir}")


if __name__ == "__main__":
    main()
