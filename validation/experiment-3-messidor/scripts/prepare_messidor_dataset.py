#!/usr/bin/env python3
"""
Normaliza Messidor (1 o 2) a la convención usada por el pipeline de validación:

    messidor_extracted/labels.csv      (columnas: id_code, diagnosis)
    messidor_extracted/images/<id_code>.<ext>   (sin recomprimir; se respeta el original)

`diagnosis` queda en la escala 0..4 del ICDR para que `gt_binary = 0 si diagnosis==0`
sea idéntico a APTOS (Sub-exp 1). NO se modifican pesos ni umbrales: este script solo
arma el CSV/índice de imágenes.

Soporta dos fuentes:

  --source messidor2   (RECOMENDADO, es el referido en el REPORT de APTOS §8.5)
      CSV con grado adjudicado 0..4. Por defecto busca columnas
      {image|id_code|Image name} y {adjudicated_dr_grade|dr_grade|diagnosis|grade}.

  --source messidor1
      Messidor original: 12 planillas Base11..Base34 (.xls) con columnas
      "Image name" y "Retinopathy grade" (0..3). Ese grado 0..3 se mapea a 0..4
      manteniendo 0=normal; el resto es patológico (la binarización no cambia).
      Pasar --xls-dir con la carpeta que contiene los .xls.

El script NO descarga nada (Messidor requiere registro). Ver README_prepare_messidor.md.
"""
import argparse
import shutil
from pathlib import Path

import pandas as pd

IMG_EXTS = (".png", ".jpg", ".jpeg", ".tif", ".tiff", ".PNG", ".JPG", ".JPEG", ".TIF", ".TIFF")

# nombres de columna tolerados (case-insensitive) para cada fuente
ID_COLS = ["id_code", "image", "image name", "image_name", "imagename", "filename", "id"]
GRADE_COLS = [
    "adjudicated_dr_grade", "dr_grade", "diagnosis", "retinopathy grade",
    "retinopathy_grade", "grade", "dr",
]


def _pick(df: pd.DataFrame, candidates: list[str]) -> str:
    lower = {c.lower().strip(): c for c in df.columns}
    for cand in candidates:
        if cand in lower:
            return lower[cand]
    raise SystemExit(
        f"[ERROR] No encuentro ninguna columna {candidates} en {list(df.columns)}"
    )


def load_messidor2(csv: Path) -> pd.DataFrame:
    df = pd.read_csv(csv)
    id_col = _pick(df, ID_COLS)
    g_col = _pick(df, GRADE_COLS)
    out = pd.DataFrame({
        "id_code": df[id_col].astype(str).map(lambda s: Path(s).stem),
        "diagnosis": pd.to_numeric(df[g_col], errors="coerce"),
    })
    out = out.dropna(subset=["diagnosis"])
    out["diagnosis"] = out["diagnosis"].astype(int)
    return out


def load_messidor1(xls_dir: Path) -> pd.DataFrame:
    frames = []
    sheets = sorted(xls_dir.glob("*.xls")) + sorted(xls_dir.glob("*.xlsx"))
    if not sheets:
        raise SystemExit(f"[ERROR] No hay .xls/.xlsx en {xls_dir}")
    for s in sheets:
        d = pd.read_excel(s)
        id_col = _pick(d, ID_COLS)
        g_col = _pick(d, GRADE_COLS)
        frames.append(pd.DataFrame({
            "id_code": d[id_col].astype(str).map(lambda x: Path(x).stem),
            "diagnosis": pd.to_numeric(d[g_col], errors="coerce"),
        }))
    out = pd.concat(frames, ignore_index=True).dropna(subset=["diagnosis"])
    out["diagnosis"] = out["diagnosis"].astype(int)
    # Messidor-1 usa 0..3; 0 sigue siendo normal -> la binarización es idéntica.
    return out


def find_image(images_dir: Path, id_code: str) -> Path | None:
    for ext in IMG_EXTS:
        p = images_dir / f"{id_code}{ext}"
        if p.exists():
            return p
    hits = list(images_dir.glob(f"{id_code}.*"))
    return hits[0] if hits else None


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--source", choices=["messidor2", "messidor1"], default="messidor2")
    ap.add_argument("--csv", type=Path, help="messidor2: CSV con grado adjudicado")
    ap.add_argument("--xls-dir", type=Path, help="messidor1: carpeta con Base11..Base34 .xls")
    ap.add_argument("--images", required=True, type=Path, help="carpeta con las imágenes")
    ap.add_argument("--output", type=Path, default=Path("messidor_extracted"))
    ap.add_argument("--copy-images", action="store_true",
                    help="copiar imágenes a output/images (default: solo verificar presencia)")
    args = ap.parse_args()

    if args.source == "messidor2":
        if not args.csv:
            raise SystemExit("[ERROR] --csv requerido para messidor2")
        df = load_messidor2(args.csv)
    else:
        if not args.xls_dir:
            raise SystemExit("[ERROR] --xls-dir requerido para messidor1")
        df = load_messidor1(args.xls_dir)

    # filtra a imágenes realmente presentes y registra extensión
    rows, missing = [], []
    for r in df.itertuples(index=False):
        p = find_image(args.images, r.id_code)
        if p is None:
            missing.append(r.id_code)
            continue
        rows.append({"id_code": r.id_code, "diagnosis": int(r.diagnosis), "ext": p.suffix})

    if not rows:
        raise SystemExit("[ERROR] Ninguna imagen del CSV se encontró en --images")

    out_df = pd.DataFrame(rows)
    args.output.mkdir(parents=True, exist_ok=True)
    out_df[["id_code", "diagnosis", "ext"]].to_csv(args.output / "labels.csv", index=False)

    if args.copy_images:
        dst = args.output / "images"
        dst.mkdir(parents=True, exist_ok=True)
        for r in out_df.itertuples(index=False):
            src = find_image(args.images, r.id_code)
            shutil.copy2(src, dst / f"{r.id_code}{r.ext}")

    counts = out_df["diagnosis"].value_counts().sort_index().to_dict()
    n_norm = int((out_df["diagnosis"] == 0).sum())
    n_path = int((out_df["diagnosis"] != 0).sum())
    print(f"[OK] labels.csv -> {args.output/'labels.csv'}")
    print(f"     N={len(out_df)}  normales={n_norm}  patológicas={n_path}")
    print(f"     grados={counts}")
    if missing:
        (args.output / "missing.txt").write_text("\n".join(missing))
        print(f"     faltantes (sin imagen)={len(missing)} -> {args.output/'missing.txt'}")
    if not args.copy_images:
        print(f"[i] Imágenes NO copiadas. Pasá --images {args.images} a los run_*.py")


if __name__ == "__main__":
    main()
