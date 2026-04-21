#!/usr/bin/env python3
"""Overlay predicciones YOLO e2e + GT masks IDRiD para inspección visual.

Genera 3 imágenes por muestra:
  {stem}_1_pred.jpg     → bboxes predichos coloreados por clase
  {stem}_2_gt.jpg       → máscaras GT pintadas (como overlay_idrid_masks.py)
  {stem}_3_original.jpg → imagen original

Uso:
    python overlay_predictions_e2e.py \
        --model best.onnx \
        --dataset datasets/idrid/full \
        --classes-json best-metadata.json \
        --out results/idrid-overlays-best \
        --conf 0.25 --limit 20
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import cv2
import numpy as np
import onnxruntime as ort
from PIL import Image, ImageDraw, ImageFont

from validate_dird import _load_classes, load_and_preprocess
from validate_idrid import CLASS_MAPPING, normalize_class_name
from validate_idrid_e2e import decode_e2e

CLASS_COLORS = {
    "microaneurysm":    (255,   0,   0),
    "hemorrhage":       (  0, 128, 255),
    "hard_exudate":     (255, 255,   0),
    "soft_exudate":     (  0, 255,   0),
    "optic_disc":       (255,   0, 255),
}

GT_SUBDIR = {
    "microaneurysm": ("1. Microaneurysms", "MA"),
    "hemorrhage":    ("2. Haemorrhages",   "HE"),
    "hard_exudate":  ("3. Hard Exudates",  "EX"),
    "soft_exudate":  ("4. Soft Exudates",  "SE"),
    "optic_disc":    ("5. Optic Disc",     "OD"),
}


def _font(H: int):
    try:
        return ImageFont.truetype("/usr/share/fonts/TTF/DejaVuSans-Bold.ttf", size=max(16, H // 60))
    except OSError:
        return ImageFont.load_default()


def _draw_name(img: Image.Image, name: str) -> Image.Image:
    out = img.convert("RGB").copy()
    W, H = out.size
    draw = ImageDraw.Draw(out, "RGBA")
    font = _font(H)
    pad = 10
    bbox = draw.textbbox((0, 0), name, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = W - tw - pad - 6
    y = H - th - pad - 6
    draw.rectangle((x - 6, y - 4, x + tw + 6, y + th + 6), fill=(0, 0, 0, 180))
    draw.text((x, y), name, fill=(255, 255, 255), font=font)
    return out


def draw_predictions(img: Image.Image, detections: list[dict]) -> Image.Image:
    out = img.convert("RGB").copy()
    W, H = out.size
    draw = ImageDraw.Draw(out, "RGBA")
    font = _font(H)
    lw = max(2, H // 400)

    present_classes = {}

    for d in detections:
        canon = normalize_class_name(d["class"])
        color = CLASS_COLORS.get(canon, (200, 200, 200))
        x1, y1, x2, y2 = d["bbox"]
        draw.rectangle([x1, y1, x2, y2], outline=color, width=lw)
        conf_txt = f"{canon[:3]} {d['confidence']:.2f}"
        tb = draw.textbbox((x1, max(0, y1 - 18)), conf_txt, font=font)
        draw.rectangle(tb, fill=(0, 0, 0, 180))
        draw.text((tb[0], tb[1]), conf_txt, fill=color, font=font)
        present_classes[canon] = color

    pad = 10
    x = pad + 20
    y = pad
    for canon, color in present_classes.items():
        text = f"{canon}"
        bbox = draw.textbbox((x, y), text, font=font)
        draw.rectangle(bbox, fill=(0, 0, 0, 180))
        draw.rectangle((bbox[0] - 22, bbox[1] + 2, bbox[0] - 6, bbox[3] - 2), fill=color)
        draw.text((x, y), text, fill=(255, 255, 255), font=font)
        y = bbox[3] + 4

    return out


def draw_gt_masks(img: Image.Image, masks_dir: Path, stem: str, alpha: float = 0.5) -> Image.Image:
    base = img.convert("RGBA")
    W, H = base.size
    composite = base.copy()
    present = []

    for canon, (subdir, suffix) in GT_SUBDIR.items():
        mpath = masks_dir / subdir / f"{stem}_{suffix}.tif"
        if not mpath.exists():
            continue
        m = np.array(Image.open(mpath).convert("L"))
        if m.shape != (H, W):
            m = np.array(Image.open(mpath).convert("L").resize((W, H), Image.NEAREST))
        binary = m > 0
        if not binary.any():
            continue
        present.append(canon)
        color = CLASS_COLORS[canon]
        layer = np.zeros((H, W, 4), dtype=np.uint8)
        layer[binary, 0] = color[0]
        layer[binary, 1] = color[1]
        layer[binary, 2] = color[2]
        layer[binary, 3] = int(255 * alpha)
        composite = Image.alpha_composite(composite, Image.fromarray(layer, "RGBA"))

    draw = ImageDraw.Draw(composite)
    font = _font(H)
    pad = 10
    x = pad + 20
    y = pad
    for canon in present:
        color = CLASS_COLORS[canon]
        text = f"{canon}"
        bbox = draw.textbbox((x, y), text, font=font)
        draw.rectangle(bbox, fill=(0, 0, 0, 180))
        draw.rectangle((bbox[0] - 22, bbox[1] + 2, bbox[0] - 6, bbox[3] - 2), fill=color)
        draw.text((x, y), text, fill=(255, 255, 255), font=font)
        y = bbox[3] + 4

    return composite.convert("RGB")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True)
    ap.add_argument("--dataset", required=True, help="Dir con images/ y masks/")
    ap.add_argument("--classes-json", required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--conf", type=float, default=0.25)
    ap.add_argument("--alpha", type=float, default=0.5)
    ap.add_argument("--limit", type=int, default=None)
    args = ap.parse_args()

    classes = _load_classes(args.classes_json)
    images_dir = Path(args.dataset) / "images"
    masks_dir = Path(args.dataset) / "masks"
    args.out.mkdir(parents=True, exist_ok=True)

    opts = ort.SessionOptions()
    opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL
    sess = ort.InferenceSession(args.model, sess_options=opts, providers=["CPUExecutionProvider"])
    input_name = sess.get_inputs()[0].name

    images = sorted([p for p in images_dir.iterdir()
                     if p.suffix.lower() in (".jpg", ".jpeg", ".png", ".tif")])
    if args.limit:
        images = images[:args.limit]

    for i, img_path in enumerate(images, 1):
        stem = img_path.stem
        tensor, orig_w, orig_h = load_and_preprocess(str(img_path))
        out = sess.run(None, {input_name: tensor})[0]
        dets = decode_e2e(out, classes, orig_w, orig_h, args.conf)

        pil = Image.open(img_path).convert("RGB")
        pred_img = draw_predictions(pil, dets)
        gt_img = draw_gt_masks(pil, masks_dir, stem, args.alpha)

        pred_img = _draw_name(pred_img, f"{stem} [pred conf>{args.conf}]")
        gt_img = _draw_name(gt_img, f"{stem} [GT]")
        orig_img = _draw_name(pil, f"{stem} [original]")

        pred_img.save(args.out / f"{stem}_1_pred.jpg", quality=90)
        gt_img.save(args.out / f"{stem}_2_gt.jpg", quality=90)
        orig_img.save(args.out / f"{stem}_3_original.jpg", quality=90)
        print(f"[{i}/{len(images)}] {stem} -> {len(dets)} dets")

    print(f"\nDone. Output: {args.out}")


if __name__ == "__main__":
    main()
