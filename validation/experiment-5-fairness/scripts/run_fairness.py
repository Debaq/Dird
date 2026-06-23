#!/usr/bin/env python3
"""
Exp 5 — Análisis de fairness / desempeño por subgrupo (TRIPOD+AI).

NO re-inferencia: reutiliza los per_image.csv y raw_detections.csv ya generados
por exp-2 (APTOS), exp-3 (Messidor) y exp-4 (DDR).

Subgrupos evaluados (los únicos con metadata local disponible):
  - Por SEVERIDAD (grado ICDR 0-4): sensibilidad por grado patológico + spec(grado 0).
  - Por TIPO DE LESIÓN (4 canales): AUC discriminativa de cada score de clase.
  - Por SITIO/POBLACIÓN: comparación entre datasets (India/Francia/China).

Subgrupos NO viables sin metadata externa: cámara/dispositivo, hospital, edad, sexo.
(El prefijo del filename DDR NO mapea a hospital: >5000 prefijos únicos != 147 hospitales.)
"""
import csv
import json
from pathlib import Path

import numpy as np
from sklearn.metrics import roc_auc_score, matthews_corrcoef

ROOT = Path(__file__).resolve().parents[2]  # .../Dird/validation

LESION = {1: "hard_exudate", 3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}

DATASETS = {
    "APTOS":    {"pop": "India",   "per_image": "experiment-2-aptos/results/01-binary/per_image.csv",
                 "raw": "experiment-2-aptos/results/02-sweep/raw_detections.csv"},
    "Messidor": {"pop": "Francia*", "per_image": "experiment-3-messidor/results/01-binary/per_image.csv",
                 "raw": "experiment-3-messidor/results/02-sweep/raw_detections.csv"},
    "DDR":      {"pop": "China",   "per_image": "experiment-4-ddr/results/01-binary/per_image.csv",
                 "raw": "experiment-4-ddr/results/02-sweep/raw_detections.csv"},
}


def read_per_image(path):
    rows = []
    with open(path) as f:
        for r in csv.DictReader(f):
            rows.append({
                "id": r["id_code"],
                "grade": int(r["gt_grade"]),
                "y": int(r["gt_binary"]),
                "pred": int(r["pred_binary"]),
                "score": float(r["max_lesion_score"]),
            })
    return rows


def read_class_scores(path):
    """Max score por clase de lesión por imagen, desde raw_detections.csv."""
    per = {}  # id -> {cls_idx: maxscore}
    ybind = {}
    with open(path) as f:
        for r in csv.DictReader(f):
            cid = r["id_code"]
            c = int(r["class"])
            s = float(r["score"])
            ybind.setdefault(cid, int(r["gt_grade"]) >= 1)
            if c in LESION:
                d = per.setdefault(cid, {})
                d[c] = max(d.get(c, 0.0), s)
    return per, ybind


def metrics(y, pred):
    y = np.array(y); pred = np.array(pred)
    tp = int(((y == 1) & (pred == 1)).sum()); fn = int(((y == 1) & (pred == 0)).sum())
    tn = int(((y == 0) & (pred == 0)).sum()); fp = int(((y == 0) & (pred == 1)).sum())
    sens = tp / (tp + fn) if (tp + fn) else float("nan")
    spec = tn / (tn + fp) if (tn + fp) else float("nan")
    mcc = matthews_corrcoef(y, pred) if len(set(y.tolist())) > 1 else float("nan")
    return {"n": len(y), "tp": tp, "fn": fn, "tn": tn, "fp": fp,
            "sens": sens, "spec": spec, "mcc": mcc}


report = {}
for name, cfg in DATASETS.items():
    rows = read_per_image(ROOT / cfg["per_image"])
    y = [r["y"] for r in rows]; pred = [r["pred"] for r in rows]; score = [r["score"] for r in rows]

    overall = metrics(y, pred)
    overall["auc"] = roc_auc_score(y, score) if len(set(y)) > 1 else float("nan")

    # --- por severidad ---
    grades = {}
    spec_rows = [r for r in rows if r["grade"] == 0]
    spec = (sum(1 for r in spec_rows if r["pred"] == 0) / len(spec_rows)) if spec_rows else float("nan")
    for g in range(0, 5):
        sub = [r for r in rows if r["grade"] == g]
        if not sub:
            continue
        if g == 0:
            grades[g] = {"n": len(sub), "metric": "specificity", "value": spec}
        else:
            sens_g = sum(1 for r in sub if r["pred"] == 1) / len(sub)
            grades[g] = {"n": len(sub), "metric": "sensitivity", "value": sens_g}

    # --- por tipo de lesión (AUC) ---
    per, ybind = read_class_scores(ROOT / cfg["raw"])
    ids = list(ybind.keys())
    yb = np.array([1 if ybind[i] else 0 for i in ids])
    lesion_auc = {}
    if len(set(yb.tolist())) > 1:
        for c, cname in LESION.items():
            sc = np.array([per.get(i, {}).get(c, 0.0) for i in ids])
            lesion_auc[cname] = float(roc_auc_score(yb, sc))

    report[name] = {"population": cfg["pop"], "overall": overall,
                    "by_severity": grades, "by_lesion_auc": lesion_auc}
    print(f"[{name}] n={overall['n']} AUC={overall['auc']:.3f} "
          f"sens={overall['sens']:.3f} spec={overall['spec']:.3f} MCC={overall['mcc']:.3f}")

out_dir = ROOT / "experiment-5-fairness/results"
out_dir.mkdir(parents=True, exist_ok=True)
with open(out_dir / "fairness.json", "w") as f:
    json.dump(report, f, indent=2)
print(f"\n-> {out_dir / 'fairness.json'}")
