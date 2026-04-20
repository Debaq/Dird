#!/usr/bin/env python3
"""
validate_dird.py — Validación científica de modelos ONNX de DIRD+ sobre APTOS 2019.

Evalúa el modelo de detección de retinopatía diabética sobre el dataset
APTOS 2019 (Kaggle) y genera métricas publicables para un paper científico.

Uso:
    python validate_dird.py \
        --model path/to/model.onnx \
        --csv path/to/train.csv \
        --images path/to/train_images/ \
        --output path/to/results/ \
        --conf-threshold 0.5 \
        --iou-threshold 0.45 \
        --benchmark \
        --n-benchmark 100
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
from sklearn.metrics import (
    accuracy_score,
    auc,
    classification_report,
    cohen_kappa_score,
    confusion_matrix,
    f1_score,
    recall_score,
    roc_auc_score,
    roc_curve,
)
from tqdm import tqdm

# ---------------------------------------------------------------------------
# 1. Configuración
# ---------------------------------------------------------------------------

RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)

INPUT_SIZE = 640

# Clases por defecto del modelo de detección DIRD+.
# Orden = índice en el tensor de salida del modelo.
# Ajustar si el JSON de metadata indica otro orden.
DEFAULT_CLASSES = [
    "microaneurysm",
    "hemorrhage",
    "hard_exudate",
    "soft_exudate",
    "neovascularization",
    "optic_disc",
    "fovea",
]

# Clases que son lesiones clínicas (excluye landmarks anatómicos).
LESION_CLASSES = {
    "microaneurysm",
    "hemorrhage",
    "hard_exudate",
    "soft_exudate",
    "neovascularization",
}

# ---------------------------------------------------------------------------
# Mapeo detecciones → grado APTOS (configurable).
#
# La lógica evalúa de mayor a menor severidad. El primer match gana.
#
# Cada regla es una función que recibe:
#   class_counts : dict[str, int]        — cantidad de detecciones por clase
#   quadrant_counts : dict[str, dict]    — detecciones por cuadrante por clase
# y devuelve True/False.
# ---------------------------------------------------------------------------

def _grade4_rule(cc, qc):
    """Proliferative: neovascularización detectada."""
    return cc.get("neovascularization", 0) >= 1


def _grade3_rule(cc, qc):
    """Severe: hemorragias en ≥3 cuadrantes O ≥4 cotton-wool spots."""
    hem_quads = sum(1 for q in qc.values() if q.get("hemorrhage", 0) >= 1)
    cws = cc.get("soft_exudate", 0)
    return hem_quads >= 3 or cws >= 4


def _grade2_rule(cc, qc):
    """Moderate: hemorragias O exudados duros O exudados blandos."""
    return (
        cc.get("hemorrhage", 0) >= 1
        or cc.get("hard_exudate", 0) >= 1
        or cc.get("soft_exudate", 0) >= 1
    )


def _grade1_rule(cc, qc):
    """Mild: solo microaneurismas."""
    return cc.get("microaneurysm", 0) >= 1


GRADE_RULES = [
    (4, _grade4_rule),
    (3, _grade3_rule),
    (2, _grade2_rule),
    (1, _grade1_rule),
]

# Umbral binario: referable DR = grade >= 2
REFERABLE_THRESHOLD = 2

# Nombres para la matriz de confusión
GRADE_NAMES = ["No DR", "Mild", "Moderate", "Severe", "Proliferative"]


# ---------------------------------------------------------------------------
# 2. Preprocesamiento
# ---------------------------------------------------------------------------

def load_and_preprocess(image_path: str) -> tuple[np.ndarray, int, int]:
    """Carga una imagen retinal y la preprocesa para el modelo ONNX.

    Reproduce exactamente el preprocesamiento de DIRD+:
    resize directo a 640×640 (sin letterbox), normalización [0,1], formato CHW.

    Args:
        image_path: Ruta absoluta o relativa al archivo de imagen.

    Returns:
        Tupla (tensor, original_width, original_height) donde tensor tiene
        shape [1, 3, 640, 640] y dtype float32.
    """
    img = cv2.imread(image_path)
    if img is None:
        raise FileNotFoundError(f"No se pudo cargar la imagen: {image_path}")

    original_h, original_w = img.shape[:2]

    # BGR → RGB
    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)

    # Resize directo (sin letterbox)
    img_resized = cv2.resize(img_rgb, (INPUT_SIZE, INPUT_SIZE), interpolation=cv2.INTER_LINEAR)

    # Normalizar a [0, 1]
    img_norm = img_resized.astype(np.float32) / 255.0

    # HWC → CHW
    img_chw = np.transpose(img_norm, (2, 0, 1))

    # Agregar dimensión de batch → [1, 3, 640, 640]
    tensor = np.expand_dims(img_chw, axis=0)

    return tensor, original_w, original_h


# ---------------------------------------------------------------------------
# 3. Post-procesamiento y NMS
# ---------------------------------------------------------------------------

def _calculate_iou(box_a: np.ndarray, box_b: np.ndarray) -> float:
    """Calcula Intersection over Union entre dos bboxes [x1, y1, x2, y2].

    Args:
        box_a: Array de 4 elementos [x1, y1, x2, y2].
        box_b: Array de 4 elementos [x1, y1, x2, y2].

    Returns:
        Valor IoU en [0, 1].
    """
    x1 = max(box_a[0], box_b[0])
    y1 = max(box_a[1], box_b[1])
    x2 = min(box_a[2], box_b[2])
    y2 = min(box_a[3], box_b[3])

    inter = max(0, x2 - x1) * max(0, y2 - y1)
    area_a = (box_a[2] - box_a[0]) * (box_a[3] - box_a[1])
    area_b = (box_b[2] - box_b[0]) * (box_b[3] - box_b[1])
    union = area_a + area_b - inter

    return inter / union if union > 0 else 0.0


def apply_nms(
    output_tensor: np.ndarray,
    classes: list[str],
    original_w: int,
    original_h: int,
    conf_threshold: float = 0.5,
    iou_threshold: float = 0.45,
) -> list[dict]:
    """Post-procesa la salida del modelo ONNX y aplica NMS greedy.

    Detecta automáticamente si el formato de salida es [1, 4+N, D] o [1, D, 4+N].

    Args:
        output_tensor: Salida cruda del modelo ONNX con shape [1, ?, ?].
        classes: Lista de nombres de clase en orden de índice del modelo.
        original_w: Ancho original de la imagen.
        original_h: Alto original de la imagen.
        conf_threshold: Umbral mínimo de confianza para retener una detección.
        iou_threshold: Umbral IoU para suprimir detecciones duplicadas.

    Returns:
        Lista de detecciones, cada una un dict con keys:
        bbox (x1,y1,x2,y2 en coords originales), class, confidence, class_index.
    """
    data = output_tensor.squeeze(0)  # [A, B]

    num_classes = len(classes)
    expected_channels = 4 + num_classes

    # Detectar formato automáticamente
    if data.shape[0] == expected_channels or data.shape[0] < data.shape[1]:
        # Formato [4+N, D] — cada columna es una detección
        num_detections = data.shape[1]
        is_transposed = False
    else:
        # Formato [D, 4+N] — cada fila es una detección
        num_detections = data.shape[0]
        is_transposed = True

    scale_x = original_w / INPUT_SIZE
    scale_y = original_h / INPUT_SIZE

    raw_detections = []

    for i in range(num_detections):
        if is_transposed:
            cx = data[i, 0]
            cy = data[i, 1]
            w = data[i, 2]
            h = data[i, 3]
            scores = data[i, 4 : 4 + num_classes]
        else:
            cx = data[0, i]
            cy = data[1, i]
            w = data[2, i]
            h = data[3, i]
            scores = data[4 : 4 + num_classes, i]

        max_idx = int(np.argmax(scores))
        max_score = float(scores[max_idx])

        if max_score < conf_threshold:
            continue

        # cx,cy,w,h → x1,y1,x2,y2 en espacio original
        x1 = (cx - w / 2) * scale_x
        y1 = (cy - h / 2) * scale_y
        x2 = (cx + w / 2) * scale_x
        y2 = (cy + h / 2) * scale_y

        raw_detections.append(
            {
                "bbox": np.array([x1, y1, x2, y2]),
                "class": classes[max_idx],
                "confidence": max_score,
                "class_index": max_idx,
            }
        )

    if not raw_detections:
        return []

    # NMS greedy: ordenar por confianza descendente
    raw_detections.sort(key=lambda d: d["confidence"], reverse=True)
    keep = []

    while raw_detections:
        best = raw_detections.pop(0)
        keep.append(best)
        raw_detections = [
            d
            for d in raw_detections
            if _calculate_iou(best["bbox"], d["bbox"]) <= iou_threshold
        ]

    return keep


# ---------------------------------------------------------------------------
# 4. Mapeo detecciones → grado APTOS
# ---------------------------------------------------------------------------

def _assign_quadrants(
    detections: list[dict], img_w: int, img_h: int
) -> dict[str, dict[str, int]]:
    """Cuenta detecciones por clase en cada cuadrante.

    Divide la imagen en 4 cuadrantes desde el centro geométrico.

    Args:
        detections: Lista de detecciones post-NMS.
        img_w: Ancho original de la imagen.
        img_h: Alto original de la imagen.

    Returns:
        Dict con keys 'TL','TR','BL','BR', cada uno un dict clase→count.
    """
    cx, cy = img_w / 2, img_h / 2
    quads: dict[str, dict[str, int]] = {
        "TL": {},
        "TR": {},
        "BL": {},
        "BR": {},
    }

    for det in detections:
        if det["class"] not in LESION_CLASSES:
            continue
        box = det["bbox"]
        det_cx = (box[0] + box[2]) / 2
        det_cy = (box[1] + box[3]) / 2

        if det_cy < cy:
            q = "TL" if det_cx < cx else "TR"
        else:
            q = "BL" if det_cx < cx else "BR"

        quads[q][det["class"]] = quads[q].get(det["class"], 0) + 1

    return quads


def detections_to_grade(
    detections: list[dict], img_w: int, img_h: int
) -> tuple[int, dict[str, int]]:
    """Convierte lista de detecciones a un grado APTOS (0-4).

    Evalúa las reglas de GRADE_RULES de mayor a menor severidad.

    Args:
        detections: Lista de detecciones post-NMS.
        img_w: Ancho original de la imagen.
        img_h: Alto original de la imagen.

    Returns:
        Tupla (grade, class_counts) donde grade es 0-4 y class_counts
        es un dict con el conteo de cada clase de lesión detectada.
    """
    # Contar lesiones por clase
    class_counts: dict[str, int] = {}
    for det in detections:
        if det["class"] in LESION_CLASSES:
            class_counts[det["class"]] = class_counts.get(det["class"], 0) + 1

    quadrant_counts = _assign_quadrants(detections, img_w, img_h)

    for grade, rule_fn in GRADE_RULES:
        if rule_fn(class_counts, quadrant_counts):
            return grade, class_counts

    return 0, class_counts


# ---------------------------------------------------------------------------
# 5. Evaluación principal
# ---------------------------------------------------------------------------

def evaluate_dataset(
    session: ort.InferenceSession,
    input_name: str,
    classes: list[str],
    csv_path: str,
    images_dir: str,
    conf_threshold: float,
    iou_threshold: float,
) -> dict:
    """Ejecuta inferencia sobre todo el dataset y calcula métricas.

    Args:
        session: Sesión ONNX Runtime ya cargada.
        input_name: Nombre del tensor de entrada del modelo.
        classes: Lista de nombres de clase del modelo.
        csv_path: Ruta al CSV de APTOS 2019 (columnas: id_code, diagnosis).
        images_dir: Directorio con las imágenes .png del dataset.
        conf_threshold: Umbral de confianza para detecciones.
        iou_threshold: Umbral IoU para NMS.

    Returns:
        Dict con keys: y_true, y_pred, y_true_bin, y_pred_bin,
        confidence_scores, per_image_results, inference_times.
    """
    df = pd.read_csv(csv_path)

    y_true = []
    y_pred = []
    y_true_bin = []
    y_pred_bin = []
    confidence_scores = []
    per_image = []
    inference_times = []

    for _, row in tqdm(df.iterrows(), total=len(df), desc="Evaluando"):
        img_id = row["id_code"]
        true_label = int(row["diagnosis"])

        # Buscar imagen (puede ser .png o .jpg)
        img_path = None
        for ext in (".png", ".jpg", ".jpeg"):
            candidate = os.path.join(images_dir, f"{img_id}{ext}")
            if os.path.exists(candidate):
                img_path = candidate
                break

        if img_path is None:
            continue

        try:
            tensor, orig_w, orig_h = load_and_preprocess(img_path)
        except Exception:
            continue

        # Inferencia
        t0 = time.perf_counter()
        outputs = session.run(None, {input_name: tensor})
        t1 = time.perf_counter()
        inference_times.append(t1 - t0)

        output_tensor = outputs[0]

        # Post-procesamiento
        detections = apply_nms(
            output_tensor, classes, orig_w, orig_h, conf_threshold, iou_threshold
        )

        pred_grade, class_counts = detections_to_grade(detections, orig_w, orig_h)

        # Confianza agregada: max confidence de lesiones, o 0 si no hay
        lesion_dets = [d for d in detections if d["class"] in LESION_CLASSES]
        max_conf = max((d["confidence"] for d in lesion_dets), default=0.0)

        pred_bin = 1 if pred_grade >= REFERABLE_THRESHOLD else 0
        true_bin = 1 if true_label >= REFERABLE_THRESHOLD else 0

        y_true.append(true_label)
        y_pred.append(pred_grade)
        y_true_bin.append(true_bin)
        y_pred_bin.append(pred_bin)
        confidence_scores.append(max_conf)

        per_image.append(
            {
                "image_id": img_id,
                "true_label": true_label,
                "predicted_grade": pred_grade,
                "predicted_binary": pred_bin,
                "confidence_score": round(max_conf, 4),
                "num_detections": len(lesion_dets),
                "class_counts": class_counts,
            }
        )

    return {
        "y_true": np.array(y_true),
        "y_pred": np.array(y_pred),
        "y_true_bin": np.array(y_true_bin),
        "y_pred_bin": np.array(y_pred_bin),
        "confidence_scores": np.array(confidence_scores),
        "per_image_results": per_image,
        "inference_times": np.array(inference_times),
    }


# ---------------------------------------------------------------------------
# 6. Benchmark de inferencia
# ---------------------------------------------------------------------------

def benchmark_inference(
    session: ort.InferenceSession,
    input_name: str,
    images_dir: str,
    n_images: int = 100,
) -> dict:
    """Mide tiempos de inferencia sobre un subconjunto de imágenes.

    Args:
        session: Sesión ONNX Runtime.
        input_name: Nombre del tensor de entrada.
        images_dir: Directorio con imágenes.
        n_images: Cantidad de imágenes a evaluar.

    Returns:
        Dict con mean_seconds, std_seconds, images_per_second, total_images.
    """
    image_files = sorted(
        [
            f
            for f in os.listdir(images_dir)
            if f.lower().endswith((".png", ".jpg", ".jpeg"))
        ]
    )

    np.random.seed(RANDOM_SEED)
    if len(image_files) > n_images:
        indices = np.random.choice(len(image_files), size=n_images, replace=False)
        image_files = [image_files[i] for i in indices]

    times = []

    # Warmup: 3 inferencias
    warmup_path = os.path.join(images_dir, image_files[0])
    warmup_tensor, _, _ = load_and_preprocess(warmup_path)
    for _ in range(3):
        session.run(None, {input_name: warmup_tensor})

    for fname in tqdm(image_files, desc="Benchmark"):
        path = os.path.join(images_dir, fname)
        try:
            tensor, _, _ = load_and_preprocess(path)
        except Exception:
            continue

        t0 = time.perf_counter()
        session.run(None, {input_name: tensor})
        t1 = time.perf_counter()
        times.append(t1 - t0)

    times_arr = np.array(times)
    return {
        "mean_seconds": round(float(np.mean(times_arr)), 4),
        "std_seconds": round(float(np.std(times_arr)), 4),
        "median_seconds": round(float(np.median(times_arr)), 4),
        "min_seconds": round(float(np.min(times_arr)), 4),
        "max_seconds": round(float(np.max(times_arr)), 4),
        "images_per_second": round(float(1.0 / np.mean(times_arr)), 2),
        "total_images": len(times),
    }


# ---------------------------------------------------------------------------
# 7. Exportación de resultados
# ---------------------------------------------------------------------------

def save_results(
    eval_data: dict,
    benchmark_data: dict | None,
    output_dir: str,
    conf_threshold: float,
    iou_threshold: float,
) -> None:
    """Guarda métricas, figuras y tablas en el directorio de salida.

    Args:
        eval_data: Resultado de evaluate_dataset().
        benchmark_data: Resultado de benchmark_inference() o None.
        output_dir: Directorio donde escribir los archivos.
        conf_threshold: Umbral de confianza usado.
        iou_threshold: Umbral IoU usado.
    """
    os.makedirs(output_dir, exist_ok=True)

    y_true = eval_data["y_true"]
    y_pred = eval_data["y_pred"]
    y_true_bin = eval_data["y_true_bin"]
    y_pred_bin = eval_data["y_pred_bin"]
    scores = eval_data["confidence_scores"]

    # --- Métricas binarias ---
    sensitivity = float(recall_score(y_true_bin, y_pred_bin, pos_label=1, zero_division=0))
    specificity = float(recall_score(y_true_bin, y_pred_bin, pos_label=0, zero_division=0))
    acc_bin = float(accuracy_score(y_true_bin, y_pred_bin))
    f1_bin = float(f1_score(y_true_bin, y_pred_bin, zero_division=0))

    # AUC-ROC: usar confidence_scores como score continuo
    try:
        auc_roc = float(roc_auc_score(y_true_bin, scores))
    except ValueError:
        auc_roc = None

    cm_bin = confusion_matrix(y_true_bin, y_pred_bin, labels=[0, 1]).tolist()

    metrics_binary = {
        "sensitivity": round(sensitivity, 4),
        "specificity": round(specificity, 4),
        "auc_roc": round(auc_roc, 4) if auc_roc is not None else None,
        "accuracy": round(acc_bin, 4),
        "f1_score": round(f1_bin, 4),
        "confusion_matrix": cm_bin,
        "n_samples": int(len(y_true_bin)),
        "n_referable": int(y_true_bin.sum()),
        "n_non_referable": int((y_true_bin == 0).sum()),
        "parameters": {
            "conf_threshold": conf_threshold,
            "iou_threshold": iou_threshold,
            "referable_threshold": REFERABLE_THRESHOLD,
        },
    }

    with open(os.path.join(output_dir, "metrics_binary.json"), "w") as f:
        json.dump(metrics_binary, f, indent=2)

    # --- Métricas de grading (5 niveles) ---
    qwk = float(cohen_kappa_score(y_true, y_pred, weights="quadratic"))

    per_class_acc = {}
    for grade in range(5):
        mask = y_true == grade
        if mask.sum() > 0:
            per_class_acc[GRADE_NAMES[grade]] = round(
                float(accuracy_score(y_true[mask], y_pred[mask])), 4
            )
        else:
            per_class_acc[GRADE_NAMES[grade]] = None

    cm_full = confusion_matrix(y_true, y_pred, labels=list(range(5))).tolist()

    metrics_grading = {
        "quadratic_weighted_kappa": round(qwk, 4),
        "per_class_accuracy": per_class_acc,
        "confusion_matrix_5class": cm_full,
        "n_samples": int(len(y_true)),
        "distribution_true": {
            GRADE_NAMES[g]: int((y_true == g).sum()) for g in range(5)
        },
        "distribution_pred": {
            GRADE_NAMES[g]: int((y_pred == g).sum()) for g in range(5)
        },
    }

    with open(os.path.join(output_dir, "metrics_grading.json"), "w") as f:
        json.dump(metrics_grading, f, indent=2)

    # --- Curva ROC ---
    if auc_roc is not None:
        fpr, tpr, _ = roc_curve(y_true_bin, scores)
        fig, ax = plt.subplots(figsize=(6, 6), dpi=300, facecolor="white")
        ax.plot(fpr, tpr, color="#2563eb", lw=2, label=f"DIRD+ (AUC = {auc_roc:.3f})")
        ax.plot([0, 1], [0, 1], color="#94a3b8", lw=1, linestyle="--", label="Random")
        ax.set_xlabel("1 - Specificity (FPR)", fontsize=11)
        ax.set_ylabel("Sensitivity (TPR)", fontsize=11)
        ax.set_title("ROC Curve — Referable DR Detection", fontsize=13)
        ax.legend(loc="lower right", fontsize=10)
        ax.set_xlim([-0.02, 1.02])
        ax.set_ylim([-0.02, 1.02])
        ax.grid(True, alpha=0.3)
        fig.tight_layout()
        fig.savefig(os.path.join(output_dir, "roc_curve.png"), dpi=300, facecolor="white")
        plt.close(fig)

    # --- Matriz de confusión (5 clases, normalizada) ---
    cm_norm = confusion_matrix(y_true, y_pred, labels=list(range(5)), normalize="true")
    fig, ax = plt.subplots(figsize=(7, 6), dpi=300, facecolor="white")
    im = ax.imshow(cm_norm, cmap="Blues", vmin=0, vmax=1)

    ax.set_xticks(range(5))
    ax.set_yticks(range(5))
    ax.set_xticklabels(GRADE_NAMES, fontsize=9, rotation=45, ha="right")
    ax.set_yticklabels(GRADE_NAMES, fontsize=9)
    ax.set_xlabel("Predicted", fontsize=11)
    ax.set_ylabel("True (APTOS)", fontsize=11)
    ax.set_title("Confusion Matrix — DR Grading (normalized)", fontsize=13)

    for i in range(5):
        for j in range(5):
            val = cm_norm[i, j]
            color = "white" if val > 0.5 else "black"
            ax.text(j, i, f"{val:.2f}", ha="center", va="center", color=color, fontsize=10)

    fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
    fig.tight_layout()
    fig.savefig(
        os.path.join(output_dir, "confusion_matrix.png"), dpi=300, facecolor="white"
    )
    plt.close(fig)

    # --- CSV por imagen ---
    per_image_df = pd.DataFrame(
        [
            {
                "image_id": r["image_id"],
                "true_label": r["true_label"],
                "predicted_grade": r["predicted_grade"],
                "predicted_binary": r["predicted_binary"],
                "confidence_score": r["confidence_score"],
                "num_detections": r["num_detections"],
            }
            for r in eval_data["per_image_results"]
        ]
    )
    per_image_df.to_csv(os.path.join(output_dir, "results_per_image.csv"), index=False)

    # --- Benchmark ---
    if benchmark_data is not None:
        with open(os.path.join(output_dir, "benchmark.json"), "w") as f:
            json.dump(benchmark_data, f, indent=2)

    # --- Reporte de texto ---
    inf_times = eval_data["inference_times"]
    report_lines = [
        "=" * 60,
        "DIRD+ Validation Report",
        "=" * 60,
        "",
        f"Dataset:           APTOS 2019",
        f"Total images:      {len(y_true)}",
        f"Conf threshold:    {conf_threshold}",
        f"IoU threshold:     {iou_threshold}",
        "",
        "--- Binary Classification (Referable DR) ---",
        f"Sensitivity:       {sensitivity:.4f}",
        f"Specificity:       {specificity:.4f}",
        f"AUC-ROC:           {auc_roc:.4f}" if auc_roc else "AUC-ROC:           N/A",
        f"Accuracy:          {acc_bin:.4f}",
        f"F1-score:          {f1_bin:.4f}",
        "",
        "--- 5-Class Grading ---",
        f"Quadratic Weighted Kappa: {qwk:.4f}",
        "",
        "Per-class accuracy:",
    ]

    for name, val in per_class_acc.items():
        report_lines.append(f"  {name:20s} {val:.4f}" if val is not None else f"  {name:20s} N/A")

    report_lines += [
        "",
        "--- Inference Performance ---",
        f"Mean time:         {np.mean(inf_times):.4f} s",
        f"Std time:          {np.std(inf_times):.4f} s",
        f"Images/second:     {1.0 / np.mean(inf_times):.1f}",
    ]

    if benchmark_data:
        report_lines += [
            "",
            "--- Dedicated Benchmark ---",
            f"Mean:              {benchmark_data['mean_seconds']:.4f} s",
            f"Std:               {benchmark_data['std_seconds']:.4f} s",
            f"Median:            {benchmark_data['median_seconds']:.4f} s",
            f"Images/second:     {benchmark_data['images_per_second']:.1f}",
            f"Total images:      {benchmark_data['total_images']}",
        ]

    report_lines += ["", "=" * 60]
    report_text = "\n".join(report_lines)

    with open(os.path.join(output_dir, "validation_report.txt"), "w") as f:
        f.write(report_text)

    return report_text


# ---------------------------------------------------------------------------
# 8. Main
# ---------------------------------------------------------------------------

def _load_classes(classes_json: str | None) -> list[str]:
    """Carga nombres de clase desde JSON de metadata o usa defaults.

    Args:
        classes_json: Ruta al JSON de metadata del modelo, o None.

    Returns:
        Lista de nombres de clase en orden de índice del modelo.
    """
    if classes_json is None:
        return DEFAULT_CLASSES

    with open(classes_json) as f:
        meta = json.load(f)

    if isinstance(meta, list):
        raw_classes = meta
    else:
        raw_classes = meta.get("classes", [])

    if not raw_classes:
        return DEFAULT_CLASSES

    # Soportar formato nuevo (objetos con technical_name + currently_detected)
    # y formato legacy (lista de strings)
    if isinstance(raw_classes[0], dict):
        # Filtrar solo clases actualmente detectadas, mantener orden por index
        detected = [c for c in raw_classes if c.get("currently_detected", True)]
        detected.sort(key=lambda c: c.get("index", 0))
        return [c["technical_name"] for c in detected]
    else:
        return [str(c) for c in raw_classes]


def main():
    parser = argparse.ArgumentParser(
        description="Validación científica de modelos ONNX de DIRD+ sobre APTOS 2019."
    )
    parser.add_argument("--model", required=True, help="Ruta al modelo ONNX de detección.")
    parser.add_argument("--csv", required=True, help="Ruta al CSV de APTOS 2019 (id_code, diagnosis).")
    parser.add_argument("--images", required=True, help="Directorio con imágenes del dataset.")
    parser.add_argument("--output", required=True, help="Directorio de salida para resultados.")
    parser.add_argument("--conf-threshold", type=float, default=0.5, help="Umbral de confianza (default: 0.5).")
    parser.add_argument("--iou-threshold", type=float, default=0.45, help="Umbral IoU para NMS (default: 0.45).")
    parser.add_argument("--classes-json", default=None, help="JSON de metadata del modelo con definición de clases.")
    parser.add_argument("--benchmark", action="store_true", help="Ejecutar benchmark de rendimiento.")
    parser.add_argument("--n-benchmark", type=int, default=100, help="Número de imágenes para benchmark (default: 100).")

    args = parser.parse_args()

    classes = _load_classes(args.classes_json)

    print(f"Modelo:        {args.model}")
    print(f"Dataset:       {args.csv}")
    print(f"Imágenes:      {args.images}")
    print(f"Clases ({len(classes)}):  {classes}")
    print(f"Conf thresh:   {args.conf_threshold}")
    print(f"IoU thresh:    {args.iou_threshold}")
    print()

    # Crear sesión ONNX (CPU)
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
    print(f"Input name:    {input_name}")
    print(f"Input shape:   {input_shape}")
    print()

    # Evaluación
    print("=== Evaluación del dataset ===")
    eval_data = evaluate_dataset(
        session=session,
        input_name=input_name,
        classes=classes,
        csv_path=args.csv,
        images_dir=args.images,
        conf_threshold=args.conf_threshold,
        iou_threshold=args.iou_threshold,
    )

    # Benchmark opcional
    benchmark_data = None
    if args.benchmark:
        print("\n=== Benchmark de inferencia ===")
        benchmark_data = benchmark_inference(
            session=session,
            input_name=input_name,
            images_dir=args.images,
            n_images=args.n_benchmark,
        )

    # Guardar resultados
    report = save_results(
        eval_data=eval_data,
        benchmark_data=benchmark_data,
        output_dir=args.output,
        conf_threshold=args.conf_threshold,
        iou_threshold=args.iou_threshold,
    )

    # Imprimir resumen
    print()
    print(report)
    print()
    print(f"Resultados guardados en: {args.output}/")


if __name__ == "__main__":
    main()
