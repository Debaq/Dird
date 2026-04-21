#!/usr/bin/env python3
"""
validate_idrid_e2e.py — Validación IDRiD para modelos YOLO end-to-end (v10/v11/v26+).

Salida ONNX esperada: [1, N, 6] con filas [x1, y1, x2, y2, score, class_id]
ya post-NMS (formato Ultralytics export nativo de YOLO moderno).

Reusa GT loading, matching y métricas de validate_idrid.py / validate_dird.py.

Uso:
    python validate_idrid_e2e.py \
        --model best.onnx \
        --dataset datasets/idrid/full \
        --output results/idrid-full-best \
        --classes-json best-metadata.json \
        --conf-threshold 0.1 --iou-threshold 0.1 --benchmark
"""

import argparse
import json
import os
import time
from pathlib import Path

import cv2
import matplotlib.pyplot as plt
import numpy as np
import onnxruntime as ort
from tqdm import tqdm
import pandas as pd

from validate_dird import _load_classes, benchmark_inference, load_and_preprocess
from validate_idrid import (
    CLASS_DISPLAY_NAMES,
    CLASS_MAPPING,
    compute_class_ap,
    load_idrid_gt,
    match_detections,
    normalize_class_name,
)

INPUT_SIZE = 640


def decode_e2e(
    output: np.ndarray,
    classes: list[str],
    orig_w: int,
    orig_h: int,
    conf_threshold: float,
) -> list[dict]:
    """Decodifica [1, N, 6] → lista de detecciones escaladas a imagen original."""
    dets = output[0] if output.ndim == 3 else output
    sx = orig_w / float(INPUT_SIZE)
    sy = orig_h / float(INPUT_SIZE)

    result = []
    for row in dets:
        score = float(row[4])
        if score < conf_threshold:
            continue
        cls_id = int(row[5])
        if cls_id < 0 or cls_id >= len(classes):
            continue
        x1 = float(row[0]) * sx
        y1 = float(row[1]) * sy
        x2 = float(row[2]) * sx
        y2 = float(row[3]) * sy
        if x2 <= x1 or y2 <= y1:
            continue
        result.append({
            "bbox": np.array([x1, y1, x2, y2], dtype=np.float64),
            "confidence": score,
            "class": classes[cls_id],
        })
    return result


def evaluate_dataset(
    session: ort.InferenceSession,
    input_name: str,
    classes: list[str],
    dataset_dir: str,
    conf_threshold: float,
    iou_threshold: float,
) -> dict:
    images_dir = os.path.join(dataset_dir, "images")

    print("Cargando ground truth IDRiD...")
    gt = load_idrid_gt(dataset_dir)
    print(f"  {len(gt)} imágenes con ground truth")

    eval_classes = list(CLASS_MAPPING.keys())
    class_preds: dict[str, list[dict]] = {c: [] for c in eval_classes}
    class_total_gt: dict[str, int] = {c: 0 for c in eval_classes}

    per_image_results = []
    inference_times = []

    for stem in tqdm(sorted(gt.keys()), desc="Evaluando IDRiD"):
        img_path = None
        for ext in (".jpg", ".jpeg", ".png", ".tif"):
            candidate = os.path.join(images_dir, f"{stem}{ext}")
            if os.path.exists(candidate):
                img_path = candidate
                break
        if img_path is None:
            print(f"  WARN: imagen no encontrada para {stem}")
            continue

        try:
            tensor, orig_w, orig_h = load_and_preprocess(img_path)
        except Exception as e:
            print(f"  WARN: error preprocesando {stem}: {e}")
            continue

        t0 = time.perf_counter()
        outputs = session.run(None, {input_name: tensor})
        t1 = time.perf_counter()
        inference_times.append(t1 - t0)

        detections = decode_e2e(outputs[0], classes, orig_w, orig_h, conf_threshold)

        image_row = {"image": stem}
        for model_class in eval_classes:
            gt_boxes = gt[stem].get(model_class, [])
            class_total_gt[model_class] += len(gt_boxes)

            pred_dets = sorted(
                [d for d in detections if normalize_class_name(d["class"]) == model_class],
                key=lambda d: d["confidence"],
                reverse=True,
            )

            matches, num_fn = match_detections(pred_dets, gt_boxes, iou_threshold)
            tp = sum(matches)
            fp = len(matches) - tp

            for det, is_tp in zip(pred_dets, matches):
                class_preds[model_class].append({
                    "confidence": det["confidence"],
                    "is_tp": is_tp,
                })

            image_row[f"{model_class}_tp"] = tp
            image_row[f"{model_class}_fp"] = fp
            image_row[f"{model_class}_fn"] = num_fn

        per_image_results.append(image_row)

    ap_results = {}
    pr_curves = {}
    for model_class in eval_classes:
        ap, best_f1, best_f1_thresh, precs, recs = compute_class_ap(
            class_preds[model_class],
            class_total_gt[model_class],
        )
        ap_results[model_class] = {
            "ap": round(ap, 4),
            "best_f1": round(best_f1, 4),
            "best_f1_threshold": round(best_f1_thresh, 4),
            "gt_boxes": class_total_gt[model_class],
            "pred_boxes": len(class_preds[model_class]),
        }
        pr_curves[model_class] = (precs, recs)

    ap_values = [v["ap"] for v in ap_results.values()]
    mAP = round(float(np.mean(ap_values)), 4) if ap_values else 0.0

    return {
        "ap_results": ap_results,
        "mAP": mAP,
        "pr_curves": pr_curves,
        "per_image_results": per_image_results,
        "inference_times": np.array(inference_times),
        "eval_classes": eval_classes,
    }


