#!/usr/bin/env python3
"""
Cross-validation 5-fold estratificada para validar que los umbrales
per-clase no overfittean.

Por cada fold:
  - calibrar τ_c (Youden / fpr05 / fpr02) sobre TRAIN
  - aplicar regla a TEST y medir métricas

Reporta media ± std de cada regla y variabilidad de τ.
"""
import json
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.model_selection import StratifiedKFold
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef, roc_auc_score, roc_curve)

BASE = Path(__file__).parent
SWEEP = BASE / "results" / "aptos_sweep_20260430_140753"
LESION = [1, 3, 4, 5]
NAMES = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}
RANDOM_SEED = 42
N_FOLDS = 5


def metrics_for(y_true, y_pred):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    return {
        "TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp),
        "sensitivity": sens, "specificity": spec,
        "ppv": tp / (tp + fp) if (tp + fp) else 0.0,
        "npv": tn / (tn + fn) if (tn + fn) else 0.0,
        "accuracy": accuracy_score(y_true, y_pred),
        "f1": f1_score(y_true, y_pred, zero_division=0),
        "mcc": matthews_corrcoef(y_true, y_pred),
        "youden_j": sens + spec - 1.0,
    }


def calibrate(df_train):
    """Devuelve dicts de umbrales por método."""
    out = {"youden": {}, "fpr05": {}, "fpr02": {}, "fpr10": {}}
    auc = {}
    y = df_train["gt_binary"].values
    for c in LESION:
        s = df_train[c].values
        try:
            auc[c] = float(roc_auc_score(y, s))
            fpr, tpr, thr = roc_curve(y, s)
            j = tpr - fpr
            out["youden"][c] = float(thr[int(np.argmax(j))])
            for tag, target in [("fpr02", 0.02), ("fpr05", 0.05), ("fpr10", 0.10)]:
                m = fpr <= target
                out[tag][c] = float(thr[m][-1]) if m.any() else float(thr[0])
        except Exception:
            auc[c] = None
            for k in out: out[k][c] = 0.5
    return out, auc


