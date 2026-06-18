#!/usr/bin/env python3
"""IDRiD segmentation masks -> COCO detection JSON + bbox visualizations."""
from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

import cv2
import numpy as np
from PIL import Image, ImageDraw

BASE = Path(__file__).parent / "datasets" / "idrid"

CLASSES = [
    {"id": 1, "name": "MA", "dir": "1. Microaneurysms", "color": (255,   0,   0)},
    {"id": 2, "name": "HE", "dir": "2. Haemorrhages",   "color": (  0, 128, 255)},
    {"id": 3, "name": "EX", "dir": "3. Hard Exudates",  "color": (255, 255,   0)},
    {"id": 4, "name": "SE", "dir": "4. Soft Exudates",  "color": (  0, 255,   0)},
    {"id": 5, "name": "OD", "dir": "5. Optic Disc",     "color": (255,   0, 255)},
]

MIN_AREA = 3  # filter blob noise (px)


def mask_to_bboxes(mask_path: Path, min_area: int = MIN_AREA):
    m = cv2.imread(str(mask_path), cv2.IMREAD_GRAYSCALE)
    if m is None:
        return []
    _, bin_ = cv2.threshold(m, 0, 255, cv2.THRESH_BINARY)
    n, _, stats, _ = cv2.connectedComponentsWithStats(bin_, connectivity=8)
    out = []
    for i in range(1, n):
        x, y, w, h, area = stats[i]
        if area < min_area:
            continue
        out.append((int(x), int(y), int(w), int(h), int(area)))
    return out


def build_coco(split_dir: Path):
    img_dir = split_dir / "images"
    mask_root = split_dir / "masks"
    images, annotations = [], []
    ann_id = 1
    per_image_boxes = {}  # img_id -> list[(cls_id, x,y,w,h)]

    for img_id, img_path in enumerate(sorted(img_dir.glob("*.jpg")), start=1):
        im = cv2.imread(str(img_path))
        H, W = im.shape[:2]
        images.append({
            "id": img_id,
            "file_name": img_path.name,
            "width": W,
            "height": H,
        })
        stem = img_path.stem  # IDRiD_01
        boxes_here = []
        for c in CLASSES:
            mdir = mask_root / c["dir"]
            if not mdir.exists():
                continue
            suffix = {"MA": "MA", "HE": "HE", "EX": "EX", "SE": "SE", "OD": "OD"}[c["name"]]
            mpath = mdir / f"{stem}_{suffix}.tif"
            if not mpath.exists():
                continue
            for (x, y, w, h, area) in mask_to_bboxes(mpath):
                annotations.append({
                    "id": ann_id,
                    "image_id": img_id,
                    "category_id": c["id"],
                    "bbox": [x, y, w, h],
                    "area": area,
                    "iscrowd": 0,
                    "segmentation": [],
                })
                boxes_here.append((c["id"], x, y, w, h))
                ann_id += 1
        per_image_boxes[img_id] = boxes_here

    coco = {
        "info": {"description": "IDRiD segmentation -> detection bboxes"},
        "licenses": [],
        "images": images,
        "annotations": annotations,
        "categories": [{"id": c["id"], "name": c["name"]} for c in CLASSES],
    }
    return coco, per_image_boxes


def render_viz(split_dir: Path, coco: dict, per_image_boxes: dict, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    id2color = {c["id"]: c["color"] for c in CLASSES}
    img_dir = split_dir / "images"
    for img_meta in coco["images"]:
        p = img_dir / img_meta["file_name"]
        im = Image.open(p).convert("RGB")
        draw = ImageDraw.Draw(im)
        lw = max(2, im.size[1] // 500)
        for (cid, x, y, w, h) in per_image_boxes.get(img_meta["id"], []):
            draw.rectangle([x, y, x + w, y + h], outline=id2color[cid], width=lw)
        im.save(out_dir / img_meta["file_name"])


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", choices=["full", "test"], default="full")
    ap.add_argument("--out", default=None, help="output root (default: results/idrid_coco_<split>)")
    ap.add_argument("--no-viz", action="store_true")
    args = ap.parse_args()

    split_dir = BASE / args.split
    if not split_dir.exists():
        raise SystemExit(f"missing {split_dir}")

    out_root = Path(args.out) if args.out else Path(__file__).parent / "results" / f"idrid_coco_{args.split}"
    out_root.mkdir(parents=True, exist_ok=True)

    print(f"[coco] scanning {split_dir}")
    coco, per_img = build_coco(split_dir)
    ann_path = out_root / "annotations.json"
    ann_path.write_text(json.dumps(coco))
    print(f"[coco] {len(coco['images'])} images, {len(coco['annotations'])} bboxes -> {ann_path}")

    img_out = out_root / "images"
    img_out.mkdir(exist_ok=True)
    src_img_dir = split_dir / "images"
    for im in coco["images"]:
        dst = img_out / im["file_name"]
        if not dst.exists():
            shutil.copy2(src_img_dir / im["file_name"], dst)
    print(f"[images] copied -> {img_out}")

    if not args.no_viz:
        viz_dir = out_root / "viz"
        print(f"[viz] rendering -> {viz_dir}")
        render_viz(split_dir, coco, per_img, viz_dir)
        print(f"[viz] done")


if __name__ == "__main__":
    main()
