#!/usr/bin/env python3
"""
APTOS — filtro de área mínima de bounding box × regla de decisión.

Hipótesis: muchos FP de hard_exudate / microhemorrhages son detecciones
pequeñas (ruido / artefactos). Filtrarlas por área mínima debería mejorar
specificity sin sacrificar sensitivity.

Reusa dump de detecciones con bbox si existe; sino corre inferencia.
"""
import argparse
import json
from pathlib import Path
from datetime import datetime
import numpy as np
import pandas as pd
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef)

np.random.seed(42)

INPUT_SIZE = 640
ANATOM = {0, 2}
LESION_CLASSES = [1, 3, 4, 5]
CLASS_NAMES = {0: "optic_disc", 1: "hard_exudate", 2: "fovea",
               3: "hemorrhage", 4: "cotton_wool_spot", 5: "microhemorrhages"}

BASE = Path(__file__).parent
DEFAULT_CACHE = BASE / "results" / "raw_detections_bbox.csv"

REQUIRED_COLS = {"image_id", "class_idx", "score", "x1", "y1", "x2", "y2",
                 "img_w", "img_h"}


def run_inference(model_path: Path, csv_path: Path, img_dir: Path,
                  cache_path: Path, conf_min: float = 0.05) -> pd.DataFrame:
    import cv2, onnxruntime as ort, time
    from tqdm import tqdm

    print(f"[*] Inferencia (no cache) → {cache_path}")
    sess = ort.InferenceSession(str(model_path),
                                providers=ort.get_available_providers())
    inp = sess.get_inputs()[0].name

    df_gt = pd.read_csv(csv_path)
    rows = []
    grade_map = dict(zip(df_gt["id_code"], df_gt["diagnosis"]))

    # warmup
    p0 = img_dir / f"{df_gt.iloc[0]['id_code']}.png"
    img = cv2.imread(str(p0))
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (INPUT_SIZE, INPUT_SIZE)).astype(np.float32) / 255.0
    warm = np.expand_dims(img.transpose(2, 0, 1), 0)
    for _ in range(3):
        sess.run(None, {inp: warm})

    for _, r in tqdm(df_gt.iterrows(), total=len(df_gt)):
        img_id = r["id_code"]
        path = img_dir / f"{img_id}.png"
        if not path.exists():
            continue
        im = cv2.imread(str(path))
        if im is None:
            continue
        h, w = im.shape[:2]
        im_rgb = cv2.cvtColor(im, cv2.COLOR_BGR2RGB)
        im_r = cv2.resize(im_rgb, (INPUT_SIZE, INPUT_SIZE),
                          interpolation=cv2.INTER_LINEAR)
        tensor = np.expand_dims((im_r.astype(np.float32) / 255.0)
                                .transpose(2, 0, 1), 0)
        out = sess.run(None, {inp: tensor})[0].squeeze(0)
        any_det = False
        for i in range(out.shape[0]):
            s = float(out[i, 4])
            if s < conf_min:
                continue
            ci = int(out[i, 5])
            # bboxes en coords input 640×640 → escalo a originales
            x1 = float(out[i, 0]) * (w / INPUT_SIZE)
            y1 = float(out[i, 1]) * (h / INPUT_SIZE)
            x2 = float(out[i, 2]) * (w / INPUT_SIZE)
            y2 = float(out[i, 3]) * (h / INPUT_SIZE)
            rows.append({
                "image_id": img_id, "gt_grade": int(grade_map[img_id]),
                "class_idx": ci, "score": s,
                "x1": x1, "y1": y1, "x2": x2, "y2": y2,
                "img_w": w, "img_h": h,
            })
            any_det = True
        if not any_det:
            rows.append({
                "image_id": img_id, "gt_grade": int(grade_map[img_id]),
                "class_idx": -1, "score": 0.0,
                "x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0,
                "img_w": w, "img_h": h,
            })
    df = pd.DataFrame(rows)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(cache_path, index=False)
    print(f"[*] Saved {len(df)} detections to {cache_path}")
    return df