def main():
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BASE / "results" / f"aptos_cv_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)

    raw = pd.read_csv(SWEEP / "raw_detections.csv")
    gt = pd.read_csv(BASE / "aptos_extracted" / "train.csv").rename(
        columns={"diagnosis": "gt_grade"})
    gt["gt_binary"] = (gt["gt_grade"] != 0).astype(int)
    pivot = (raw[raw["class"] >= 0]
             .groupby(["id_code", "class"])["score"].max().unstack(fill_value=0.0))
    for c in LESION:
        if c not in pivot.columns:
            pivot[c] = 0.0
    pivot = pivot[LESION].reset_index()
    df = gt.merge(pivot, on="id_code", how="left").fillna(0.0).reset_index(drop=True)
    print(f"[*] N={len(df)}  patológicos={int(df['gt_binary'].sum())}")

    skf = StratifiedKFold(n_splits=N_FOLDS, shuffle=True, random_state=RANDOM_SEED)
    fold_results = []
    tau_records = {meth: {c: [] for c in LESION}
                   for meth in ["youden", "fpr02", "fpr05", "fpr10"]}

    for fold_i, (tr, te) in enumerate(skf.split(df, df["gt_binary"])):
        train, test = df.iloc[tr], df.iloc[te]
        taus, aucs = calibrate(train)
        for meth, d in taus.items():
            for c, v in d.items():
                tau_records[meth][c].append(v)

        rules = {}

        def apply_rule(name, taus_dict, min_count=1):
            scores = test[LESION].values
            thr = np.array([taus_dict[c] for c in LESION])
            votes = (scores >= thr).sum(axis=1)
            pred = (votes >= min_count).astype(int)
            return metrics_for(test["gt_binary"].values, pred)

        rules["UNI_0.25"]      = apply_rule("UNI_0.25", {c: 0.25 for c in LESION})
        rules["UNI_0.40_n2"]   = apply_rule("UNI_0.40_n2", {c: 0.40 for c in LESION}, 2)
        rules["PCT_youden"]    = apply_rule("PCT_youden", taus["youden"])
        rules["PCT_fpr05"]     = apply_rule("PCT_fpr05", taus["fpr05"])
        rules["PCT_fpr02"]     = apply_rule("PCT_fpr02", taus["fpr02"])
        rules["PCT_fpr10"]     = apply_rule("PCT_fpr10", taus["fpr10"])
        rules["PCT_youden_n2"] = apply_rule("PCT_youden_n2", taus["youden"], 2)
        rules["PCT_fpr05_n2"]  = apply_rule("PCT_fpr05_n2", taus["fpr05"], 2)

        fold_results.append({
            "fold": fold_i, "n_train": len(train), "n_test": len(test),
            "taus": {meth: {int(k): v for k, v in d.items()} for meth, d in taus.items()},
            "auc_per_class": {int(k): v for k, v in aucs.items()},
            "rules": rules,
        })
        print(f"[fold {fold_i}] PCT_fpr02: sens={rules['PCT_fpr02']['sensitivity']:.4f} "
              f"spec={rules['PCT_fpr02']['specificity']:.4f} "
              f"mcc={rules['PCT_fpr02']['mcc']:.4f}")

    # Agregar
    rule_names = list(fold_results[0]["rules"].keys())
    metric_keys = ["sensitivity", "specificity", "ppv", "npv", "accuracy",
                   "f1", "mcc", "youden_j"]
    summary = []
    for rn in rule_names:
        row = {"rule": rn}
        for mk in metric_keys:
            vals = [f["rules"][rn][mk] for f in fold_results]
            row[f"{mk}_mean"] = float(np.mean(vals))
            row[f"{mk}_std"] = float(np.std(vals))
            row[f"{mk}_min"] = float(np.min(vals))
            row[f"{mk}_max"] = float(np.max(vals))
        summary.append(row)
    sum_df = pd.DataFrame(summary)
    sum_df.to_csv(out_dir / "cv_rules_summary.csv", index=False)

    tau_summary = {}
    for meth, d in tau_records.items():
        tau_summary[meth] = {}
        for c, vs in d.items():
            tau_summary[meth][int(c)] = {
                "name": NAMES[c],
                "values": [float(v) for v in vs],
                "mean": float(np.mean(vs)),
                "std": float(np.std(vs)),
                "cv": float(np.std(vs) / np.mean(vs)) if np.mean(vs) > 0 else None,
            }

    with open(out_dir / "cv_full.json", "w") as f:
        json.dump({"folds": fold_results, "tau_stability": tau_summary,
                   "n_folds": N_FOLDS, "seed": RANDOM_SEED}, f, indent=2)

    L = [f"APTOS 5-fold CV — {ts}", f"N={len(df)}  seed={RANDOM_SEED}", "",
         "Estabilidad de umbrales per-clase (mean ± std a través de folds):"]
    for meth in ["youden", "fpr02", "fpr05", "fpr10"]:
        L.append(f"  método {meth}:")
        for c in LESION:
            d = tau_summary[meth][c]
            L.append(f"    c{c} {d['name']:18s} τ = {d['mean']:.4f} ± {d['std']:.4f}  "
                     f"(CV={d['cv']:.3f})" if d['cv'] is not None
                     else f"    c{c} {d['name']:18s} τ = {d['mean']:.4f} ± {d['std']:.4f}")
    L.append("")
    L.append(f"{'rule':18s} {'sens':>14s} {'spec':>14s} {'mcc':>14s} {'J':>14s}")
    for r in summary:
        L.append(f"{r['rule']:18s} "
                 f"{r['sensitivity_mean']:.4f}±{r['sensitivity_std']:.4f}  "
                 f"{r['specificity_mean']:.4f}±{r['specificity_std']:.4f}  "
                 f"{r['mcc_mean']:.4f}±{r['mcc_std']:.4f}  "
                 f"{r['youden_j_mean']:.4f}±{r['youden_j_std']:.4f}")
    L.append("")
    L.append("Resumen por fold (PCT_fpr02):")
    for f in fold_results:
        r = f["rules"]["PCT_fpr02"]
        L.append(f"  fold {f['fold']}: sens={r['sensitivity']:.4f} "
                 f"spec={r['specificity']:.4f} mcc={r['mcc']:.4f}  "
                 f"τ={f['taus']['fpr02']}")

    (out_dir / "report.txt").write_text("\n".join(L))
    print("\n".join(L))
    print(f"\n[OK] {out_dir}")


if __name__ == "__main__":
    main()
