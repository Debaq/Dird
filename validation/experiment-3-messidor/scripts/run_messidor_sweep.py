#!/usr/bin/env python3
"""
Sub-exp 1 (Messidor) — inferencia ÚNICA + baseline binario OOD.

- Modelo: detection-v2.0.0.onnx (end2end_nms, 6 clases). Pesos SIN reentrenar.
- Una sola pasada de inferencia a umbral bajo (--min-score) -> dump raw_detections.csv
  (formato largo: id_code, gt_grade, class, score) reutilizable por run_messidor_frozen_tau.py.
- Baseline binario: ALTERADA ⇔ ≥1 detección de clase ∉ {0 optic_disc, 2 fovea} con
  score ≥ --conf. Métricas + AUC-ROC (resultado externo libre de umbral).

Espera labels.csv con columnas id_code, diagnosis[, ext] (ver prepare_messidor_dataset.py).
"""
import argparse
import json
import time
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
import pandas as pd
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef, roc_auc_score, roc_curve)
from tqdm import tqdm

INPUT_SIZE = 640
ANATOM = {0, 2}  # optic_disc, fovea -> no patológico
IMG_EXTS = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".JPG", ".JPEG", ".PNG", ".TIF", ".TIFF")


def find_image(img_dir: Path, id_code: str, ext: str | None) -> Path | None:
    if ext:
        p = img_dir / f"{id_code}{ext}"
        if p.exists():
            return p
    for e in IMG_EXTS:
        p = img_dir / f"{id_code}{e}"
        if p.exists():
            return p
    hits = list(img_dir.glob(f"{id_code}.*"))
    return hits[0] if hits else None


def preprocess(path: str) -> np.ndarray:
    img = cv2.imread(path)
    if img is None:
        raise FileNotFoundError(path)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)
    img = img.astype(np.float32) / 255.0
    return np.expand_dims(np.transpose(img, (2, 0, 1)), 0)


def parse_dets(out: np.ndarray, min_score: float):
    data = out.squeeze(0)
    return [(int(data[i, 5]), float(data[i, 4]))
            for i in range(data.shape[0]) if float(data[i, 4]) >= min_score]


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="../models/detection-v2.0.0.onnx")
    ap.add_argument("--csv", default="messidor_extracted/labels.csv")
    ap.add_argument("--images", default="messidor_extracted/images")
    ap.add_argument("--output", default="results")
    ap.add_argument("--conf", type=float, default=0.25, help="umbral baseline binario")
    ap.add_argument("--min-score", type=float, default=0.05, help="umbral del dump crudo")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    base = Path(__file__).parent.parent
    model_path = (base / args.model).resolve()
    csv_path = base / args.csv
    img_dir = base / args.images
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    bin_dir = base / args.output / "01-binary"
    sweep_dir = base / args.output / "02-sweep"
    bin_dir.mkdir(parents=True, exist_ok=True)
    sweep_dir.mkdir(parents=True, exist_ok=True)

    df = pd.read_csv(csv_path)
    if args.limit:
        df = df.head(args.limit)
    has_ext = "ext" in df.columns
    print(f"[*] Modelo: {model_path}\n[*] N={len(df)}  conf={args.conf}  min_score={args.min_score}")

    sess = ort.InferenceSession(str(model_path), providers=ort.get_available_providers())
    inp = sess.get_inputs()[0].name

    first = find_image(img_dir, str(df.iloc[0]["id_code"]),
                       df.iloc[0]["ext"] if has_ext else None)
    if first is None:
        raise SystemExit(f"[ERROR] No encuentro la primera imagen en {img_dir}")
    warm = preprocess(str(first))
    for _ in range(3):
        sess.run(None, {inp: warm})

    raw, flat, times, errors = [], [], [], []
    for r in tqdm(df.itertuples(index=False), total=len(df), desc="inferencia"):
        ext = getattr(r, "ext", None) if has_ext else None
        p = find_image(img_dir, str(r.id_code), ext)
        gt = int(r.diagnosis)
        if p is None:
            errors.append(str(r.id_code))
            continue
        try:
            t = preprocess(str(p))
            t0 = time.perf_counter()
            out = sess.run(None, {inp: t})[0]
            times.append((time.perf_counter() - t0) * 1000)
            dets = parse_dets(out, args.min_score)
        except Exception as e:  # noqa: BLE001
            errors.append(f"{r.id_code}: {e}")
            continue
        raw.append({"id_code": r.id_code, "gt": gt, "dets": dets})
        if not dets:
            flat.append({"id_code": r.id_code, "gt_grade": gt, "class": -1, "score": 0.0})
        else:
            for c, s in dets:
                flat.append({"id_code": r.id_code, "gt_grade": gt, "class": c, "score": s})

    pd.DataFrame(flat).to_csv(sweep_dir / "raw_detections.csv", index=False)

    # ---- baseline binario (any-lesion @ conf) ----
    rows = []
    for x in raw:
        n_les = sum(1 for c, s in x["dets"] if c not in ANATOM and s >= args.conf)
        max_les = max([s for c, s in x["dets"] if c not in ANATOM and s >= args.conf], default=0.0)
        rows.append({"id_code": x["id_code"], "gt_grade": x["gt"],
                     "gt_binary": 0 if x["gt"] == 0 else 1,
                     "pred_binary": 1 if n_les > 0 else 0,
                     "max_lesion_score": max_les, "n_lesion_dets": n_les})
    res = pd.DataFrame(rows)
    res.to_csv(bin_dir / "per_image.csv", index=False)

    y_true, y_pred, y_score = res["gt_binary"].values, res["pred_binary"].values, res["max_lesion_score"].values
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    try:
        auc = float(roc_auc_score(y_true, y_score))
        fpr, tpr, _ = roc_curve(y_true, y_score)
        json.dump({"fpr": fpr.tolist(), "tpr": tpr.tolist()}, open(bin_dir / "roc_curve.json", "w"))
    except Exception:  # noqa: BLE001
        auc = None

    arr = np.array(times) if times else np.array([0.0])
    metrics = {
        "experiment": "Messidor binary OOD (anatomical-only = normal)",
        "model": model_path.name, "conf_threshold": args.conf,
        "n_images": int(len(res)), "n_errors": len(errors),
        "confusion_matrix": {"TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp)},
        "metrics": {
            "sensitivity_recall": sens, "specificity": spec,
            "ppv_precision": tp / (tp + fp) if (tp + fp) else 0.0,
            "npv": tn / (tn + fn) if (tn + fn) else 0.0,
            "accuracy": accuracy_score(y_true, y_pred),
            "f1": f1_score(y_true, y_pred, zero_division=0),
            "mcc": matthews_corrcoef(y_true, y_pred), "auc_roc": auc,
        },
        "timing_ms": {"mean": float(arr.mean()), "median": float(np.median(arr)),
                      "p95": float(np.percentile(arr, 95)), "fps_mean": float(1000 / arr.mean()) if arr.mean() else None},
        "timestamp": ts,
    }
    json.dump(metrics, open(bin_dir / "metrics.json", "w"), indent=2)
    if errors:
        (bin_dir / "errors.txt").write_text("\n".join(errors))

    print(f"\nN={len(res)}  TN={tn} FP={fp} FN={fn} TP={tp}")
    print(f"Sens={sens:.4f}  Spec={spec:.4f}  AUC={auc if auc is None else f'{auc:.4f}'}")
    print(f"[OK] dump -> {sweep_dir/'raw_detections.csv'}   métricas -> {bin_dir/'metrics.json'}")


if __name__ == "__main__":
    main()
