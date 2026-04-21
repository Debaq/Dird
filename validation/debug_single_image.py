#!/usr/bin/env python3
"""debug_single_image.py — Diagnóstico de scores crudos del modelo ONNX sobre 1 imagen.

Uso:
    python debug_single_image.py \
        --model best_7.onnx \
        --image ruta/imagen.jpg \
        --classes-json best-metadata.json
"""

import argparse

import numpy as np
import onnxruntime as ort

from validate_dird import _load_classes, load_and_preprocess


def main():
    parser = argparse.ArgumentParser(description="Debug scores crudos ONNX sobre 1 imagen.")
    parser.add_argument("--model", required=True)
    parser.add_argument("--image", required=True)
    parser.add_argument("--classes-json", default=None)
    args = parser.parse_args()

    classes = _load_classes(args.classes_json)
    print(f"Clases del modelo ({len(classes)}): {classes}\n")

    tensor, orig_w, orig_h = load_and_preprocess(args.image)
    print(f"Imagen:             {args.image}")
    print(f"Shape original:     {orig_w} x {orig_h}")
    print(f"Tensor preprocessed: shape={tensor.shape}, dtype={tensor.dtype}, "
          f"min={tensor.min():.4f}, max={tensor.max():.4f}, mean={tensor.mean():.4f}\n")

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    session = ort.InferenceSession(args.model, sess_options=opts, providers=["CPUExecutionProvider"])

    input_name = session.get_inputs()[0].name
    outputs = session.run(None, {input_name: tensor})
    out = outputs[0]

    print("=== Tensor RAW de salida ===")
    print(f"Shape:  {out.shape}")
    print(f"Dtype:  {out.dtype}")
    print(f"Min:    {out.min():.6f}")
    print(f"Max:    {out.max():.6f}")
    print(f"Mean:   {out.mean():.6f}")
    print()

    data = out.squeeze(0)
    num_classes = len(classes)
    expected_channels = 4 + num_classes

    # Detectar formato de salida
    if data.ndim == 2 and data.shape[1] == 6:
        # Formato end2end/NMS incluido: [D, 6] = [x1, y1, x2, y2, score, class_idx]
        fmt = "end2end_6"
        num_detections = data.shape[0]
    elif data.shape[0] == expected_channels:
        fmt = "yolo_[4+N,D]"
        num_detections = data.shape[1]
    elif data.shape[-1] == expected_channels:
        fmt = "yolo_[D,4+N]"
        num_detections = data.shape[0]
    else:
        fmt = "UNKNOWN"
        num_detections = data.shape[0]

    print(f"Formato detectado:  {fmt}")
    print(f"Num detecciones D:  {num_detections}")
    print(f"Canales esperados YOLO raw: {expected_channels} (4 bbox + {num_classes} clases)\n")

    if fmt == "end2end_6":
        # Score + class_idx ya resuelto por el modelo (NMS incluido)
        print("=== Formato end2end: [x1, y1, x2, y2, score, class_idx] ===")
        print("Modelo ya aplicó NMS internamente. NO hay vector de scores por clase.\n")

        scores_col = data[:, 4]
        class_idx_col = data[:, 5].astype(int)

        print(f"Score range: min={scores_col.min():.4f}, max={scores_col.max():.4f}")
        print(f"Class idx range: min={class_idx_col.min()}, max={class_idx_col.max()}\n")

        thresholds = [0.5, 0.3, 0.1, 0.05, 0.01]
        print("=== Conteos por clase ===")
        header = f"{'idx':<4} {'Clase':<20}" + "".join(f" > {t:<6}" for t in thresholds) + "  max_score"
        print(header)
        print("-" * len(header))
        for ci in range(max(num_classes, int(class_idx_col.max()) + 1 if len(class_idx_col) else 0)):
            mask = class_idx_col == ci
            name = classes[ci] if ci < num_classes else f"UNK_{ci}"
            row = f"{ci:<4} {name:<20}"
            for t in thresholds:
                n = int(((scores_col > t) & mask).sum())
                row += f" {n:<8}"
            if mask.any():
                row += f"  {float(scores_col[mask].max()):.4f}"
            else:
                row += "  N/A"
            print(row)
        print()

        print("=== Top-20 detecciones por score ===")
        top_idx = np.argsort(scores_col)[::-1][:20]
        print(f"{'#':<4} {'det_idx':<8} {'class_idx':<10} {'class':<20} {'score':<10} {'bbox':<30}")
        print("-" * 90)
        for rank, di in enumerate(top_idx, 1):
            ci = int(class_idx_col[di])
            sc = float(scores_col[di])
            name = classes[ci] if ci < num_classes else f"UNK_{ci}"
            bbox = data[di, 0:4]
            print(f"{rank:<4} {di:<8} {ci:<10} {name:<20} {sc:<10.4f} "
                  f"[{bbox[0]:.1f},{bbox[1]:.1f},{bbox[2]:.1f},{bbox[3]:.1f}]")
        return

    is_transposed = fmt == "yolo_[D,4+N]"
    all_scores = np.zeros((num_detections, num_classes), dtype=np.float32)
    for i in range(num_detections):
        if is_transposed:
            all_scores[i] = data[i, 4 : 4 + num_classes]
        else:
            all_scores[i] = data[4 : 4 + num_classes, i]

    max_idx_per_det = np.argmax(all_scores, axis=1)
    max_score_per_det = all_scores[np.arange(num_detections), max_idx_per_det]

    thresholds = [0.5, 0.3, 0.1, 0.05, 0.01]
    print("=== Conteos por clase (como argmax winner) ===")
    header = f"{'Clase':<20}" + "".join(f" > {t:<6}" for t in thresholds) + "  max_score_winner"
    print(header)
    print("-" * len(header))
    for ci, cname in enumerate(classes):
        mask = max_idx_per_det == ci
        row = f"{cname:<20}"
        for t in thresholds:
            n = int(((max_score_per_det > t) & mask).sum())
            row += f" {n:<8}"
        if mask.any():
            row += f"  {float(max_score_per_det[mask].max()):.4f}"
        else:
            row += "  N/A"
        print(row)
    print()

    print("=== Score MAX por clase (sin importar argmax) ===")
    print(f"{'Clase':<20} {'max_score':<12} {'count > 0.01':<14} {'count > 0.1':<12}")
    print("-" * 60)
    for ci, cname in enumerate(classes):
        col = all_scores[:, ci]
        cnt_001 = int((col > 0.01).sum())
        cnt_01 = int((col > 0.1).sum())
        print(f"{cname:<20} {float(col.max()):<12.4f} {cnt_001:<14} {cnt_01:<12}")
    print()

    print("=== Top-20 detecciones por score ===")
    top_idx = np.argsort(max_score_per_det)[::-1][:20]
    print(f"{'#':<4} {'det_idx':<8} {'class':<20} {'score':<10}")
    print("-" * 50)
    for rank, di in enumerate(top_idx, 1):
        ci = int(max_idx_per_det[di])
        sc = float(max_score_per_det[di])
        print(f"{rank:<4} {di:<8} {classes[ci]:<20} {sc:<10.4f}")


if __name__ == "__main__":
    main()
