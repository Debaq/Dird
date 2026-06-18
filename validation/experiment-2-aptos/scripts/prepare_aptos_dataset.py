#!/usr/bin/env python3
"""Selecciona 500 imágenes APTOS 2019, divide en 3 splits disjuntos y comprime."""
import argparse
import shutil
import zipfile
from pathlib import Path

import pandas as pd
from PIL import Image
from tqdm import tqdm


def select_images(df: pd.DataFrame, seed: int) -> pd.DataFrame:
    quotas = {4: 100, 3: 150, 2: 200, 0: 50}
    selected = []
    for grade, n in quotas.items():
        subset = df[df["diagnosis"] == grade]
        take = min(n, len(subset))
        selected.append(subset.sample(n=take, random_state=seed))

    picked = pd.concat(selected)
    remaining = 500 - len(picked)

    grade1 = df[df["diagnosis"] == 1]
    take1 = min(remaining, len(grade1))
    picked = pd.concat([picked, grade1.sample(n=take1, random_state=seed)])

    return picked.reset_index(drop=True)


def stratified_split(picked: pd.DataFrame, n_splits: int, seed: int) -> list[pd.DataFrame]:
    """División estratificada disjunta: preserva proporción de grados en cada split."""
    splits: list[list[pd.DataFrame]] = [[] for _ in range(n_splits)]
    for grade, group in picked.groupby("diagnosis"):
        shuffled = group.sample(frac=1.0, random_state=seed + int(grade)).reset_index(drop=True)
        for i, row in shuffled.iterrows():
            splits[i % n_splits].append(row.to_frame().T)

    return [pd.concat(s).reset_index(drop=True) for s in splits]


def zip_dir(src_dir: Path, zip_path: Path) -> None:
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for f in src_dir.rglob("*"):
            if f.is_file():
                zf.write(f, f.relative_to(src_dir.parent))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--csv", required=True, type=Path)
    ap.add_argument("--images", required=True, type=Path)
    ap.add_argument("--output", required=True, type=Path)
    ap.add_argument("--seed", type=int, default=42)
    ap.add_argument("--n-markers", type=int, default=3)
    ap.add_argument("--format", choices=["png", "webp"], default="webp")
    ap.add_argument("--webp-quality", type=int, default=90)
    args = ap.parse_args()

    df = pd.read_csv(args.csv)
    picked = select_images(df, args.seed)
    args.output.mkdir(parents=True, exist_ok=True)
    picked[["id_code", "diagnosis"]].to_csv(args.output / "selected_images.csv", index=False)

    splits = stratified_split(picked, args.n_markers, args.seed)

    print(f"\nTotal seleccionadas: {len(picked)}")
    for i, split_df in enumerate(splits, start=1):
        marker_dir = args.output / f"marker{i}"
        images_dir = marker_dir / "images"
        images_dir.mkdir(parents=True, exist_ok=True)

        for row in tqdm(split_df.itertuples(index=False), total=len(split_df), desc=f"marker{i}"):
            src = args.images / f"{row.id_code}.png"
            if args.format == "webp":
                dst = images_dir / f"{row.id_code}.webp"
                with Image.open(src) as im:
                    im.save(dst, "WEBP", quality=args.webp_quality, method=6)
            else:
                dst = images_dir / f"{row.id_code}.png"
                shutil.copy2(src, dst)

        split_df[["id_code", "diagnosis"]].to_csv(marker_dir / "labels.csv", index=False)

        zip_path = args.output / f"marker{i}.zip"
        zip_dir(marker_dir, zip_path)

        counts = split_df["diagnosis"].value_counts().sort_index().to_dict()
        size_mb = zip_path.stat().st_size / 1e6
        print(f"  marker{i}: {len(split_df)} img, grados={counts}, zip={size_mb:.1f} MB")


if __name__ == "__main__":
    main()