def save_results(eval_data, benchmark_data, output_dir, conf_threshold, iou_threshold):
    os.makedirs(output_dir, exist_ok=True)
    ap_results = eval_data["ap_results"]
    mAP = eval_data["mAP"]
    eval_classes = eval_data["eval_classes"]

    metrics = {
        "mAP": mAP,
        "per_class": ap_results,
        "parameters": {
            "conf_threshold": conf_threshold,
            "iou_threshold_matching": iou_threshold,
            "dataset": "IDRiD test set",
            "ap_method": "PASCAL VOC 11-point interpolation",
            "postprocess": "YOLO end-to-end (NMS integrado en ONNX)",
        },
    }
    if benchmark_data:
        metrics["benchmark"] = benchmark_data
    with open(os.path.join(output_dir, "metrics_ap.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    pr_curves = eval_data["pr_curves"]
    colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"]
    fig, ax = plt.subplots(figsize=(8, 6), dpi=300, facecolor="white")
    for idx, mc in enumerate(eval_classes):
        precs, recs = pr_curves[mc]
        if len(precs) == 0:
            continue
        display = CLASS_DISPLAY_NAMES.get(mc, mc)
        ax.plot(recs, precs, color=colors[idx % len(colors)], lw=2,
                label=f"{display} (AP={ap_results[mc]['ap']:.3f})")
    ax.set_xlabel("Recall"); ax.set_ylabel("Precision")
    ax.set_title(f"PR Curves — IDRiD (mAP={mAP:.3f}) [YOLO e2e]")
    ax.legend(loc="lower left", fontsize=9)
    ax.set_xlim([-0.02, 1.02]); ax.set_ylim([-0.02, 1.02])
    ax.grid(True, alpha=0.3); fig.tight_layout()
    fig.savefig(os.path.join(output_dir, "pr_curves.png"), dpi=300, facecolor="white")
    plt.close(fig)

    pd.DataFrame(eval_data["per_image_results"]).to_csv(
        os.path.join(output_dir, "results_per_image.csv"), index=False
    )

    sep = "-" * 62
    lines = [
        "=" * 62,
        "DIRD+ Validation Report — IDRiD (YOLO end-to-end)",
        "=" * 62, "",
        f"Total images:         {len(eval_data['per_image_results'])}",
        f"Conf threshold:       {conf_threshold}",
        f"IoU threshold (match):{iou_threshold}",
        "Postproceso:          YOLO e2e (NMS integrado)",
        "AP method:            PASCAL VOC 11-point", "",
        f"{'Class':<20} | {'AP':>6} | {'GT boxes':>8} | {'Pred boxes':>10} | {'Best F1':>7}",
        sep,
    ]
    for mc in eval_classes:
        r = ap_results[mc]
        display = CLASS_DISPLAY_NAMES.get(mc, mc)
        lines.append(f"{display:<20} | {r['ap']:>6.3f} | {r['gt_boxes']:>8d} | {r['pred_boxes']:>10d} | {r['best_f1']:>7.3f}")
    lines.append(sep)
    lines.append(f"{'mAP':<20} | {mAP:>6.3f} |          |            |")

    inf_times = eval_data["inference_times"]
    if len(inf_times):
        lines += ["", "--- Inference Performance ---",
                  f"Mean time:            {np.mean(inf_times):.4f} s",
                  f"Std time:             {np.std(inf_times):.4f} s",
                  f"Images/second:        {1.0/np.mean(inf_times):.1f}"]
    if benchmark_data:
        lines += ["", "--- Dedicated Benchmark ---",
                  f"Mean:                 {benchmark_data['mean_seconds']:.4f} s",
                  f"Median:               {benchmark_data['median_seconds']:.4f} s",
                  f"Images/second:        {benchmark_data['images_per_second']:.1f}",
                  f"Total images:         {benchmark_data['total_images']}"]
    lines += ["", "=" * 62]
    report = "\n".join(lines)
    with open(os.path.join(output_dir, "validation_report.txt"), "w") as f:
        f.write(report)
    return report


def main():
    p = argparse.ArgumentParser(description="Validación IDRiD para YOLO end-to-end ONNX.")
    p.add_argument("--model", required=True)
    p.add_argument("--dataset", required=True)
    p.add_argument("--output", required=True)
    p.add_argument("--conf-threshold", type=float, default=0.1)
    p.add_argument("--iou-threshold", type=float, default=0.5)
    p.add_argument("--classes-json", default=None)
    p.add_argument("--benchmark", action="store_true")
    p.add_argument("--n-benchmark", type=int, default=100)
    args = p.parse_args()

    classes = _load_classes(args.classes_json)
    print(f"Modelo:             {args.model}")
    print(f"Dataset:            {args.dataset}")
    print(f"Clases ({len(classes)}):      {classes}")
    print(f"Conf threshold:     {args.conf_threshold}")
    print(f"IoU threshold:      {args.iou_threshold} (matching)\n")

    images_dir = os.path.join(args.dataset, "images")
    masks_dir = os.path.join(args.dataset, "masks")
    if not os.path.isdir(images_dir):
        print(f"ERROR: no se encontró {images_dir}"); return
    if not os.path.isdir(masks_dir):
        print(f"ERROR: no se encontró {masks_dir}"); return

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(args.model, sess_options=opts, providers=["CPUExecutionProvider"])
    input_name = session.get_inputs()[0].name
    print(f"Input name:         {input_name}")
    print(f"Input shape:        {session.get_inputs()[0].shape}")
    out_shape = session.get_outputs()[0].shape
    print(f"Output shape:       {out_shape}")
    if not (len(out_shape) == 3 and out_shape[-1] == 6):
        print("WARN: shape no parece YOLO end-to-end [1,N,6]. Continuando igualmente.")
    print()

    print("=== Evaluación IDRiD ===")
    eval_data = evaluate_dataset(session, input_name, classes, args.dataset,
                                 args.conf_threshold, args.iou_threshold)

    bench = None
    if args.benchmark:
        print("\n=== Benchmark de inferencia ===")
        bench = benchmark_inference(session, input_name, images_dir, args.n_benchmark)

    report = save_results(eval_data, bench, args.output, args.conf_threshold, args.iou_threshold)
    print("\n" + report)
    print(f"\nResultados guardados en: {args.output}/")


if __name__ == "__main__":
    main()
