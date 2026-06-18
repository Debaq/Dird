#!/usr/bin/env python3
"""
Combina filtro de área mínima + calibración per-clase.

Para cada MIN_AREA en {0, 200, 400, 800, 1200}:
  1) Filtra detecciones con area_px < MIN_AREA
  2) Recalcula score máx por (imagen, clase)
  3) Calibra τ_c por clase (Youden / fpr05 / fpr02) sobre el conjunto filtrado
  4) Evalúa reglas: PCT_fpr02, PCT_fpr05, PCT_youden, PCT_fpr02_n2, etc.
"""
import json
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef, roc_auc_score, roc_curve)

np.random.seed(42)

BASE = Path(__file__).parent
CACHE = BASE / "results" / "raw_detections_bbox.csv"
LESION = [1, 3, 4, 5]
NAMES = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}
AREAS = [0, 200, 400, 800, 1200]


def metrics(y_true, y_pred, y_score=None):
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


def per_grade(df_pred):
    out = {}
    for g in [0, 1, 2, 3, 4]:
        sub = df_pred[df_pred["gt_grade"] == g]
        if not len(sub):
            continue
        if g == 0:
            out[g] = {"n": int(len(sub)),
                      "specificity": float((sub["pred"] == 0).mean())}
        else:
            out[g] = {"n": int(len(sub)),
                      "sensitivity": float((sub["pred"] == 1).mean())}
    return out


