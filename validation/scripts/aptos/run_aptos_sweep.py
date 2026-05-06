#!/usr/bin/env python3
"""
Barrido APTOS — corre inferencia UNA vez (dump de todas las detecciones por imagen)
y luego evalúa múltiples reglas de decisión binaria sin re-inferir:

  R1) ALTERADO si exists detección lesión (clase ∉ {0,2}) con score >= conf_thr
       para conf_thr in {0.25, 0.30, 0.40, 0.50, 0.60, 0.70}
  R2) ALTERADO si #lesion_dets (score>=0.25) >= K  para K in {1,2,3,5}
  R3) Combinada: conf>=0.40 AND #lesions>=2

Salida: results/aptos_sweep_<ts>/
"""
import argparse, json, os, time
from datetime import datetime
from pathlib import Path

import cv2, numpy as np, onnxruntime as ort, pandas as pd
from sklearn.metrics import (accuracy_score, confusion_matrix, f1_score,
                             matthews_corrcoef, roc_auc_score)
from tqdm import tqdm

INPUT = 640
ANATOM = {0, 2}


def preprocess(p):
    img = cv2.imread(p)
    img = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
    img = cv2.resize(img, (INPUT, INPUT), interpolation=cv2.INTER_LINEAR)
    img = (img.astype(np.float32) / 255.0).transpose(2, 0, 1)
    return np.expand_dims(img, 0)


def parse_dets(out, min_score=0.05):
    data = out.squeeze(0)
    res = []
    for i in range(data.shape[0]):
        s = float(data[i, 4])
        if s < min_score:
            continue
        res.append((int(data[i, 5]), s))
    return res


