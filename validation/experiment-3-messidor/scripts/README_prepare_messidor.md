# prepare_messidor_dataset.py

Normaliza Messidor (1 o 2) al formato que consumen los `run_messidor_*.py`:
`labels.csv` con columnas `id_code, diagnosis[, ext]`, escala ICDR 0..4
(0 = normal, idéntico criterio binario que APTOS).

## Descarga (manual — requiere registro)

Messidor **no** se descarga por script. Fuentes:

- **Messidor-2** (recomendado, es el referido en el REPORT de APTOS §8.5):
  ADCIS — <https://www.adcis.net/en/third-party/messidor2/>.
  Imágenes (~1748) + un CSV de grado **adjudicado** 0..4 (Krause et al. 2018 /
  Abràmoff). Algunas redistribuciones traen el CSV como `messidor_data.csv`.
- **Messidor-1** (original, 1200 img): ADCIS — <https://www.adcis.net/en/third-party/messidor/>.
  12 planillas `Base11.xls`..`Base34.xls` con `Image name` y `Retinopathy grade` 0..3.

> Las imágenes van a `validation/data/` o `validation/datasets/` (gitignored).
> El modelo `detection-v2.0.0.onnx` vive en `validation/models/` (gitignored).

## Uso

Messidor-2:

```bash
python prepare_messidor_dataset.py \
  --source messidor2 \
  --csv   ../../data/messidor2/messidor_data.csv \
  --images ../../data/messidor2/IMAGES \
  --output messidor_extracted
```

Messidor-1:

```bash
python prepare_messidor_dataset.py \
  --source messidor1 \
  --xls-dir ../../data/messidor1/annotations \
  --images  ../../data/messidor1/images \
  --output  messidor_extracted
```

- Sin `--copy-images`: solo arma `labels.csv` (incluye la extensión real de cada
  imagen) y verifica presencia. Pasá `--images <ruta original>` a los `run_*.py`.
- Con `--copy-images`: además copia las imágenes a `messidor_extracted/images/`.

## Salida

```
messidor_extracted/
├── labels.csv        # id_code, diagnosis(0..4), ext
├── missing.txt       # ids del CSV sin imagen (si los hubo)
└── images/           # solo si --copy-images
```

## Detección de columnas

Tolerante a may/min y variantes: id ∈ {id_code, image, Image name, filename, ...},
grado ∈ {adjudicated_dr_grade, dr_grade, diagnosis, Retinopathy grade, grade, ...}.
Si tu CSV usa otros nombres, renombralos o editá `ID_COLS`/`GRADE_COLS`.

## Dependencias

`pandas`, `openpyxl`/`xlrd` (solo messidor1, para leer .xls). Las imágenes las cargan
los `run_*.py` con `opencv`.