def metrics(y_true, y_pred):
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
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="detection-v2.0.0.onnx")
    ap.add_argument("--csv", default="aptos_extracted/train.csv")
    ap.add_argument("--images", default="aptos_extracted/train_images")
    ap.add_argument("--cache", default=str(DEFAULT_CACHE))
    ap.add_argument("--output", default="results")
    args = ap.parse_args()

    cache = Path(args.cache)
    if cache.exists():
        df_det = pd.read_csv(cache)
        if REQUIRED_COLS.issubset(df_det.columns):
            print(f"[*] Loaded {len(df_det)} detections from cache — "
                  f"skipping inference.")
        else:
            print(f"[!] Cache {cache} con esquema incompatible — re-infiriendo.")
            df_det = run_inference(BASE / args.model, BASE / args.csv,
                                   BASE / args.images, cache)
    else:
        df_det = run_inference(BASE / args.model, BASE / args.csv,
                               BASE / args.images, cache)

    # Áreas
    df_det["area_px"] = ((df_det["x2"] - df_det["x1"]).clip(lower=0)
                         * (df_det["y2"] - df_det["y1"]).clip(lower=0))
    df_det["area_rel"] = df_det["area_px"] / (df_det["img_w"] * df_det["img_h"])

    # GT por imagen
    gt = (df_det.groupby("image_id")["gt_grade"].first().reset_index())
    gt["gt_binary"] = (gt["gt_grade"] != 0).astype(int)
    n_total = len(gt)
    print(f"[*] N imágenes: {n_total}  patológicos: {int(gt['gt_binary'].sum())}")

    # Solo lesiones (clase ≠ -1, 0, 2)
    is_lesion = (df_det["class_idx"].isin(LESION_CLASSES))
    lesions = df_det[is_lesion].copy()
    print(f"[*] Detecciones de lesión totales: {len(lesions)}")

    # Reglas
    AREAS = [0, 50, 100, 200, 400, 800]
    R1_CONFS = [0.25, 0.40, 0.50, 0.60]
    rules = [("R1_conf>=0.25", 0.25, 1)] + \
            [(f"R1_conf>={c:.2f}", c, 1) for c in R1_CONFS[1:]] + \
            [("R3_conf>=0.40_n>=2", 0.40, 2)]

    # Conteo de eliminaciones por área y clase
    elim_log = {}
    total_per_class = {c: int((lesions["class_idx"] == c).sum())
                       for c in LESION_CLASSES}

    rows = []
    detail = {}

    for area_min in AREAS:
        # Filtrado por área
        valid = lesions[lesions["area_px"] >= area_min].copy()
        elim = {}
        for c in LESION_CLASSES:
            kept = int((valid["class_idx"] == c).sum())
            elim[c] = {
                "name": CLASS_NAMES[c],
                "kept": kept, "total": total_per_class[c],
                "eliminated": total_per_class[c] - kept,
                "elim_pct": (1 - kept / total_per_class[c]) * 100
                            if total_per_class[c] else 0.0,
            }
        elim_log[area_min] = elim

        for rule_name, conf, min_count in rules:
            v = valid[valid["score"] >= conf]
            counts_per_img = v.groupby("image_id").size()
            pred = pd.Series(0, index=gt["image_id"], name="pred")
            altered = counts_per_img[counts_per_img >= min_count].index
            pred.loc[altered] = 1
            merged = gt.merge(pred.reset_index(), on="image_id")
            m = metrics(merged["gt_binary"].values, merged["pred"].values)
            pg = per_grade(merged)
            row = {
                "min_area_px": area_min, "rule": rule_name,
                "conf": conf, "min_count": min_count,
                **{k: m[k] for k in ["sensitivity", "specificity", "ppv",
                                     "npv", "accuracy", "f1", "mcc",
                                     "youden_j", "TP", "FP", "FN", "TN"]},
            }
            for g, d in pg.items():
                k = "spec" if g == 0 else "sens"
                row[f"g{g}_{k}"] = d.get("specificity",
                                         d.get("sensitivity", np.nan))
            rows.append(row)
            detail[(area_min, rule_name)] = {**m, "per_grade": pg}

    summary = pd.DataFrame(rows)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = BASE / args.output / f"aptos_area_filter_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)
    summary.to_csv(out_dir / "area_filter_summary.csv", index=False)

    # ---------- Análisis ----------
    L = [f"APTOS — filtro de área × reglas — {ts}",
         f"N={n_total}   detecciones lesión totales={len(lesions)}",
         "", "═" * 78,
         "TABLA 1 — R3 (conf≥0.40 ∧ N≥2): evolución con MIN_AREA",
         "═" * 78,
         f"{'MIN_AREA':>9s} | {'Sens':>7s} | {'Spec':>7s} | {'PPV':>7s} | "
         f"{'NPV':>7s} | {'Acc':>7s} | {'F1':>7s} | {'MCC':>7s} | {'J':>7s}"]
    for area_min in AREAS:
        r = summary[(summary["min_area_px"] == area_min)
                    & (summary["rule"] == "R3_conf>=0.40_n>=2")].iloc[0]
        L.append(f"{area_min:9d} | {r['sensitivity']:7.4f} | "
                 f"{r['specificity']:7.4f} | {r['ppv']:7.4f} | {r['npv']:7.4f} | "
                 f"{r['accuracy']:7.4f} | {r['f1']:7.4f} | {r['mcc']:7.4f} | "
                 f"{r['youden_j']:7.4f}")

    L += ["", "═" * 78,
          "TABLA 2 — Detecciones eliminadas por filtro de área (lesiones)",
          "═" * 78]
    for area_min in AREAS:
        if area_min == 0:
            continue
        L.append(f"\nMIN_AREA = {area_min} px:")
        for c, d in elim_log[area_min].items():
            L.append(f"  c{c} {d['name']:18s}  eliminadas {d['eliminated']:6d} / "
                     f"{d['total']:6d}  ({d['elim_pct']:5.1f}%)")

    L += ["", "═" * 78,
          "TABLA 3 — Todas las combinaciones (sens, spec, MCC, J)",
          "═" * 78,
          f"{'min_area':>9s} {'rule':22s} {'sens':>7s} {'spec':>7s} "
          f"{'mcc':>7s} {'J':>7s}"]
    for _, r in summary.iterrows():
        L.append(f"{int(r['min_area_px']):9d} {r['rule']:22s} "
                 f"{r['sensitivity']:7.4f} {r['specificity']:7.4f} "
                 f"{r['mcc']:7.4f} {r['youden_j']:7.4f}")

    # Mejor punto: max J con sens >= 0.90
    cand = summary[summary["sensitivity"] >= 0.90].copy()
    if len(cand):
        best = cand.loc[cand["youden_j"].idxmax()].to_dict()
    else:
        best = summary.loc[summary["youden_j"].idxmax()].to_dict()
    L += ["", "═" * 78,
          f"BEST (max Youden J con sens ≥ 0.90):", "═" * 78,
          f"  MIN_AREA = {int(best['min_area_px'])} px",
          f"  Regla    = {best['rule']}",
          f"  Sens={best['sensitivity']:.4f} | Spec={best['specificity']:.4f}"
          f" | PPV={best['ppv']:.4f} | NPV={best['npv']:.4f}",
          f"  MCC={best['mcc']:.4f} | Youden={best['youden_j']:.4f}"
          f" | Acc={best['accuracy']:.4f} | F1={best['f1']:.4f}"]

    with open(out_dir / "best_operating_point.json", "w") as f:
        json.dump({k: (int(v) if isinstance(v, np.integer)
                       else float(v) if isinstance(v, (np.floating, float, int))
                       and not isinstance(v, bool)
                       else v)
                   for k, v in best.items()}, f, indent=2, default=str)

    (out_dir / "area_filter_report.txt").write_text("\n".join(L))
    print("\n".join(L))
    print(f"\nBEST: MIN_AREA={int(best['min_area_px'])} | {best['rule']}")
    print(f"Sens={best['sensitivity']:.3f} | Spec={best['specificity']:.3f} | "
          f"MCC={best['mcc']:.3f} | Youden={best['youden_j']:.3f}")
    print(f"\n[OK] {out_dir}")


if __name__ == "__main__":
    main()