def metrics_for(y_true, y_pred, y_score=None):
    cm = confusion_matrix(y_true, y_pred, labels=[0, 1])
    tn, fp, fn, tp = cm.ravel()
    sens = tp / (tp + fn) if (tp + fn) else 0.0
    spec = tn / (tn + fp) if (tn + fp) else 0.0
    ppv = tp / (tp + fp) if (tp + fp) else 0.0
    npv = tn / (tn + fn) if (tn + fn) else 0.0
    out = {
        "TN": int(tn), "FP": int(fp), "FN": int(fn), "TP": int(tp),
        "sensitivity": sens, "specificity": spec,
        "ppv": ppv, "npv": npv,
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


def per_grade(df, gt_col="gt_grade", pred_col="pred"):
    out = {}
    for g in [0, 1, 2, 3, 4]:
        sub = df[df[gt_col] == g]
        if not len(sub):
            continue
        if g == 0:
            out[str(g)] = {"n": int(len(sub)),
                           "specificity": float((sub[pred_col] == 0).mean())}
        else:
            out[str(g)] = {"n": int(len(sub)),
                           "sensitivity": float((sub[pred_col] == 1).mean())}
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", default="detection-v2.0.0.onnx")
    ap.add_argument("--csv", default="aptos_extracted/train.csv")
    ap.add_argument("--images", default="aptos_extracted/train_images")
    ap.add_argument("--output", default="results")
    ap.add_argument("--min-score", type=float, default=0.05,
                    help="score mínimo para guardar detección (debajo de cualquier conf evaluado)")
    ap.add_argument("--limit", type=int, default=0)
    args = ap.parse_args()

    base = Path(__file__).parent
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    out_dir = base / args.output / f"aptos_sweep_{ts}"
    out_dir.mkdir(parents=True, exist_ok=True)
    img_dir = base / args.images
    df = pd.read_csv(base / args.csv)
    if args.limit:
        df = df.head(args.limit)

    sess = ort.InferenceSession(str(base / args.model),
                                providers=ort.get_available_providers())
    inp = sess.get_inputs()[0].name

    warm = preprocess(str(img_dir / f"{df.iloc[0]['id_code']}.png"))
    for _ in range(3):
        sess.run(None, {inp: warm})

    raw = []  # all detections, low threshold
    times = []
    print(f"[*] Inferencia única N={len(df)}")
    for _, r in tqdm(df.iterrows(), total=len(df)):
        p = img_dir / f"{r['id_code']}.png"
        if not p.exists():
            continue
        t = preprocess(str(p))
        t0 = time.perf_counter()
        out = sess.run(None, {inp: t})[0]
        times.append((time.perf_counter() - t0) * 1000)
        dets = parse_dets(out, args.min_score)
        raw.append({
            "id_code": r["id_code"],
            "gt_grade": int(r["diagnosis"]),
            "gt_binary": 0 if int(r["diagnosis"]) == 0 else 1,
            "dets": dets,
        })

    # Persist raw detections
    flat = []
    for x in raw:
        if not x["dets"]:
            flat.append({"id_code": x["id_code"], "gt_grade": x["gt_grade"],
                         "class": -1, "score": 0.0})
        else:
            for c, s in x["dets"]:
                flat.append({"id_code": x["id_code"], "gt_grade": x["gt_grade"],
                             "class": c, "score": s})
    pd.DataFrame(flat).to_csv(out_dir / "raw_detections.csv", index=False)

    arr = np.array(times)
    timing = {
        "n": int(arr.size),
        "mean_ms": float(arr.mean()), "median_ms": float(np.median(arr)),
        "std_ms": float(arr.std()), "p95_ms": float(np.percentile(arr, 95)),
        "p99_ms": float(np.percentile(arr, 99)),
        "min_ms": float(arr.min()), "max_ms": float(arr.max()),
        "fps_mean": float(1000 / arr.mean()),
    }

    # ---------- Evaluación de reglas ----------
    rules = []

    def eval_rule(name, predict_fn, score_fn=None):
        rows = []
        for x in raw:
            pred = predict_fn(x["dets"])
            score = score_fn(x["dets"]) if score_fn else (1.0 if pred else 0.0)
            rows.append({"id_code": x["id_code"], "gt_grade": x["gt_grade"],
                         "gt_binary": x["gt_binary"], "pred": int(pred),
                         "score": score})
        d = pd.DataFrame(rows)
        m = metrics_for(d["gt_binary"].values, d["pred"].values, d["score"].values)
        m["rule"] = name
        m["per_grade"] = per_grade(d)
        rules.append(m)

    def lesion_max(dets, thr):
        return max((s for c, s in dets if c not in ANATOM and s >= thr),
                   default=0.0)

    def n_lesions(dets, thr=0.25):
        return sum(1 for c, s in dets if c not in ANATOM and s >= thr)

    # R1: barrido de conf
    for thr in [0.25, 0.30, 0.40, 0.50, 0.60, 0.70]:
        eval_rule(
            f"R1_any_lesion_conf>={thr:.2f}",
            predict_fn=lambda d, t=thr: any(c not in ANATOM and s >= t for c, s in d),
            score_fn=lambda d, t=thr: lesion_max(d, t),
        )

    # R2: ≥K lesiones (conf 0.25 fijo)
    for k in [1, 2, 3, 5]:
        eval_rule(
            f"R2_n_lesions>={k}_conf>=0.25",
            predict_fn=lambda d, kk=k: n_lesions(d, 0.25) >= kk,
            score_fn=lambda d: float(n_lesions(d, 0.25)),
        )

    # R3: combinada
    eval_rule(
        "R3_conf>=0.40_and_n>=2",
        predict_fn=lambda d: (sum(1 for c, s in d if c not in ANATOM and s >= 0.40) >= 2),
        score_fn=lambda d: lesion_max(d, 0.40),
    )

    # ---------- Salida ----------
    summary_df = pd.DataFrame([{k: v for k, v in r.items() if k != "per_grade"}
                                for r in rules])
    cols = ["rule", "sensitivity", "specificity", "ppv", "npv", "accuracy",
            "f1", "mcc", "youden_j", "auc_roc", "TP", "FP", "FN", "TN"]
    summary_df = summary_df[cols]
    summary_df.to_csv(out_dir / "rules_summary.csv", index=False)

    with open(out_dir / "rules_full.json", "w") as f:
        json.dump({"timing_ms": timing, "rules": rules}, f, indent=2)

    # Reporte texto
    lines = [f"APTOS sweep — {ts}", f"N={len(raw)}", "",
             f"Tiempo: mean={timing['mean_ms']:.2f}ms  median={timing['median_ms']:.2f}ms  "
             f"p95={timing['p95_ms']:.2f}ms  p99={timing['p99_ms']:.2f}ms  fps≈{timing['fps_mean']:.2f}",
             "", "Reglas:",
             f"{'rule':40s} {'sens':>6s} {'spec':>6s} {'ppv':>6s} {'npv':>6s} "
             f"{'acc':>6s} {'f1':>6s} {'mcc':>6s} {'J':>6s} {'AUC':>6s}"]
    for r in rules:
        lines.append(f"{r['rule']:40s} "
                     f"{r['sensitivity']:6.4f} {r['specificity']:6.4f} "
                     f"{r['ppv']:6.4f} {r['npv']:6.4f} {r['accuracy']:6.4f} "
                     f"{r['f1']:6.4f} {r['mcc']:6.4f} {r['youden_j']:6.4f} "
                     f"{r['auc_roc'] if r['auc_roc'] else 0:6.4f}")
    lines.append("")
    lines.append("Detalle por grado (sens grados 1-4 / spec grado 0):")
    for r in rules:
        lines.append(f"  {r['rule']}")
        for g, d in r["per_grade"].items():
            k = "spec" if g == "0" else "sens"
            lines.append(f"    grado {g} (n={d['n']:4d}): {k}={d.get('specificity', d.get('sensitivity')):.4f}")
    (out_dir / "report.txt").write_text("\n".join(lines))
    print("\n".join(lines))
    print(f"\n[OK] {out_dir}")


if __name__ == "__main__":
    main()
