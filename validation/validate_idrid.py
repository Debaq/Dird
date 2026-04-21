#!/usr/bin/env python3
"""
validate_idrid.py — Validación de detección ONNX de DIRD+ sobre IDRiD (test set).

Evalúa el modelo de detección de lesiones retinales sobre el dataset IDRiD
usando métricas estándar de detección de objetos (AP, mAP) con protocolo
PASCAL VOC (IoU ≥ 0.5, interpolación 11 puntos).

Uso:
    python validate_idrid.py \
        --model path/to/model.onnx \
        --dataset path/to/idrid/test/ \
        --output path/to/results/ \
        --conf-threshold 0.5 \
        --iou-threshold 0.5 \
        --classes-json path/to/classes.json \
        --benchmark
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
import pandas as pd
from tqdm import tqdm

from validate_dird import (
    _calculate_iou,
    _load_classes,
    apply_nms,
    benchmark_inference,
    load_and_preprocess,
)

# ---------------------------------------------------------------------------
# 1. Configuración
# ---------------------------------------------------------------------------

# Mapeo: clase del modelo → (subcarpeta de masks, sufijo del archivo)
CLASS_MAPPING = {
    "microaneurysm":  ("1. Microaneurysms", "MA"),
    "hemorrhage":     ("2. Haemorrhages",   "HE"),
    "hard_exudate":   ("3. Hard Exudates",  "EX"),
    "soft_exudate":   ("4. Soft Exudates",  "SE"),
    "optic_disc":     ("5. Optic Disc",     "OD"),
}

# Nombres legibles para la tabla de resultados
CLASS_DISPLAY_NAMES = {
    "microaneurysm": "Microaneurysms",
    "hemorrhage":    "Hemorrhages",
    "hard_exudate":  "Hard exudates",
    "soft_exudate":  "Soft exudates",
    "optic_disc":    "Optic disc",
}

# Área mínima de componente conectado para filtrar ruido (píxeles)
MIN_COMPONENT_AREA = 10

# Normalización de nombres de clase del modelo (sinónimos → nombre canónico)
CLASS_NORMALIZE = {
    "microaneurysms":    "microaneurysm",
    "microhemorrhages":  "microaneurysm",
    "microaneurysm":     "microaneurysm",
    "hemorrhages":       "hemorrhage",
    "haemorrhage":       "hemorrhage",
    "haemorrhages":      "hemorrhage",
    "hard_exudates":     "hard_exudate",
    "soft_exudates":     "soft_exudate",
    "cotton_wool_spot":  "soft_exudate",
    "cotton_wool_spots": "soft_exudate",
    "optic_disk":        "optic_disc",
    "optic_disc":        "optic_disc",
    "fovea":             "fovea",
}


def normalize_class_name(name: str) -> str:
    return CLASS_NORMALIZE.get(name, name)

# Umbral IoU de NMS del modelo (fijo)
NMS_IOU_THRESHOLD = 0.45


# ---------------------------------------------------------------------------
# 2. Conversión máscara → bounding boxes
# ---------------------------------------------------------------------------

def mask_to_bboxes(mask_path: str) -> list[np.ndarray]:
    """Carga máscara TIF y extrae bboxes de componentes conectados.

    Args:
        mask_path: Ruta al archivo TIF de máscara.

    Returns:
        Lista de arrays [x1, y1, x2, y2] en coordenadas de píxel.
        Retorna [] si la máscara no existe (clase ausente en esa imagen).
    """
    if not os.path.exists(mask_path):
        return []

    mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
    if mask is None:
        return []

    # Binarizar: píxel > 0 = lesión
    _, binary = cv2.threshold(mask, 0, 255, cv2.THRESH_BINARY)

    num_labels, labels, stats, _ = cv2.connectedComponentsWithStats(
        binary, connectivity=8
    )

    bboxes = []
    # Label 0 = background, empezar desde 1
    for i in range(1, num_labels):
        area = stats[i, cv2.CC_STAT_AREA]
        if area < MIN_COMPONENT_AREA:
            continue

        x1 = stats[i, cv2.CC_STAT_LEFT]
        y1 = stats[i, cv2.CC_STAT_TOP]
        w = stats[i, cv2.CC_STAT_WIDTH]
        h = stats[i, cv2.CC_STAT_HEIGHT]
        x2 = x1 + w
        y2 = y1 + h

        bboxes.append(np.array([x1, y1, x2, y2], dtype=np.float64))

    return bboxes


# ---------------------------------------------------------------------------
# 3. Carga del dataset
# ---------------------------------------------------------------------------

def load_idrid_gt(
    dataset_dir: str,
) -> dict[str, dict[str, list[np.ndarray]]]:
    """Carga ground truth del test set IDRiD.

    Args:
        dataset_dir: Ruta al directorio test/ de IDRiD (contiene images/ y masks/).

    Returns:
        Dict {image_stem: {model_class: [bboxes]}}
        Ejemplo: {"IDRiD_54": {"microaneurysm": [array([x1,y1,x2,y2]), ...], ...}}
    """
    images_dir = os.path.join(dataset_dir, "images")
    masks_dir = os.path.join(dataset_dir, "masks")

    image_files = sorted(
        f for f in os.listdir(images_dir)
        if f.lower().endswith((".jpg", ".jpeg", ".png", ".tif"))
    )

    gt = {}
    for img_file in image_files:
        stem = Path(img_file).stem  # e.g. "IDRiD_54"
        gt[stem] = {}

        for model_class, (mask_folder, suffix) in CLASS_MAPPING.items():
            mask_path = os.path.join(
                masks_dir, mask_folder, f"{stem}_{suffix}.tif"
            )
            gt[stem][model_class] = mask_to_bboxes(mask_path)

    return gt


# ---------------------------------------------------------------------------
# 4. Cálculo de AP (Average Precision)
# ---------------------------------------------------------------------------

def match_detections(
    pred_boxes: list[dict],
    gt_boxes: list[np.ndarray],
    iou_threshold: float,
) -> tuple[list[bool], int]:
    """Matching greedy entre predicciones y GT para una imagen y clase.

    Args:
        pred_boxes: Lista de dicts con 'bbox' y 'confidence', ordenados por
                    confianza descendente.
        gt_boxes: Lista de arrays [x1, y1, x2, y2] del ground truth.
        iou_threshold: Umbral mínimo de IoU para considerar un match.

    Returns:
        Tupla (matches, num_fn) donde matches es lista de bool (TP/FP por
        cada predicción) y num_fn es la cantidad de GT no asignados.
    """
    matches = []
    assigned_gt = set()

    for pred in pred_boxes:
        best_iou = 0.0
        best_gt_idx = -1

        for gt_idx, gt_box in enumerate(gt_boxes):
            if gt_idx in assigned_gt:
                continue
            iou = _calculate_iou(pred["bbox"], gt_box)
            if iou > best_iou:
                best_iou = iou
                best_gt_idx = gt_idx

        if best_iou >= iou_threshold and best_gt_idx >= 0:
            matches.append(True)  # TP
            assigned_gt.add(best_gt_idx)
        else:
            matches.append(False)  # FP

    num_fn = len(gt_boxes) - len(assigned_gt)
    return matches, num_fn


def compute_ap_11point(precisions: np.ndarray, recalls: np.ndarray) -> float:
    """Calcula Average Precision con interpolación de 11 puntos (PASCAL VOC).

    Args:
        precisions: Array de precision en cada punto de operación.
        recalls: Array de recall en cada punto de operación.

    Returns:
        AP como float en [0, 1].
    """
    ap = 0.0
    for t in np.linspace(0, 1, 11):
        # Precision interpolada: max precision con recall >= t
        mask = recalls >= t
        if mask.any():
            ap += precisions[mask].max()
    return ap / 11.0


def compute_class_ap(
    all_preds: list[dict],
    total_gt: int,
) -> tuple[float, float, float, np.ndarray, np.ndarray]:
    """Calcula AP para una clase a partir de todas las predicciones acumuladas.

    Args:
        all_preds: Lista de dicts con 'confidence' y 'is_tp' (bool),
                   acumulados de todas las imágenes.
        total_gt: Número total de GT boxes para esta clase.

    Returns:
        Tupla (ap, best_f1, best_f1_threshold, precisions, recalls).
    """
    if total_gt == 0:
        # Sin GT: AP=0, no hay curva válida
        return 0.0, 0.0, 0.0, np.array([]), np.array([])

    if not all_preds:
        # Sin predicciones pero hay GT: AP=0
        return 0.0, 0.0, 0.0, np.array([0.0]), np.array([0.0])

    # Ordenar por confianza descendente
    all_preds.sort(key=lambda x: x["confidence"], reverse=True)

    tp_cumsum = np.zeros(len(all_preds))
    fp_cumsum = np.zeros(len(all_preds))

    tp_count = 0
    fp_count = 0

    for i, pred in enumerate(all_preds):
        if pred["is_tp"]:
            tp_count += 1
        else:
            fp_count += 1
        tp_cumsum[i] = tp_count
        fp_cumsum[i] = fp_count

    precisions = tp_cumsum / (tp_cumsum + fp_cumsum)
    recalls = tp_cumsum / total_gt

    # AP con interpolación 11 puntos
    ap = compute_ap_11point(precisions, recalls)

    # Mejor F1
    f1_scores = np.where(
        (precisions + recalls) > 0,
        2 * precisions * recalls / (precisions + recalls),
        0.0,
    )
    best_f1_idx = np.argmax(f1_scores)
    best_f1 = float(f1_scores[best_f1_idx])
    best_f1_threshold = float(all_preds[best_f1_idx]["confidence"])

    return ap, best_f1, best_f1_threshold, precisions, recalls


# ---------------------------------------------------------------------------
# 5. Evaluación principal
# ---------------------------------------------------------------------------

def evaluate_dataset(
    session: ort.InferenceSession,
    input_name: str,
    classes: list[str],
    dataset_dir: str,
    conf_threshold: float,
    iou_threshold: float,
) -> dict:
    """Ejecuta inferencia sobre IDRiD test set y calcula AP por clase.

    Args:
        session: Sesión ONNX Runtime.
        input_name: Nombre del tensor de entrada.
        classes: Lista de clases del modelo.
        dataset_dir: Directorio test/ de IDRiD.
        conf_threshold: Umbral de confianza para detecciones.
        iou_threshold: Umbral IoU para matching GT-pred (PASCAL VOC).

    Returns:
        Dict con métricas, curvas PR, resultados por imagen.
    """
    images_dir = os.path.join(dataset_dir, "images")

    print("Clases del modelo:", classes)
    print("Cargando ground truth IDRiD...")
    gt = load_idrid_gt(dataset_dir)
    print(f"  {len(gt)} imágenes con ground truth")

    # Acumuladores por clase
    eval_classes = list(CLASS_MAPPING.keys())
    class_preds: dict[str, list[dict]] = {c: [] for c in eval_classes}
    class_total_gt: dict[str, int] = {c: 0 for c in eval_classes}

    per_image_results = []
    inference_times = []
    raw_class_counts: dict[str, int] = {}
    all_detections: list[dict] = []

    image_stems = sorted(gt.keys())

    for stem in tqdm(image_stems, desc="Evaluando IDRiD"):
        # Buscar archivo de imagen
        img_path = None
        for ext in (".jpg", ".jpeg", ".png", ".tif"):
            candidate = os.path.join(images_dir, f"{stem}{ext}")
            if os.path.exists(candidate):
                img_path = candidate
                break

        if img_path is None:
            print(f"  WARN: imagen no encontrada para {stem}")
            continue

        # Preprocesar e inferir
        try:
            tensor, orig_w, orig_h = load_and_preprocess(img_path)
        except Exception as e:
            print(f"  WARN: error preprocesando {stem}: {e}")
            continue

        t0 = time.perf_counter()
        outputs = session.run(None, {input_name: tensor})
        t1 = time.perf_counter()
        inference_times.append(t1 - t0)

        detections = apply_nms(
            outputs[0], classes, orig_w, orig_h, conf_threshold, NMS_IOU_THRESHOLD
        )

        all_detections.extend(detections)

        # Evaluar por clase
        image_row = {"image": stem}

        for model_class in eval_classes:
            gt_boxes = gt[stem].get(model_class, [])
            class_total_gt[model_class] += len(gt_boxes)

            # Filtrar predicciones de esta clase, ordenar por confianza
            pred_dets = sorted(
                [d for d in detections if normalize_class_name(d["class"]) == model_class],
                key=lambda d: d["confidence"],
                reverse=True,
            )

            # Escalar GT boxes al espacio de la imagen original (ya lo están)
            matches, num_fn = match_detections(pred_dets, gt_boxes, iou_threshold)

            tp = sum(matches)
            fp = len(matches) - tp
            fn = num_fn

            # Acumular para curva PR
            for det, is_tp in zip(pred_dets, matches):
                class_preds[model_class].append({
                    "confidence": det["confidence"],
                    "is_tp": is_tp,
                })

            image_row[f"{model_class}_tp"] = tp
            image_row[f"{model_class}_fp"] = fp
            image_row[f"{model_class}_fn"] = fn

        per_image_results.append(image_row)

    for det in all_detections:
        raw_class_counts[det["class"]] = raw_class_counts.get(det["class"], 0) + 1
    print("Predicciones por clase (raw):", raw_class_counts)

    # Calcular AP por clase
    ap_results = {}
    pr_curves = {}

    for model_class in eval_classes:
        ap, best_f1, best_f1_thresh, precs, recs = compute_class_ap(
            class_preds[model_class],
            class_total_gt[model_class],
        )
        total_preds = len(class_preds[model_class])
        ap_results[model_class] = {
            "ap": round(ap, 4),
            "best_f1": round(best_f1, 4),
            "best_f1_threshold": round(best_f1_thresh, 4),
            "gt_boxes": class_total_gt[model_class],
            "pred_boxes": total_preds,
        }
        pr_curves[model_class] = (precs, recs)

    # mAP
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


# ---------------------------------------------------------------------------
# 6. Exportación de resultados
# ---------------------------------------------------------------------------

def save_results(
    eval_data: dict,
    benchmark_data: dict | None,
    output_dir: str,
    conf_threshold: float,
    iou_threshold: float,
) -> str:
    """Guarda métricas, curvas PR, CSV y reporte en disco.

    Args:
        eval_data: Resultado de evaluate_dataset().
        benchmark_data: Resultado de benchmark_inference() o None.
        output_dir: Directorio de salida.
        conf_threshold: Umbral de confianza usado.
        iou_threshold: Umbral IoU de matching usado.

    Returns:
        Texto del reporte ASCII.
    """
    os.makedirs(output_dir, exist_ok=True)

    ap_results = eval_data["ap_results"]
    mAP = eval_data["mAP"]
    eval_classes = eval_data["eval_classes"]

    # --- metrics_ap.json ---
    metrics = {
        "mAP": mAP,
        "per_class": ap_results,
        "parameters": {
            "conf_threshold": conf_threshold,
            "iou_threshold_matching": iou_threshold,
            "iou_threshold_nms": NMS_IOU_THRESHOLD,
            "min_component_area": MIN_COMPONENT_AREA,
            "dataset": "IDRiD test set",
            "ap_method": "PASCAL VOC 11-point interpolation",
        },
    }

    if benchmark_data:
        metrics["benchmark"] = benchmark_data

    with open(os.path.join(output_dir, "metrics_ap.json"), "w") as f:
        json.dump(metrics, f, indent=2)

    # --- pr_curves.png ---
    pr_curves = eval_data["pr_curves"]
    colors = ["#e74c3c", "#3498db", "#2ecc71", "#f39c12", "#9b59b6"]

    fig, ax = plt.subplots(figsize=(8, 6), dpi=300, facecolor="white")

    for idx, model_class in enumerate(eval_classes):
        precs, recs = pr_curves[model_class]
        if len(precs) == 0:
            continue
        display_name = CLASS_DISPLAY_NAMES.get(model_class, model_class)
        ap_val = ap_results[model_class]["ap"]
        ax.plot(
            recs, precs,
            color=colors[idx % len(colors)],
            lw=2,
            label=f"{display_name} (AP={ap_val:.3f})",
        )

    ax.set_xlabel("Recall", fontsize=11)
    ax.set_ylabel("Precision", fontsize=11)
    ax.set_title(f"Precision-Recall Curves — IDRiD Test Set (mAP={mAP:.3f})", fontsize=13)
    ax.legend(loc="lower left", fontsize=9)
    ax.set_xlim([-0.02, 1.02])
    ax.set_ylim([-0.02, 1.02])
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    fig.savefig(os.path.join(output_dir, "pr_curves.png"), dpi=300, facecolor="white")
    plt.close(fig)

    # --- results_per_image.csv ---
    df = pd.DataFrame(eval_data["per_image_results"])
    df.to_csv(os.path.join(output_dir, "results_per_image.csv"), index=False)

    # --- validation_report.txt ---
    sep = "-" * 62
    header = f"{'Class':<20} | {'AP':>6} | {'GT boxes':>8} | {'Pred boxes':>10} | {'Best F1':>7}"
    lines = [
        "=" * 62,
        "DIRD+ Validation Report — IDRiD Test Set",
        "=" * 62,
        "",
        f"Dataset:              IDRiD test set",
        f"Total images:         {len(eval_data['per_image_results'])}",
        f"Conf threshold:       {conf_threshold}",
        f"IoU threshold (match):{iou_threshold}",
        f"IoU threshold (NMS):  {NMS_IOU_THRESHOLD}",
        f"AP method:            PASCAL VOC 11-point",
        "",
        header,
        sep,
    ]

    for model_class in eval_classes:
        r = ap_results[model_class]
        display = CLASS_DISPLAY_NAMES.get(model_class, model_class)
        lines.append(
            f"{display:<20} | {r['ap']:>6.3f} | {r['gt_boxes']:>8d} | {r['pred_boxes']:>10d} | {r['best_f1']:>7.3f}"
        )

    lines.append(sep)
    lines.append(f"{'mAP':<20} | {mAP:>6.3f} |          |            |")

    lines += [
        "",
        "Note: model class 'microhemorrhages' is mapped to IDRiD ground",
        "truth class 'microaneurysm' as both represent the same clinical",
        "finding (small red lesions) in this model version.",
    ]

    # Inferencia
    inf_times = eval_data["inference_times"]
    if len(inf_times) > 0:
        lines += [
            "",
            "--- Inference Performance ---",
            f"Mean time:            {np.mean(inf_times):.4f} s",
            f"Std time:             {np.std(inf_times):.4f} s",
            f"Images/second:        {1.0 / np.mean(inf_times):.1f}",
        ]

    if benchmark_data:
        lines += [
            "",
            "--- Dedicated Benchmark ---",
            f"Mean:                 {benchmark_data['mean_seconds']:.4f} s",
            f"Std:                  {benchmark_data['std_seconds']:.4f} s",
            f"Median:               {benchmark_data['median_seconds']:.4f} s",
            f"Images/second:        {benchmark_data['images_per_second']:.1f}",
            f"Total images:         {benchmark_data['total_images']}",
        ]

    lines += ["", "=" * 62]
    report_text = "\n".join(lines)

    with open(os.path.join(output_dir, "validation_report.txt"), "w") as f:
        f.write(report_text)

    return report_text


# ---------------------------------------------------------------------------
# 7. Main
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(
        description="Validación de detección ONNX de DIRD+ sobre IDRiD test set."
    )
    parser.add_argument("--model", required=True, help="Ruta al modelo ONNX.")
    parser.add_argument("--dataset", required=True, help="Directorio test/ de IDRiD (con images/ y masks/).")
    parser.add_argument("--output", required=True, help="Directorio de salida.")
    parser.add_argument("--conf-threshold", type=float, default=0.5, help="Umbral de confianza (default: 0.5).")
    parser.add_argument("--iou-threshold", type=float, default=0.5, help="Umbral IoU NMS override (default: 0.5).")
    parser.add_argument("--iou-threshold-match", type=float, default=None, help="Umbral IoU matching GT-pred. Si None, usa --iou-threshold.")
    parser.add_argument("--classes-json", default=None, help="JSON de metadata del modelo.")
    parser.add_argument("--benchmark", action="store_true", help="Ejecutar benchmark.")
    parser.add_argument("--n-benchmark", type=int, default=100, help="Imágenes para benchmark (default: 100).")

    args = parser.parse_args()

    global NMS_IOU_THRESHOLD
    NMS_IOU_THRESHOLD = args.iou_threshold
    iou_match = args.iou_threshold_match if args.iou_threshold_match is not None else args.iou_threshold

    classes = _load_classes(args.classes_json)

    print(f"Modelo:             {args.model}")
    print(f"Dataset:            {args.dataset}")
    print(f"Clases ({len(classes)}):       {classes}")
    print(f"Conf threshold:     {args.conf_threshold}")
    print(f"IoU threshold:      {iou_match} (matching)")
    print(f"IoU NMS:            {NMS_IOU_THRESHOLD}")
    print()

    # Validar estructura del dataset
    images_dir = os.path.join(args.dataset, "images")
    masks_dir = os.path.join(args.dataset, "masks")

    if not os.path.isdir(images_dir):
        print(f"ERROR: no se encontró {images_dir}")
        return
    if not os.path.isdir(masks_dir):
        print(f"ERROR: no se encontró {masks_dir}")
        return

    # Sesión ONNX
    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    opts.intra_op_num_threads = 1

    session = ort.InferenceSession(
        args.model,
        sess_options=opts,
        providers=["CPUExecutionProvider"],
    )

    input_name = session.get_inputs()[0].name
    input_shape = session.get_inputs()[0].shape
    print(f"Input name:         {input_name}")
    print(f"Input shape:        {input_shape}")
    print()

    # Evaluación
    print("=== Evaluación IDRiD ===")
    eval_data = evaluate_dataset(
        session=session,
        input_name=input_name,
        classes=classes,
        dataset_dir=args.dataset,
        conf_threshold=args.conf_threshold,
        iou_threshold=iou_match,
    )

    # Benchmark opcional
    benchmark_data = None
    if args.benchmark:
        print("\n=== Benchmark de inferencia ===")
        benchmark_data = benchmark_inference(
            session=session,
            input_name=input_name,
            images_dir=images_dir,
            n_images=args.n_benchmark,
        )

    # Guardar
    report = save_results(
        eval_data=eval_data,
        benchmark_data=benchmark_data,
        output_dir=args.output,
        conf_threshold=args.conf_threshold,
        iou_threshold=iou_match,
    )

    print()
    print(report)
    print()
    print(f"Resultados guardados en: {args.output}/")


if __name__ == "__main__":
    main()
