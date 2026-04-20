# prepare_aptos_dataset.py

Prepara dataset APTOS 2019 para marcadores humanos.

## Qué hace

1. Lee CSV de APTOS (`id_code`, `diagnosis`).
2. Selecciona **500 imágenes** con cuotas estratificadas (seed=42):
   - Grado 4: 100
   - Grado 3: 150
   - Grado 2: 200
   - Grado 0: 50
   - Grado 1: resto hasta 500
3. Divide en **N splits disjuntos** (default 3) preservando proporción de grados (round-robin estratificado).
4. Copia imágenes a `output/markerN/images/` + genera `labels.csv`.
5. Comprime cada carpeta en `output/markerN.zip` listo para enviar.

## Uso

```bash
python prepare_aptos_dataset.py \
  --csv path/to/train.csv \
  --images path/to/train_images/ \
  --output path/to/salida/ \
  --seed 42 \
  --n-markers 3
```

## Salida

```
output/
├── selected_images.csv       # 500 imágenes elegidas
├── marker1/
│   ├── images/*.png
│   └── labels.csv
├── marker1.zip
├── marker2/ ...
├── marker2.zip
├── marker3/ ...
└── marker3.zip
```

Cada `markerN.zip` → un marcador. Splits disjuntos: ninguna imagen se repite entre marcadores.

## Dependencias

`pandas`, `tqdm` (stdlib: `shutil`, `zipfile`, `argparse`).
