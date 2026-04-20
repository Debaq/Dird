#!/usr/bin/env python3
"""Overlay IDRiD segmentation masks on fundus images with per-class colors."""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFont

BASE = Path(__file__).parent / "datasets" / "idrid" / "A. Segmentation"

CLASSES = {
    "MA": {"dir": "1. Microaneurysms",  "color": (255,   0,   0), "label": "Microaneurysms"},
    "HE": {"dir": "2. Haemorrhages",    "color": (  0, 128, 255), "label": "Haemorrhages"},
    "EX": {"dir": "3. Hard Exudates",   "color": (255, 255,   0), "label": "Hard Exudates"},
    "SE": {"dir": "4. Soft Exudates",   "color": (  0, 255,   0), "label": "Soft Exudates"},
    "OD": {"dir": "5. Optic Disc",      "color": (255,   0, 255), "label": "Optic Disc"},
}

SPLITS = {
    "train": ("1. Original Images/a. Training Set",
              "2. All Segmentation Groundtruths/a. Training Set"),
    "test":  ("1. Original Images/b. Testing Set",
              "2. All Segmentation Groundtruths/b. Testing Set"),
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


def overlay(image: Image.Image, mask_paths: dict[str, Path], alpha: float) -> Image.Image:
    base = image.convert("RGBA")
    W, H = base.size
    composite = base.copy()
    present: list[str] = []

    for code, mpath in mask_paths.items():
        if not mpath.exists():
            continue
        m = np.array(Image.open(mpath).convert("L"))
        if m.shape != (H, W):
            m = np.array(Image.open(mpath).convert("L").resize((W, H), Image.NEAREST))
        binary = m > 0
        if not binary.any():
            continue
        present.append(code)
        color = CLASSES[code]["color"]
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
    for code in present:
        info = CLASSES[code]
        text = f"{code} - {info['label']}"
        bbox = draw.textbbox((x, y), text, font=font)
        draw.rectangle(bbox, fill=(0, 0, 0, 180))
        draw.rectangle((bbox[0] - 22, bbox[1] + 2, bbox[0] - 6, bbox[3] - 2), fill=info["color"])
        draw.text((x, y), text, fill=(255, 255, 255), font=font)
        y = bbox[3] + 4

    return composite.convert("RGB")


def process_split(split: str, out_dir: Path, alpha: float, limit: int | None) -> None:
    img_dir = BASE / SPLITS[split][0]
    mask_root = BASE / SPLITS[split][1]
    out_dir.mkdir(parents=True, exist_ok=True)

    images = sorted(img_dir.glob("*.jpg"))
    if limit:
        images = images[:limit]

    for i, img_path in enumerate(images, 1):
        stem = img_path.stem
        mask_paths = {
            code: mask_root / info["dir"] / f"{stem}_{code}.tif"
            for code, info in CLASSES.items()
        }
        img = Image.open(img_path)
        marked = overlay(img, mask_paths, alpha)
        marked = _draw_name(marked, f"{stem} [marked]")
        original = _draw_name(img, f"{stem} [original]")
        p_marked = out_dir / f"{stem}_1_marked.jpg"
        p_original = out_dir / f"{stem}_2_original.jpg"
        marked.save(p_marked, quality=90)
        original.save(p_original, quality=90)
        print(f"[{i}/{len(images)}] {split}/{stem} -> marked + original")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--split", choices=["train", "test", "both"], default="both")
    ap.add_argument("--alpha", type=float, default=0.5)
    ap.add_argument("--limit", type=int, default=None)
    ap.add_argument("--out", type=Path, default=Path(__file__).parent / "results" / "idrid_overlays")
    args = ap.parse_args()

    splits = ["train", "test"] if args.split == "both" else [args.split]
    for s in splits:
        process_split(s, args.out / s, args.alpha, args.limit)
    print(f"\nDone. Output: {args.out}")


if __name__ == "__main__":
    main()
