# prepare_ddr_dataset.py

Normaliza la parte **DR_grading** del DDR-dataset al formato del pipeline:
`ddr_extracted/labels.csv` con columnas `id_code, diagnosis(0..4), relpath, split`
(0 = normal, mismo criterio binario que APTOS). Las imágenes ungradable (grado 5) se descartan.

## Por qué DDR

Población **china**, 147 hospitales, 42 tipos de cámara → genuino *shift de
población/cámara* respecto de APTOS (India). Imágenes **crudas** (no preprocesadas)
→ sin el confounder del mirror de Messidor. Es el 2º dataset externo limpio para la
generalización OOD (ver auditoría de rigor en exp-2 §11.2 #3).

## Descarga (manual, sin formulario)

Fuentes públicas:
- GitHub oficial: <https://github.com/nkicsl/DDR-dataset> (zip en 10 chunks vía Google/Baidu Drive;
  unir con `cat DDR-dataset.zip.0* > DDR-dataset.zip && unzip DDR-dataset.zip`)
- Espejo HuggingFace: <https://huggingface.co/datasets/ctmedtech/DDR-dataset>

Solo se necesita la carpeta **`DR_grading/`** (clasificación a nivel imagen). Estructura:

```
DR_grading/
├── train.txt   # líneas: "<filename> <grade>"
├── valid.txt
├── test.txt
├── train/<filename>
├── valid/<filename>
└── test/<filename>
```

Ponerla en `validation/data/ddr/` (gitignored).

## Uso

```bash
python prepare_ddr_dataset.py \
  --grading-dir ../../data/ddr/DR_grading \
  --output ../ddr_extracted
```

- `relpath` queda relativo a `--grading-dir`; los `run_*.py` cargan `grading_dir / relpath`
  (no se aplanan ni recomprimen las imágenes crudas).
- `--keep-ungradable` para conservar grado 5 (default: descartar).

## Salida

```
ddr_extracted/
├── labels.csv     # id_code, diagnosis, relpath, split
└── missing.txt    # entradas del .txt sin imagen (si las hubo)
```

## Dependencias

`pandas`. Las imágenes las cargan los `run_*.py` con `opencv`.
