#!/usr/bin/env python3
"""
Experimento binario sobre APTOS 2019:
- Modelo: detection-v2.0.0.onnx (end2end_nms, 6 clases activas)
- Regla: imagen ALTERADA si hay >=1 detección (conf>=THR) de clase != 0 (optic_disc)
  y != 2 (fovea). Si solo se detectan clase 0 y/o 2 (o nada) -> NORMAL.
- Ground truth APTOS: 0 = normal, 1-4 = patológico.
- Métricas: sensibilidad, especificidad, accuracy, PPV, NPV, F1, MCC, AUC,
  matriz de confusión, sensibilidad por grado, tiempos de inferencia.
"""

import argparse
import json
import os
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
import pandas as pd
from sklearn.metrics import (
    accuracy_score,
    confusion_matrix,
    f1_score,
    matthews_corrcoef,
    roc_auc_score,
    roc_curve,
)
from tqdm import tqdm

INPUT_SIZE = 640
ANATOMICAL_CLASSES = {0, 2}  # optic_disc, fovea -> NO patológico


def preprocess(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    img = img.astype(np.float32) / 255.0
    img = np.transpose(img, (2, 0, 1))
    return np.expand_dims(img, 0)


def parse_end2end(out: np.ndarray, conf_thr: float):
    """Output [1, D, 6] -> lista de (class_idx, score)."""
    data = out.squeeze(0)
    dets = []
    for i in range(data.shape[0]):
        score = float(data[i, 4])
        if score < conf_thr:
            continue
        ci = int(data[i, 5])
        dets.append((ci, score))
    return dets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="detection-v2.0.0.onnx")
    ap.add_argument("--csv", default="aptos_extracted/train.csv")
    ap.add_argument("--images", default="aptos_extracted/train_images")
    ap.add_argument("--output", default="results")
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--limit", type=int, default=0, help="0 = todas")
    ap.add_argument("--tag", default="")
    args = ap.parse_args()

    base = Path(__file__).parent
    model_path = base / args.model
    csv_path = base / args.csv
    img_dir = base / args.images
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = f"_{args.tag}" if args.tag else ""
    out_dir = base / args.output / f"aptos_binary_{ts}{tag}"
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"[*] Modelo: {model_path}")
    print(f"[*] CSV:    {csv_path}")
    print(f"[*] Imgs:   {img_dir}")
    print(f"[*] Out:    {out_dir}")
    print(f"[*] conf:   {args.conf}")

    df = pd.read_csv(csv_path)
    if args.limit > 0:
        df = df.head(args.limit)
    print(f"[*] Total imágenes: {len(df)}")

    providers = ort.get_available_providers()
    print(f"[*] Providers ORT: {providers}")
    sess = ort.InferenceSession(str(model_path), providers=providers)
    input_name = sess.get_inputs()[0].name

    # Warmup
    first = img_dir / f"{df.iloc[0]['id_code']}.png"
    warm = preprocess(str(first))
    for _ in range(3):
        sess.run(None, {input_name: warm})

    rows = []
    times_ms = []
    errors = []

    for _, r in tqdm(df.iterrows(), total=len(df), desc="inferencia"):
        img_id = r["id_code"]
        gt = int(r["diagnosis"])
        gt_bin = 0 if gt == 0 else 1
        img_path = img_dir / f"{img_id}.png"
        if not img_path.exists():
            errors.append(str(img_path))
            continue
        try:
            tensor = preprocess(str(img_path))
            t0 = time.perf_counter()
            out = sess.run(None, {input_name: tensor})[0]
            dt = (time.perf_counter() - t0) * 1000.0
            times_ms.append(dt)

            dets = parse_end2end(out, args.conf)
            class_counts = {}
            max_lesion_score = 0.0
            n_lesion = 0
            n_anatom = 0
            for ci, sc in dets:
                class_counts[ci] = class_counts.get(ci, 0) + 1
                if ci in ANATOMICAL_CLASSES:
                    n_anatom += 1
                else:
                    n_lesion += 1
                    if sc > max_lesion_score:
                        max_lesion_score = sc
            pred_bin = 1 if n_lesion > 0 else 0

            rows.append({
                "id_code": img_id,
                "gt_grade": gt,
                "gt_binary": gt_bin,
                "pred_binary": pred_bin,
                "max_lesion_score": max_lesion_score,
                "n_detections": len(dets),
                "n_lesion_dets": n_lesion,
                "n_anatomical_dets": n_anatom,
                "class_counts": json.dumps(class_counts),
                "infer_ms": round(dt, 3),
            })
        except Exception as e:
            errors.append(f"{img_id}: {e}")

    if not rows:
        raise RuntimeError("Sin resultados.")

    res = pd.DataFrame(rows)
    res.to_csv(out_dir / "per_image.csv", index=False)

    y_true = res["gt_binary"].values
    y_pred = res["pred_binary"].values
    y_score = res["max_lesion_score"].values

    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    ppv = tp / (tp + fp) if (tp + fp) else 0.0
    npv = tn / (tn + fn) if (tn + fn) else 0.0
    acc = accuracy_score(y_true, y_pred)
    f1 = f1_score(y_true, y_pred, zero_division=0)
    mcc = matthews_corrcoef(y_true, y_pred)
    try:
        auc = roc_auc_score(y_true, y_score)
        fpr, tpr, _ = roc_curve(y_true, y_score)
        roc = {"fpr": fpr.tolist(), "tpr": tpr.tolist()}
    except Exception:
        auc = None
        roc = None

    # Sensibilidad por grado (1..4) y % normales bien clasificados (grado 0)
    per_grade = {}
    for g in [0, 1, 2, 3, 4]:
        sub = res[res["gt_grade"] == g]
        if len(sub) == 0:
            continue
        if g == 0:
            per_grade[str(g)] = {
                "n": int(len(sub)),
                "specificity_correct_normal": float((sub["pred_binary"] == 0).mean()),
            }
        else:
            per_grade[str(g)] = {
                "n": int(len(sub)),
                "sensitivity_detected": float((sub["pred_binary"] == 1).mean()),
            }

    # Tiempos
    arr = np.array(times_ms)
    timing = {
        "n": int(arr.size),
        "mean_ms": float(arr.mean()),
        "median_ms": float(np.median(arr)),
        "std_ms": float(arr.std()),
        "min_ms": float(arr.min()),
        "max_ms": float(arr.max()),
        "p95_ms": float(np.percentile(arr, 95)),
        "p99_ms": float(np.percentile(arr, 99)),
        "fps_mean": float(1000.0 / arr.mean()) if arr.mean() > 0 else None,
    }

    # Distribución de detecciones
    class_freq = {}
    for cc in res["class_counts"]:
        for k, v in json.loads(cc).items():
            class_freq[k] = class_freq.get(k, 0) + v

    metrics = {
        "experiment": "APTOS binary normal-vs-altered (anatomical-only = normal)",
        "model": str(model_path.name),
        "conf_threshold": args.conf,
        "n_images": int(len(res)),
        "n_errors": len(errors),
        "binary_rule": "altered if any detection of class != {0 optic_disc, 2 fovea}",
        "confusion_matrix": {
            "labels": ["normal(0)", "altered(1)"],
            "matrix": cm.tolist(),
            "TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp),
        },
        "metrics": {
            "sensitivity_recall": sens,
            "specificity": spec,
            "ppv_precision": ppv,
            "npv": npv,
            "accuracy": acc,
            "f1": f1,
            "mcc": mcc,
            "auc_roc": auc,
        },
        "per_grade": per_grade,
        "timing_ms": timing,
        "detections_per_class_total": class_freq,
        "providers": providers,
        "timestamp": ts,
    }

    with open(out_dir / "metrics.json", "w") as f:
        json.dump(metrics, f, indent=2)

    if roc:
        with open(out_dir / "roc_curve.json", "w") as f:
            json.dump(roc, f)

    if errors:
        with open(out_dir / "errors.txt", "w") as f:
            f.write("\n".join(errors))

    # Reporte texto legible
    lines = [
        f"APTOS binary experiment — {ts}",
        f"Modelo: {model_path.name}   conf>={args.conf}",
        f"N={len(res)}  (errores={len(errors)})",
        "",
        "Confusion matrix [rows=GT, cols=Pred]  labels=[normal, altered]",
        f"  TN={tn}  FP={fp}",
        f"  FN={fn}  TP={tp}",
        "",
        f"Sensibilidad (recall):  {sens:.4f}",
        f"Especificidad:          {spec:.4f}",
        f"PPV (precision):        {ppv:.4f}",
        f"NPV:                    {npv:.4f}",
        f"Accuracy:               {acc:.4f}",
        f"F1:                     {f1:.4f}",
        f"MCC:                    {mcc:.4f}",
        f"AUC-ROC:                {auc if auc is None else f'{auc:.4f}'}",
        "",
        "Por grado APTOS:",
    ]
    for g, d in per_grade.items():
        lines.append(f"  grado {g}: n={d['n']}  {d}")
    lines += [
        "",
        f"Tiempos (ms): mean={timing['mean_ms']:.2f}  median={timing['median_ms']:.2f}  "
        f"p95={timing['p95_ms']:.2f}  p99={timing['p99_ms']:.2f}  "
        f"min={timing['min_ms']:.2f}  max={timing['max_ms']:.2f}  fps≈{timing['fps_mean']:.2f}",
        "",
        "Detecciones totales por clase:",
    ] + [f"  clase {k}: {v}" for k, v in sorted(class_freq.items(), key=lambda x: int(x[0]))]
    (out_dir / "report.txt").write_text("\n".join(lines))

    print("\n".join(lines))
    print(f"\n[OK] Resultados en: {out_dir}")


if __name__ == "__main__":
    main()
