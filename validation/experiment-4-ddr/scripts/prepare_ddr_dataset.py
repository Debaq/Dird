#!/usr/bin/env python3
"""
Normaliza el DDR-dataset (parte DR_grading) a la convención del pipeline:

    ddr_extracted/labels.csv   (columnas: id_code, diagnosis, relpath)

`diagnosis` queda en escala ICDR 0..4 (0 = normal) igual que APTOS, para que
`gt_binary = 0 si diagnosis==0` sea idéntico. Las imágenes ungradable (grado 5 en
el DDR original) se DESCARTAN.

Estructura DDR esperada (`DR_grading/`):
    DR_grading/train.txt        líneas: "<filename> <grade>"
    DR_grading/valid.txt
    DR_grading/test.txt
    DR_grading/train/<filename>
    DR_grading/valid/<filename>
    DR_grading/test/<filename>

`relpath` se guarda relativo a --grading-dir, así los run_*.py cargan
`grading_dir / relpath` sin aplanar nada (las imágenes son crudas, ~3000px).

No descarga nada. Ver README_prepare_ddr.md.
"""
import argparse
from pathlib import Path

import pandas as pd

SPLITS = ["train", "valid", "test"]
IMG_EXTS = (".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG", ".tif", ".tiff")


def find_label_file(grading_dir: Path, split: str) -> Path | None:
    for cand in (grading_dir / f"{split}.txt", grading_dir / f"{split}.csv"):
        if cand.exists():
            return cand
    hits = list(grading_dir.glob(f"*{split}*.txt"))
    return hits[0] if hits else None


def find_image(grading_dir: Path, split: str, name: str) -> Path | None:
    stem = Path(name).stem
    for sub in (grading_dir / split, grading_dir / split / "images", grading_dir):
        if not sub.exists():
            continue
        # nombre exacto
        p = sub / name
        if p.exists():
            return p
        for ext in IMG_EXTS:
            q = sub / f"{stem}{ext}"
            if q.exists():
                return q
        hits = list(sub.glob(f"{stem}.*"))
        if hits:
            return hits[0]
    return None


def parse_label_file(path: Path) -> list[tuple[str, int]]:
    rows = []
    for line in path.read_text().splitlines():
        line = line.strip()
        if not line:
            continue
        parts = line.replace(",", " ").split()
        if len(parts) < 2:
            continue
        name, grade = parts[0], parts[-1]
        try:
            g = int(float(grade))
        except ValueError:
            continue  # header u otra línea no numérica
        rows.append((name, g))
    return rows


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--grading-dir", required=True, type=Path,
                    help="carpeta DR_grading del DDR-dataset")
    ap.add_argument("--output", type=Path, default=Path("ddr_extracted"))
    ap.add_argument("--keep-ungradable", action="store_true",
                    help="conservar grado 5 (default: descartar)")
    args = ap.parse_args()

    rows, missing, dropped_ungr = [], [], 0
    for split in SPLITS:
        lf = find_label_file(args.grading_dir, split)
        if lf is None:
            print(f"[i] sin archivo de labels para split '{split}', se omite")
            continue
        for name, g in parse_label_file(lf):
            if g == 5 and not args.keep_ungradable:
                dropped_ungr += 1
                continue
            if g < 0 or g > 5:
                continue
            p = find_image(args.grading_dir, split, name)
            if p is None:
                missing.append(f"{split}/{name}")
                continue
            rows.append({
                "id_code": Path(name).stem,
                "diagnosis": g,
                "relpath": str(p.relative_to(args.grading_dir)),
                "split": split,
            })

    if not rows:
        raise SystemExit("[ERROR] No se armó ninguna fila. Revisá --grading-dir y la estructura.")

    df = pd.DataFrame(rows).drop_duplicates(subset="id_code")
    args.output.mkdir(parents=True, exist_ok=True)
    df[["id_code", "diagnosis", "relpath", "split"]].to_csv(args.output / "labels.csv", index=False)

    counts = df["diagnosis"].value_counts().sort_index().to_dict()
    n_norm = int((df["diagnosis"] == 0).sum())
    n_path = int((df["diagnosis"] != 0).sum())
    print(f"[OK] labels.csv -> {args.output/'labels.csv'}")
    print(f"     N={len(df)}  normales={n_norm}  patológicas={n_path}")
    print(f"     grados={counts}  ungradable_descartadas={dropped_ungr}")
    print(f"     por split={df['split'].value_counts().to_dict()}")
    if missing:
        (args.output / "missing.txt").write_text("\n".join(missing))
        print(f"     faltantes (sin imagen)={len(missing)} -> {args.output/'missing.txt'}")
    print(f"[i] Pasá --images {args.grading_dir} a los run_*.py (relpath es relativo a esa carpeta)")


if __name__ == "__main__":
    main()