def main():
    if not CACHE.exists():
        raise SystemExit(f"Falta cache {CACHE}. Correr antes run_aptos_area_filter.py")
    det = pd.read_csv(CACHE)
    det["area_px"] = ((det["x2"] - det["x1"]).clip(lower=0)
                      * (det["y2"] - det["y1"]).clip(lower=0))
    print(f"[*] Detecciones cargadas: {len(det)}")

    # GT por imagen
    gt = (det.groupby("image_id")["gt_grade"].first().reset_index())
    gt["gt_binary"] = (gt["gt_grade"] != 0).astype(int)
    print(f"[*] N={len(gt)} patológicos={int(gt['gt_binary'].sum())}")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BASE / "results" / f"aptos_area_perclass_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)

    rows = []
    calibrations = {}

    for amin in AREAS:
        # Filtro de área (solo aplica a lesiones; landmarks no participan)
        les = det[det["class_idx"].isin(LESION) & (det["area_px"] >= amin)]
        # Score máx por (img, class)
        pivot = (les.groupby(["image_id", "class_idx"])["score"]
                 .max().unstack(fill_value=0.0))
        for c in LESION:
            if c not in pivot.columns:
                pivot[c] = 0.0
        pivot = pivot[LESION].reset_index()
        df = gt.merge(pivot, on="image_id", how="left").fillna(0.0)

        # Calibrar τ por clase
        cal = {}
        for c in LESION:
            y = df["gt_binary"].values
            s = df[c].values
            try:
                auc = float(roc_auc_score(y, s))
                fpr, tpr, thr = roc_curve(y, s)
                j = tpr - fpr
                tau_y = float(thr[int(np.argmax(j))])
                m02 = fpr <= 0.02
                m05 = fpr <= 0.05
                tau_02 = float(thr[m02][-1]) if m02.any() else float(thr[0])
                tau_05 = float(thr[m05][-1]) if m05.any() else float(thr[0])
            except Exception:
                auc, tau_y, tau_02, tau_05 = None, 0.5, 0.5, 0.5
            cal[c] = {"auc": auc, "tau_youden": tau_y,
                      "tau_fpr02": tau_02, "tau_fpr05": tau_05}
        calibrations[amin] = cal

        def eval_rule(name, taus, min_count=1):
            scores = df[LESION].values
            thr = np.array([taus[c] for c in LESION])
            votes = (scores >= thr).sum(axis=1)
            pred = (votes >= min_count).astype(int)
            score_max = (scores * (scores >= thr)).max(axis=1)
            m = metrics(df["gt_binary"].values, pred, score_max)
            tmp = df.copy(); tmp["pred"] = pred
            pg = per_grade(tmp)
            row = {"min_area_px": amin, "rule": name,
                   "min_count": min_count,
                   **{k: m[k] for k in ["sensitivity", "specificity", "ppv",
                                        "npv", "accuracy", "f1", "mcc",
                                        "youden_j", "auc_roc",
                                        "TP", "FP", "FN", "TN"]}}
            for g, d in pg.items():
                k = "spec" if g == 0 else "sens"
                row[f"g{g}_{k}"] = d.get("specificity",
                                         d.get("sensitivity", np.nan))
            rows.append(row)
            return row

        eval_rule("PCT_youden",   {c: cal[c]["tau_youden"] for c in LESION})
        eval_rule("PCT_fpr05",    {c: cal[c]["tau_fpr05"]  for c in LESION})
        eval_rule("PCT_fpr02",    {c: cal[c]["tau_fpr02"]  for c in LESION})
        eval_rule("PCT_youden_n2", {c: cal[c]["tau_youden"] for c in LESION}, 2)
        eval_rule("PCT_fpr02_n2",  {c: cal[c]["tau_fpr02"]  for c in LESION}, 2)

    summary = pd.DataFrame(rows)
    summary.to_csv(out_dir / "summary.csv", index=False)

    # Tabla principal
    L = [f"APTOS — área filter × per-class calibration — {ts}",
         f"N={len(gt)}", "", "═" * 78,
         "TABLA — métricas por (MIN_AREA, regla)",
         "═" * 78,
         f"{'min_area':>9s} {'rule':16s} {'sens':>7s} {'spec':>7s} "
         f"{'mcc':>7s} {'J':>7s} {'AUC':>7s}"]
    for _, r in summary.iterrows():
        auc = r["auc_roc"] if pd.notna(r["auc_roc"]) else 0
        L.append(f"{int(r['min_area_px']):9d} {r['rule']:16s} "
                 f"{r['sensitivity']:7.4f} {r['specificity']:7.4f} "
                 f"{r['mcc']:7.4f} {r['youden_j']:7.4f} {auc:7.4f}")

    L += ["", "═" * 78,
          "Calibración per-clase por MIN_AREA (τ_fpr02)",
          "═" * 78,
          f"{'MIN_AREA':>9s} | " + " | ".join(f"{NAMES[c][:14]:>14s}" for c in LESION)]
    for amin in AREAS:
        cells = " | ".join(
            f"{calibrations[amin][c]['tau_fpr02']:6.4f} (AUC={calibrations[amin][c]['auc']:.3f})"
            for c in LESION)
        L.append(f"{amin:9d} | {cells}")

    # Best
    cand = summary[summary["sensitivity"] >= 0.95].copy()
    if len(cand):
        best = cand.loc[cand["mcc"].idxmax()].to_dict()
        crit = "max MCC con sens ≥ 0.95"
    else:
        cand = summary[summary["sensitivity"] >= 0.90].copy()
        best = cand.loc[cand["mcc"].idxmax()].to_dict()
        crit = "max MCC con sens ≥ 0.90"

    L += ["", "═" * 78,
          f"BEST ({crit})", "═" * 78,
          f"  MIN_AREA = {int(best['min_area_px'])} px",
          f"  Regla    = {best['rule']}",
          f"  Sens={best['sensitivity']:.4f} | Spec={best['specificity']:.4f} | "
          f"MCC={best['mcc']:.4f} | J={best['youden_j']:.4f}"]

    # Comparación vs experimentos previos
    L += ["", "═" * 78,
          "Comparativa con mejores puntos previos",
          "═" * 78,
          f"{'experimento':40s} {'sens':>7s} {'spec':>7s} {'mcc':>7s} {'J':>7s}",
          f"{'baseline R3 (sweep, area=0)':40s}  0.9316  0.9180  0.8498  0.8496",
          f"{'PCT_fpr02 (per-class, area=0)':40s}  0.9785  0.9330  0.9129  0.9114",
          f"{'area=800 + R3':40s}  0.9246  0.9540  0.8787  0.8786",
          f"{'BEST combinado':40s}  {best['sensitivity']:.4f}  "
          f"{best['specificity']:.4f}  {best['mcc']:.4f}  {best['youden_j']:.4f}"]

    out = "\n".join(L)
    (out_dir / "report.txt").write_text(out)
    print(out)

    with open(out_dir / "calibrations.json", "w") as f:
        json.dump({str(a): {int(k): v for k, v in d.items()}
                   for a, d in calibrations.items()}, f, indent=2)
    with open(out_dir / "best.json", "w") as f:
        json.dump({k: (float(v) if isinstance(v, (np.floating, float))
                       else int(v) if isinstance(v, (np.integer, int))
                       else v)
                   for k, v in best.items()}, f, indent=2, default=str)

    print(f"\n[OK] {out_dir}")


if __name__ == "__main__":
    main()
