#!/usr/bin/env python3
"""
Validador standalone del DIRD+ model card v2.0.

Uso:
    python3 scripts/validate_model_card.py path/to/my-model.json
    python3 scripts/validate_model_card.py path/to/my-model.json --onnx path/to/my-model.onnx

Exit codes:
    0  = válido
    1  = inválido (errores en stdout)
    2  = error de entrada (archivo no encontrado, JSON malformado)

La validación de schema replica la implementada en
`src/lib/ai/model-card-validator.ts`. Si pasas `--onnx`, se ejecuta además un
sanity check con onnxruntime sobre un tensor de ceros del shape declarado.
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any

SEVERITY_ALLOWED = {
    "landmark", "mild", "mild-moderate", "moderate", "moderate-severe", "severe",
}
NORMALIZE_ALLOWED = {"divide_by_255", "imagenet"}
COLOR_ORDER_ALLOWED = {"RGB", "BGR"}
OUTPUT_FORMAT_ALLOWED = {"yolo_end2end_v2", "yolo_v8_native"}


class Errors:
    def __init__(self) -> None:
        self.items: list[tuple[str, str]] = []

    def add(self, path: str, msg: str) -> None:
        self.items.append((path, msg))

    def __bool__(self) -> bool:
        return bool(self.items)


def require_str(d: dict, key: str, errors: Errors, parent: str) -> str | None:
    v = d.get(key)
    if not isinstance(v, str) or not v:
        errors.add(f"{parent}.{key}", "string requerido")
        return None
    return v


def require_int_array(d: dict, key: str, length: int, errors: Errors, parent: str) -> list[int] | None:
    v = d.get(key)
    if not (isinstance(v, list) and len(v) == length and all(isinstance(x, int) for x in v)):
        errors.add(f"{parent}.{key}", f"array de {length} enteros requerido")
        return None
    return v


def validate_input(raw: Any, errors: Errors) -> dict | None:
    if not isinstance(raw, dict):
        errors.add("input", "objeto requerido")
        return None
    tname = require_str(raw, "tensor_name", errors, "input")
    shape = require_int_array(raw, "shape", 4, errors, "input")
    layout = raw.get("layout")
    if layout != "NCHW":
        errors.add("input.layout", 'debe ser "NCHW"')
    dtype = raw.get("dtype")
    if dtype != "float32":
        errors.add("input.dtype", 'debe ser "float32"')
    prep = raw.get("preprocessing")
    if not isinstance(prep, dict):
        errors.add("input.preprocessing", "objeto requerido")
        return None
    resize = require_int_array(prep, "resize_to", 2, errors, "input.preprocessing")
    lb = prep.get("letterbox")
    if not isinstance(lb, bool):
        errors.add("input.preprocessing.letterbox", "bool requerido")
    lbc = require_int_array(prep, "letterbox_color", 3, errors, "input.preprocessing")
    norm = prep.get("normalize")
    if norm not in NORMALIZE_ALLOWED:
        errors.add("input.preprocessing.normalize", f"debe ser uno de: {sorted(NORMALIZE_ALLOWED)}")
    co = prep.get("color_order")
    if co not in COLOR_ORDER_ALLOWED:
        errors.add("input.preprocessing.color_order", f"debe ser uno de: {sorted(COLOR_ORDER_ALLOWED)}")

    if shape:
        if shape[0] != 1:
            errors.add("input.shape[0]", "batch debe ser 1")
        if shape[1] != 3:
            errors.add("input.shape[1]", "channels debe ser 3 (RGB)")
        if resize and (shape[2] != resize[0] or shape[3] != resize[1]):
            errors.add("input.shape", "shape[H,W] debe coincidir con preprocessing.resize_to")

    if not all([tname, shape, resize, lbc, norm in NORMALIZE_ALLOWED, co in COLOR_ORDER_ALLOWED]):
        return None

    return {
        "tensor_name": tname,
        "shape": shape,
        "layout": layout,
        "dtype": dtype,
        "preprocessing": {
            "resize_to": resize,
            "letterbox": lb,
            "letterbox_color": lbc,
            "normalize": norm,
            "color_order": co,
        },
    }


def validate_output(raw: Any, errors: Errors) -> dict | None:
    if not isinstance(raw, dict):
        errors.add("output", "objeto requerido")
        return None
    tname = require_str(raw, "tensor_name", errors, "output")
    fmt = raw.get("format")
    if fmt not in OUTPUT_FORMAT_ALLOWED:
        errors.add("output.format", f"debe ser uno de: {sorted(OUTPUT_FORMAT_ALLOWED)}")
    md = raw.get("max_detections")
    if md is not None and not isinstance(md, int):
        errors.add("output.max_detections", "entero opcional")
    if not tname or fmt not in OUTPUT_FORMAT_ALLOWED:
        return None
    return {"tensor_name": tname, "format": fmt, "max_detections": md}


def validate_classes(raw: Any, errors: Errors) -> list[dict] | None:
    if not isinstance(raw, list) or not raw:
        errors.add("classes", "array no vacío requerido")
        return None
    seen: set[int] = set()
    result: list[dict] = []
    for i, c in enumerate(raw):
        if not isinstance(c, dict):
            errors.add(f"classes[{i}]", "objeto requerido"); continue
        cid = c.get("id")
        if not isinstance(cid, int):
            errors.add(f"classes[{i}].id", "entero requerido"); continue
        if cid in seen:
            errors.add(f"classes[{i}].id", f"id duplicado: {cid}"); continue
        seen.add(cid)
        name = require_str(c, "name", errors, f"classes[{i}]")
        if name is None: continue
        sev = c.get("severity")
        if sev is not None and sev not in SEVERITY_ALLOWED:
            errors.add(f"classes[{i}].severity", f"valor inválido: {sev}")
        result.append({"id": cid, "name": name, "severity": sev})
    return result


def validate_card(raw: Any) -> tuple[Errors, dict | None]:
    errors = Errors()
    if not isinstance(raw, dict):
        errors.add("$", "el model card debe ser un objeto JSON")
        return errors, None

    if raw.get("schema_version") != "2.0":
        errors.add("schema_version", 'debe ser "2.0"')

    name = require_str(raw, "name", errors, "$")
    version = require_str(raw, "version", errors, "$")
    license_ = require_str(raw, "license", errors, "$")

    inp = validate_input(raw.get("input"), errors)
    out = validate_output(raw.get("output"), errors)
    cls = validate_classes(raw.get("classes"), errors)

    pct = raw.get("per_class_thresholds")
    if pct is not None:
        if not isinstance(pct, dict):
            errors.add("per_class_thresholds", "objeto opcional")
        elif cls:
            names = {c["name"] for c in cls}
            for k, v in pct.items():
                if k not in names:
                    errors.add(f"per_class_thresholds.{k}", f'clase "{k}" no declarada en classes[]')
                if not isinstance(v, (int, float)) or not (0 <= v <= 1):
                    errors.add(f"per_class_thresholds.{k}", "umbral debe ser número en [0,1]")

    dct = raw.get("default_confidence_threshold")
    if dct is not None and (not isinstance(dct, (int, float)) or not (0 <= dct <= 1)):
        errors.add("default_confidence_threshold", "número en [0,1]")

    if errors or not all([name, version, license_, inp, out, cls]):
        return errors, None

    return errors, {
        "name": name, "version": version, "license": license_,
        "input": inp, "output": out, "classes": cls,
    }


def sanity_check_onnx(onnx_path: Path, card: dict) -> Errors:
    """Carga el ONNX, alimenta zeros del shape declarado, valida output."""
    errors = Errors()
    try:
        import numpy as np
        import onnxruntime as ort
    except ImportError as e:
        errors.add("$onnx", f"sanity check requiere onnxruntime + numpy: {e}")
        return errors

    try:
        sess = ort.InferenceSession(str(onnx_path), providers=["CPUExecutionProvider"])
        in_names = [i.name for i in sess.get_inputs()]
        out_names = [o.name for o in sess.get_outputs()]
        if card["input"]["tensor_name"] not in in_names:
            errors.add("$onnx", f'input "{card["input"]["tensor_name"]}" no existe. Disponibles: {in_names}')
        if card["output"]["tensor_name"] not in out_names:
            errors.add("$onnx", f'output "{card["output"]["tensor_name"]}" no existe. Disponibles: {out_names}')
        if errors:
            return errors

        shape = tuple(card["input"]["shape"])
        x = np.zeros(shape, dtype=np.float32)
        outputs = sess.run([card["output"]["tensor_name"]], {card["input"]["tensor_name"]: x})
        out_shape = outputs[0].shape
        if card["output"]["format"] == "yolo_end2end_v2":
            if len(out_shape) != 3 or out_shape[0] != 1 or out_shape[2] != 6:
                errors.add("$onnx.output_shape",
                           f"esperado [1,N,6] para yolo_end2end_v2, recibido {out_shape}")
    except Exception as e:
        errors.add("$onnx", f"excepción durante carga/inferencia: {e}")
    return errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Valida un DIRD+ model card v2.0.")
    parser.add_argument("card", help="Ruta al archivo .json del model card.")
    parser.add_argument("--onnx", help="Ruta al .onnx para sanity check de inferencia.", default=None)
    parser.add_argument("--quiet", action="store_true", help="Solo exit code, sin output salvo errores.")
    args = parser.parse_args()

    card_path = Path(args.card)
    if not card_path.exists():
        print(f"ERROR: archivo no encontrado: {card_path}", file=sys.stderr)
        return 2
    try:
        raw = json.loads(card_path.read_text())
    except json.JSONDecodeError as e:
        print(f"ERROR: JSON malformado: {e}", file=sys.stderr)
        return 2

    errors, card = validate_card(raw)

    if args.onnx and card:
        onnx_path = Path(args.onnx)
        if not onnx_path.exists():
            print(f"ERROR: .onnx no encontrado: {onnx_path}", file=sys.stderr)
            return 2
        onnx_errors = sanity_check_onnx(onnx_path, card)
        errors.items.extend(onnx_errors.items)

    if errors:
        if not args.quiet:
            print(f"❌ Validación falló ({len(errors.items)} errores):", file=sys.stderr)
            for path, msg in errors.items:
                print(f"  {path}: {msg}", file=sys.stderr)
        return 1

    if not args.quiet:
        print(f"✅ Model card válido: {card['name']} v{card['version']}")
        if args.onnx:
            print(f"   Sanity check ONNX: OK")
    return 0


if __name__ == "__main__":
    sys.exit(main())
