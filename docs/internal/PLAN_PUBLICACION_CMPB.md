# DIRD+ → Computer Methods and Programs in Biomedicine (CMPB) — Plan en pasos

Creado: 2026-10-24 · Revisión 2 (mismo día): ruta **B+** — detector v3 reentrenado con procedencia limpia y
teselado, grader v1, backend nativo `ort`, proyecto Annotix auditable público. Cronograma **8 semanas**
(26-oct → 18-dic-2026). Documento único de publicación; el plan SoftwareX previo está fusionado en los anexos A–E.
Todo lo que aquí se afirma se verificó contra el repo (`Dird` v2.2.1, `dird_models`, `Annotix` 2.10.3), el
preprint (`dird_preprint_v2.pdf`), PubMed y textos completos de artículos de CMPB.

Convenciones: **[DoD]** = criterio de "hecho" verificable · **[R]** = responsable · **[dep]** = dependencia ·
🔴 bloqueante / 🟡 importante / 🟢 opcional / ❌ descartado.

---

## 0. Revista: por qué CMPB y qué exige

### 0.1 Decisión

| | SoftwareX (descartada) | **CMPB (elegida)** |
|---|---|---|
| Costo | 1.920 USD APC obligatorio | **0 USD** vía suscripción (híbrida); OA opcional 3.180 USD (no hay presupuesto) |
| Indexación | Scopus Q2; JCR IF 1,9, cuartil WoS probable Q3 | JCR **Q1**, IF ≈ 4,8 (5 años 5,4); CiteScore ≈ 12 |
| Scope | Software científico general | "formal computing methods and **software systems** for biomedical research and practice… promotes distributing demonstrable software to avoid duplication of effort" |
| Formato | Plantilla fija 5 secciones, 4.000 palabras | Artículo regular IMRyD, ≤ 3.500 palabras sin abstract |
| Precedente de software abierto + datos públicos, sin estudio de usuarios ni ética | Sí | **Sí** (§0.3) |

Plan B de revista si CMPB rechaza en *desk*: Journal of Medical Systems (Springer, híbrida) → SoftwareX OSP.
JOSS (0 USD, sin Scopus/WoS) solo como DOI citable del software, en paralelo.

### 0.2 Requisitos CMPB (guía de autores; el sitio bloquea descarga automática → **releer a mano en
ScienceDirect en la semana 6, antes de cerrar el borrador**)

| Ítem | Requisito | Impacto |
|---|---|---|
| Tipo de artículo | *Original Research* (no hay tipo "software") | IMRyD: Introduction · Methods · Results · Discussion · Conclusions |
| Palabras | **≤ 3.500** excluyendo abstract | La arquitectura va a Methods, no a sección propia |
| Abstract | **≤ 350 palabras, estructurado**: Background and Objective / Methods / Results / Conclusions | Con números: AUC externo con IC, latencia, n |
| Referencias | ≤ 50 | Datasets, TRIPOD+AI, herramientas comparadas, guías clínicas, Annotix |
| Figuras/tablas | Sin límite declarado | Mantener ≤ 6 figuras + ≤ 4 tablas |
| Highlights | 3–5 viñetas ≤ 85 caracteres (estándar Elsevier; confirmar) | Redactar al final |
| Graphical abstract | Opcional | Reusar Fig. 2 |
| Declaraciones | Competing interests · Funding · Data availability · CRediT · Declaration of generative AI use | Ver P7.2 |
| Ética | Datos públicos anonimizados; los lectores de Annotix son coautores (investigadores, no sujetos) → "ethics approval not required" (precedente ECGMiner) | **Sin comité** |
| Código | GitHub + DOI Zenodo; citar en Methods y Data availability | Tres depósitos: app, modelos, anotaciones |
| Envío | Editorial Manager `editorialmanager.com/cmpb`; opción **subscription** | 0 USD; preprint medRxiv cubre acceso verde |

### 0.3 Precedentes verificados en CMPB (PubMed, 2023–2026)

| Año | Paper | Tipo de evidencia | Estudio de usuarios | Ética |
|---|---|---|---|---|
| 2024 | **ECGMiner** — software open-source (PMID 38340566) | **Texto completo revisado (25 págs.)**: validado solo en LUDB y PTB-XL (públicos) | **Ninguno** | **Ninguna** |
| 2023 | BRAVEHEART — software open-source GPLv3 (37734217) | Texto completo (preprint): descripción + GitHub | Ninguno | IRB solo porque usaron ECG propios del hospital |
| 2026 | SpheroSeg — plataforma open-source DL (42612557) | Abstract: benchmark con IC bootstrap, in-dist vs OOD | Ninguno | — |
| 2026 | BoneMesh — módulo 3D Slicer open-source (41966796) | Abstract: comparación vs software comercial | Ninguno | — |
| 2025 | HistoColAi — plataforma web anotación + IA (39813900) | Caso de uso + usabilidad | Sí | — |
| 2025 | DECODE — plataforma cloud open-source (40902337) | Dice en datasets + SUS/TAM | Sí | — |
| 2026 | EchoAI — CDSS web con revisión humana (42263543) | Multicéntrico, 18 cardiólogos, 86 % aceptación sin modificar | Sí | Sí |

Patrón mínimo aceptado: *software abierto + validación cuantitativa en datos públicos + comparación con
alternativas + limitaciones honestas*. RD está en scope (14 artículos 2019–2026) pero **ninguno es una plataforma
de software para tamizaje** → hueco.

---

## 1. Hallazgos de auditoría (repo, 2026-10-24)

| # | Hallazgo | Evidencia | Consecuencia |
|---|---|---|---|
| H1 | **La inferencia corre en `onnxruntime-web` (WASM) dentro del webview de Tauri. No hay ONNX Runtime nativo.** | `package.json` → `onnxruntime-web ^1.23.2`; `src-tauri/Cargo.toml` sin crate `ort`; `model-registry.ts` usa `executionProviders: ['wasm']` | **Decidido (§6-1): backend nativo `ort` en Rust (P4.1)**; WASM queda como fallback y brazo de comparación en E11 |
| H2 | **El preprocesamiento documentado no es el implementado.** Spec dice letterbox gris 114; app y scripts de validación hacen *resize* directo a 640×640 | `model-interface.md` §3.2 vs `onnx-manager.ts:156-195` y `run_aptos_binary_experiment.py:42` | Corregir la spec. El detector v3 teselado y el grader usan **una sola función de preprocesado, replicada en Python, TS y Rust, con test de paridad** |
| H3 | El validador de fichas solo acepta `schema_version "2.0"` y `format ∈ {yolo_end2end_v2, yolo_v8_native}` | `model-card-validator.ts:32,155,205` | `schema_version "2.1"`: `role`, `format "classifier_v1"`, bloque `inference.tiling` |
| H4 | El registro de modelos tiene **un solo modelo activo** | `src-tauri/src/models.rs:172` | Activo por rol (`detector` / `grader`) |
| H5 | La sesión guarda `modelVersions.{detection, segmentation}`; el PDF imprime solo `detection` | `schema.ts:28-31`, `report-generator.ts:279` | Añadir `classification`; `.dird` y PDF |
| H6 | Ya existe un "clasificador" en `src/lib/analysis/*classifier*`: es el motor de guías por reglas | `image-dr-classifier.ts` | Nuevo componente = **`image-grader`**; en el paper: "lesion detector" + "image-level grader" + "guideline engine" |
| H7 | `Cargo.toml` con metadatos placeholder (`0.1.0`, `"A Tauri App"`, `authors ["you"]`) | `src-tauri/Cargo.toml:1-9` | Corregir antes de v3.0.0 |
| H8 | `ROADMAP.md` desactualizado (v2.0 sin marcar, v2.2.1 liberado) | `ROADMAP.md` | Auditoría (P5.5) |
| H9 | **No existe `CITATION.cff`**; DOIs inconsistentes (19666272 / 19687226 / 19685466) | `README.md:16,512,534` | DOI de concepto único + DOI de versión |
| H10 | `REFERENCES.md` sin IDRiD, APTOS ni DDR | `grep` | Añadir Porwal 2020, Li 2019, APTOS/Kaggle |
| H11 | **Sin GPU local** (AMD Renoir, 13 GB); `torch` no instalado | `lspci`, `free` | Entrenar en **Kaggle** (API disponible, §6-3) |
| H12 | `node_modules` ausente → `vitest` no corre | `ERR_MODULE_NOT_FOUND` | `pnpm install` antes de E12 |
| H13 | Detector v2: preprint dice **YOLOv26n, 500 APTOS pseudoetiquetadas, 120 épocas**; ficha dice YOLOv26s; `MODEL_CARD.md` §4–5 "TODO"; **IDs probablemente irrecuperables** | preprint líneas 215–249 | **Decidido (§6-6): reentrenar detector v3 con procedencia limpia (E14).** v2 se documenta como "trained on 500 APTOS images, IDs not recoverable" y queda como baseline histórico |
| H14 | IDRiD-grading/localization (516) y IDRiD-segmentation (81) no están completos en disco; **DDR lesion-detection (757 imgs con cajas) tampoco** | `validation/data/ddr/DDR-dataset/` solo tiene `DR_grading` | Descargar en semana 1 (P1.6) |
| H15 | Figuras SVG del preprint existen y son editables | `~/Escritorio/Archivo_disco_duro_2026-10-16/Publicaciones/preparación/Dird/` | Base para Figs. 1–2 |
| H16 | Preprint: 9 autores; correspondencia F. López; financiamiento "INES-52" | preprint | **Decidido (§6-2): 6 autores** |
| H17 | **Annotix** tiene lo necesario para un pipeline auditable: `audit.jsonl` con cadena SHA-256, lectura múltiple cegada, acuerdo entre evaluadores (κ/IoU/Dice), teselado con solape, contrato de modelo, export YOLO/COCO | `Annotix/docs/audit-log.md`, `lectura-multiple.md`, `acuerdo-evaluadores.md`, `src-tauri/src/augment/tiling.rs` | Pipeline E14 se ejecuta **dentro de Annotix** y el proyecto se publica (P2.4) |
| H18 | Annotix **no hace inferencia por teselas** (lo declara su propio código) | `tiling.rs` cabecera | La inferencia teselada se implementa en DIRD+ (`ort` nativo, P4.1) |
| H19 | Annotix **no tiene archivo `LICENSE`** en la raíz (badge dice MIT) | `ls Annotix/` | Arreglar antes de publicar el proyecto auditable (P2.4) |

---

## 2. Diseño técnico de E14 — detector v3 (procedencia limpia + teselado)

**Datos (todos públicos, ninguno de APTOS):**

| Fuente | n | Aporta | Licencia |
|---|---|---|---|
| DDR lesion-detection (train 383 + val 149; test 225 reservado) | 532 | Cajas oficiales MA, HE, EX, SE; 42 cámaras, China | Investigación, sin redistribuir imágenes |
| IDRiD segmentation (train 54; test 27 reservado) | 54 | Máscaras MA, HE, EX, SE, OD → cajas por componente conexo | CC BY 4.0 |
| IDRiD localization (train 413; test 103 reservado) | 413 | Centro de OD y fóvea → caja sintética (OD: diámetro real; fóvea: 0,5 diámetro de disco) | CC BY 4.0 |
| DDR (las 532 anteriores) | 532 | **OD y fóvea no anotados** → pseudoetiquetas con v2 (mAP OD 0,995), revisadas en Annotix por dos lectores cegados | — |

**Clases v3 (7):** `optic_disc`, `fovea`, `microaneurysm`, `hemorrhage`, `hard_exudate`, `cotton_wool_spot`,
más `microhemorrhages` **eliminada** (MA y HE separados: cierra el *known issue* de v2). Mapeo a guías vía
`class_mapping`.

**Normalización de escala antes de teselar:** reescalar cada imagen para que el diámetro de la retina mida
1.600 px (medido con el círculo de P1.3); luego teselas 640×640 con solape 20 % (Annotix: rejilla filas × columnas
+ solape); teselas vacías: conservar 20 % (política de Annotix). Sin esto un MA de DDR (2.400 px) y uno de IDRiD
(4.288 px) tienen tamaños distintos.

**Inferencia en DIRD+ (dos pasadas, en `ort` nativo):** pasada global a 640 para OD/fóvea; pasada teselada
(misma normalización y solape) para lesiones; NMS global por clase al unir; coordenadas devueltas a la imagen
original. Declarado en la ficha (`inference.tiling`, §3). WASM fallback ejecuta lo mismo, más lento (E11 lo mide).

**Entrenamiento (Kaggle):** YOLO26s (y n como alternativa liviana), 3 semillas, early stopping en DDR-det val.
Reportar mAP50 por clase en DDR-det test (225) e IDRiD-seg test (27). Comparar con v2 en los mismos tests.

**Qué cambia en la validación de imagen (exp-1…5 se re-corren con v3, scripts existen):**

| Conjunto | Para detector v3 | Para grader v1 |
|---|---|---|
| APTOS 2019 (3.662) | **Externo limpio** (v3 no lo ve) → exp-2 recupera validez | Entrenamiento |
| DDR grading minus las 757 de detection | Externo | train/val/**test** |
| IDRiD grading (516) | Interno (usado para OD/fóvea) | Externo |
| Messidor-2 | Externo | Externo |
| DDR-det test (225), IDRiD-seg test (27) | Test por lesión (mAP) | — |

**Métricas de supervisión (Annotix, van a Results):** n pseudoetiquetas revisadas (532 × 2), % aceptadas /
editadas / rechazadas por lector, κ (presencia) e IoU medio (caja) entre Almendras y Leiva, n adjudicadas.

---

## 3. Fases y pasos (8 semanas)

### Fase 1 — Semana 1 (26-oct → 1-nov): datos, higiene, E0, plan de análisis

**P1.1 🔴 Cerrar diseño** [R: Baier] [DoD: §2 y §6 commiteados] — este documento.

**P1.2 🔴 Corregir spec de preprocesado** [R: Baier] [DoD: `model-interface.md` §3.2 = resize directo /255; spec v2.1 iniciada con `inference.tiling`]

**P1.3 🔴 Preprocesado único en 3 lenguajes** [R: Baier] [dep: P1.2]
- `validation/scripts/preprocess_fundus.py`: `retina_circle(img) → (cx, cy, r)` (umbral canal rojo), `normalize_scale(img, r, target_diameter=1600)`, `tile(img, 640, overlap=0.2)`, `preprocess_grader(img)` (recorte + pad + 512 /255), `preprocess_detector_global(img)` (640 /255).
- Espejos: `src/lib/image-processing/preprocess.ts` (WASM fallback) y `src-tauri/src/preprocess.rs` (nativo, crate `image`).
- Test de paridad: 5 imágenes demo, tensores Python ↔ TS ↔ Rust, diferencia ≤ 1/255; incluye la rejilla de teselas (mismas coordenadas).
- [DoD: paridad verde en vitest y `cargo test`]

**P1.4 🔴 Procedencia del detector v2 — cierre** [R: Uribe] [DoD: `dird_models/MODEL_CARD.md` §4–5 rellenados con lo que haya; si no hay IDs: "500 APTOS 2019 images, pseudo-labeled; image IDs not recoverable"]
- Intentar `torch.load(best.pt)['train_args']` y contar parámetros (n vs s). Una tarde, no más.

**P1.5 🔴 E0 — exp-2 reetiquetado** [R: Baier] [dep: P1.4] — cabecera de `experiment-2-aptos/REPORT.md`: "in-distribution para v2; externo para v3 (ver E14)". `validation/README.md`, `TRIPOD-AI-mapping.md`. [DoD: ningún archivo llama "externo/OOD" a APTOS respecto a v2]

**P1.6 🔴 Descargas** [R: Uribe] [DoD: en `validation/data/`: `ddr/DDR-dataset/lesion_detection/` (757 + XML), `idrid/segmentation/`, `idrid/localization/`, `idrid/grading/`; hashes en `DATA_CARD.md`]
- Seguimiento a ADCIS por Messidor-2 crudo (formulario 2026-06).

**P1.7 🔴 `DATA_CARD.md` + splits congelados** [R: Uribe] [dep: P1.6] [DoD: `validation/data/splits/*.csv` commiteados **antes** del primer entrenamiento]
1. Deduplicación pHash (≤ 4) dentro y entre APTOS, DDR (grading + detection), IDRiD, Messidor-2 → `duplicates.csv`.
2. `ddr_detection_ids.csv` (757) → excluidos del DDR-grading test del detector.
3. DDR grado 5 fuera del entrenamiento del grader; `ddr_ungradable.csv` para E10.
4. Grader: APTOS 85/15 estratificado (semilla 42) + DDR-grading oficial.
5. Detector v3: splits oficiales DDR-det e IDRiD; verificar que ningún nombre cruza train/test.
6. Baseline de atajos (E9a): logística sobre [alto, ancho, % negro] → AUC derivable.

**P1.8 🔴 Pseudoetiquetas OD/fóvea en DDR-det** [R: Uribe] [dep: P1.6] [DoD: proyecto Annotix `dird-detector-v3` creado con 532 imágenes DDR-det + 54 IDRiD-seg + 413 IDRiD-loc, cajas oficiales importadas (COCO), pseudoetiquetas v2 importadas como predicciones pendientes, sesión con `replication: 2`]
- Script `validation/experiment-14-detector-v3/scripts/pseudo_label_landmarks.py` (v2 ONNX sobre las 532; solo clases 0 y 2; conf ≥ 0,5) → COCO.

**P1.9 🔴 Plan de análisis pre-registrado** [R: Baier · Barrientos] [DoD: `validation/ANALYSIS_PLAN.md` commiteado antes de inferir sobre cualquier test]
- Grader: outcome primario AUC derivable en DDR-grading test (IC 95 % bootstrap 2.000); secundarios QWK, sens a spec 0,80/0,90, ECE, sens por grado.
- Detector v3: mAP50 por clase en DDR-det test e IDRiD-seg test vs v2; AUC imagen en APTOS (externo), DDR-grading minus 757, Messidor-2; umbrales por clase fijados en DDR-det val y congelados.
- Fusión E8: reglas a priori. Supervisión Annotix: métricas a priori (§2).
- Puerta B/A (semana 4): grader AUC DDR-val ≥ 0,85 ∧ ≤ 60 ms nativo; detector v3 ≥ v2 en mAP50 medio de lesiones en DDR-det val **y** no peor en AUC imagen DDR-grading val. Si v3 falla → se publica v2 declarado (APTOS in-distribution).
- Opcional: depositar en OSF/Zenodo con fecha (TRIPOD+AI 13c).

**P1.10 🟡 Higiene** [R: Baier] — `pnpm install` + `vitest` verde; `Cargo.toml` real; `CITATION.cff` + DOI de concepto; `REFERENCES.md` (IDRiD, DDR, APTOS); `LICENSE` en Annotix (H19).

**P1.11 🔴 Autoría y financiamiento** [R: López] — comunicar lista de 6 (§6-2); CRediT borrador; texto oficial INES-52 a VIDCA.

**Hito semana 1:** datos en disco · splits congelados · proyecto Annotix abierto · plan de análisis commiteado · paridad verde.

---

### Fase 2 — Semana 2 (2 → 8-nov): lectura doble en Annotix · grader entrena · `ort` compila

**P2.1 🔴 Lectura cegada OD/fóvea** [R: Almendras · Leiva] [dep: P1.8] [DoD: 532 imágenes con dos lecturas entregadas; `audit.jsonl` íntegro]
- Cada lector: aceptar / mover / rechazar las dos cajas por imagen (~1,5 h por persona). No tocan cajas de lesiones.

**P2.2 🔴 Acuerdo y adjudicación** [R: Uribe] [dep: P2.1] [DoD: `results/annotix_agreement.json` con κ, IoU medio, n adjudicadas; capa consolidada cerrada]
- Desacuerdos (IoU < 0,5 o presencia distinta) → adjudica el tercer lector (Uribe) o reunión de 15 min.

**P2.3 🔴 Dataset v3 teselado** [R: Uribe] [dep: P2.2] [DoD: export YOLO desde Annotix con normalización de escala y teselas 640/20 %; `data.yaml`; hash del export en la ficha]
- Si Annotix no normaliza escala antes de teselar: hacerlo con `preprocess_fundus.py` **antes** de importar (documentar).

**P2.4 🔴 Proyecto Annotix auditable → repo público** [R: Uribe · Baier] [DoD: repo `Debaq/dird_annotations` con: proyecto Annotix sin imágenes (anotaciones, `readings`, consolidada, `audit.jsonl`, clases, teselado), `rebuild_dataset.py` que reconstruye desde descargas oficiales por nombre de archivo, `README` con licencias de origen y cita; depósito Zenodo tras v3]
- Imágenes **no** se redistribuyen (DDR lo prohíbe; uniformar).

**P2.5 🔴 Grader v1 — entrenamiento en Kaggle** [R: Uribe] [dep: P1.7] [DoD: `experiment-6-grader/results/runs.csv` con 9 corridas; `selection.md`]
- `kaggle datasets create` con DDR-grading limpio + splits (privado); APTOS desde la competencia. Notebooks en `experiment-6-grader/kaggle/`.
- Candidatos: YOLO26n/s-cls, EfficientNet-B0, MobileNetV3-L; 3 semillas; CE ponderada; augmentations leves; *temperature scaling* en DDR-val. Selección por AUC derivable DDR-val con latencia ORT CPU ≤ 60 ms.

**P2.6 🔴 `ort` compilando en CI** [R: Baier] [DoD: `release.yml` compila `src-tauri` con crate `ort` en Linux/Windows/macOS; `cargo test` de paridad Rust verde]
- Feature `download-binaries` o binarios vendorizados; si un SO falla, ese instalador sale WASM-only y se declara.

**Hito semana 2:** anotaciones adjudicadas · dataset v3 exportado · grader elegido · `ort` compila.

---

### Fase 3 — Semana 3 (9 → 15-nov): detector v3 entrena · E7 grader · contrato 2.1

**P3.1 🔴 Detector v3 — entrenamiento en Kaggle** [R: Uribe] [dep: P2.3] [DoD: `experiment-14-detector-v3/results/runs.csv` (YOLO26s y n × 3 semillas); mejor por mAP50 lesiones en DDR-det val; umbrales por clase fijados en val]
- Export ONNX end-to-end NMS, opset 14; input 640; output `[1, N, 6]` (formato `yolo_end2end_v2`, sin cambios de contrato para el detector).

**P3.2 🔴 E7 — validación externa del grader** [R: Barrientos · Baier] [dep: P2.5, P1.9] — DDR-grading test, IDRiD-grading, Messidor-2 (crudo o espejo con advertencia). Métricas con IC; comparación con v2 en los mismos subconjuntos. [DoD: `experiment-7-external/REPORT.md` + Fig. 5]

**P3.3 🔴 Contrato 2.1 en la app** [R: Baier] [DoD: tests verdes; dos roles activos]
1. `model-card-validator.ts`: `schema_version "2.1"`, `role`, `format "classifier_v1"`, `inference.tiling`; compatible con 2.0.
2. `models.rs`: activo por rol + migración.
3. `sanityCheckModel`: `[1,n]` y Σ ≈ 1 para grader; `[1,N,6]` para detector.
4. `src/lib/ai/image-grader.ts`.
5. `schema.ts` / `db-sql`: `gradeProbs`, `gradeModelVersion`, `referableProb`, `discrepancyFlag`; `modelVersions.classification`.
6. `model-interface.md` v2.1; `validate_model_card.py`; `example-card.json`.

**P3.4 🟡 E9 — ablación de atajos del grader** [R: Uribe] — sin recorte, 1 semilla.

**Hito semana 3:** v3 entrenado · E7 cerrado · contrato 2.1.

---

### Fase 4 — Semana 4 (16 → 22-nov): inferencia nativa teselada · re-validación con v3 · **puerta B/A**

**P4.1 🔴 Backend nativo `ort` con dos pasadas** [R: Baier] [dep: P2.6, P3.3] [DoD: inferencia nativa por defecto en los 3 SO; fallback WASM probado; ms/img registrados]
1. `src-tauri/src/inference.rs`: sesiones ORT por rol (`parking_lot::Mutex<Option<Session>>`), recarga al cambiar activo.
2. `infer_detector(image_bytes)`: pasada global 640 (OD/fóvea) + teselas (lesiones) + NMS global por clase → `Vec<[f32;6]>` en coordenadas originales. Parámetros desde `inference.tiling` de la ficha.
3. `infer_grader(image_bytes) → Vec<f32>`.
4. `src/lib/ai/inference-backend.ts`: `native` si el comando responde; si no, `onnxruntime-web` con el **mismo** teselado en TS. Ajuste en Settings para forzar WASM (E11).
5. `model-interface.md` §2: runtime nativo `ort` ≥ 1.18 con fallback WASM.

**P4.2 🔴 E14 — evaluación del detector v3** [R: Uribe · Barrientos] [dep: P3.1] [DoD: `experiment-14-detector-v3/REPORT.md`]
- mAP50 por clase en DDR-det test e IDRiD-seg test, v3 vs v2 (exp-1 pasa a ser este test; el REPORT antiguo queda como histórico de v2).
- Re-correr exp-2 (APTOS, ahora **externo** para v3), exp-3, exp-4 (DDR minus 757), exp-5 con v3: scripts existen, ≈ 2 h CPU. Umbrales por clase congelados de DDR-det val.

**P4.3 🔴 E8 — fusión grader + detector v3** [R: Baier · Barrientos] [dep: P3.2, P4.2] — reglas a priori; tasa y VPP de la bandera; derivables que ninguno detecta. [DoD: `experiment-8-fusion/REPORT.md`]

**P4.4 🔴 Puerta B/A** [DoD: acta en §7]
- Grader pasa ∧ v3 ≥ v2 → ruta **B+** completa.
- v3 < v2 → se publica v2 (declarado, APTOS in-distribution) + grader; v3 queda para Software Update.
- Grader falla → paper con detector (v3 o v2) y contrato 2.1 sin grader publicado.

**P4.5 🔴 Fichas y depósitos** [R: Uribe] — `dird_models/detector-v3.0.0.{onnx,json}`, `grader-v1.0.0.{onnx,json}` (schema 2.1, §3), `MODEL_CARD_*.md` TRIPOD+AI con datos explícitos y hash del export de Annotix; `dird_annotations` → Zenodo.

**Hito semana 4:** inferencia nativa funcionando · validación completa con v3 · decisión B/A.

---

### Fase 5 — Semana 5 (23 → 29-nov): fusión en guías, UI, E10–E12, release v3.0.0

**P5.1 🔴 Motor de guías: bloque `image_grader`** (§4) [R: Baier] — `multi-guideline-classifier.ts` recibe `graderResult`; `icdr_2024.json` y `minsal_chile_2017.json` actualizados (incluye `class_mapping` para `microaneurysm`/`hemorrhage` separados); `GuidelineEditor.tsx`; tests frontera.

**P5.2 🔴 UI** — `DRClassificationCard.tsx` (probabilidad, grado sugerido, bandera con motivo, versiones de los dos modelos); PDF; i18n es/en; `.dird` 2.1 con `gradeProbs`/`discrepancyFlag`; `dird-format.md`; round-trip test.

**P5.3 🔴 E11 — rendimiento** [DoD: `experiment-11-benchmark/REPORT.md` + Fig. 6] — nativo vs WASM, detector (global + teselas) y grader; ms/img media y p95, RAM pico, arranque, instalador; ≥ 3 perfiles con CPU declarada (laboratorio AMD Renoir, notebook antiguo, kiosko 2 GB).

**P5.4 🔴 E12 — calidad del software** — `vitest --coverage`, `cargo test`, round-trip, tests de guías; `tsc`, `eslint`, `clippy` limpios. [DoD: `experiment-12-software-quality/REPORT.md`]

**P5.5 🔴 ROADMAP + docs** — marcar liberado v2.0–v2.2 (H8); v3.0 (detector v3, grader, fusión, `ort`); v3.1 (lectura ciega, DICOM…). README "Reference models" con tres depósitos; quitar "no existe en ninguna herramienta publicada" y "zero cost"; DOI/licencia unificados.

**P5.6 🟡 E10 — subgrupos** [R: Barrientos] — grado × dataset para detector v3, grader y fusión; DDR grado 5.

**P5.7 🔴 Release v3.0.0** [DoD: tag, binarios 3 SO, Zenodo DOI de versión; `dird_models` tag + Zenodo; `dird_annotations` Zenodo] — versiones en `package.json`, `Cargo.toml`, `tauri.conf.json`, `version.json`; changelog; instalación limpia ≥ 2 SO.

**Hito semana 5:** software congelado, tres depósitos con DOI.

---

### Fase 6 — Semanas 6–7 (30-nov → 13-dic): figuras y redacción IMRyD

**P6.1 🔴 Figuras (≤ 6) y tablas (≤ 4)** [R: Baier (1,2,5,6) · Almendras/Leiva (3,4)]

| Fig. | Contenido | Fuente |
|---|---|---|
| 1 | Arquitectura: Tauri v2 (Rust: **ONNX Runtime nativo `ort`** con inferencia teselada, SQLCipher, Argon2, registro de modelos, LLM local opcional) ↔ webview (React, canvas, motor de guías JSON, PDF, WASM fallback). Graphical abstract | `dird_fig1_clinical_workflow.svg` (H15) |
| 2 | Pipeline de datos y modelos: datasets públicos → pseudoetiquetas v2 → **lectura doble cegada en Annotix → adjudicación → teselado** → detector v3; APTOS+DDR → grader; inferencia: global + teselas → fusión/discrepancia → guía JSON → informe → `.dird` | nuevo |
| 3 | Captura: canvas multicapa con hallazgos editables y auditoría | app v3.0.0, imagen demo |
| 4 | Captura: tarjeta de clasificación con guía activa, probabilidad y bandera | app v3.0.0 |
| 5 | ROC con IC: detector v3, grader y fusión en APTOS, DDR-test, IDRiD, (Messidor-2) | E7/E8/E14 |
| 6 | Latencia p50/p95 por perfil y backend (nativo vs WASM) | E11 |

| Tabla | Contenido |
|---|---|
| 1 | Datasets: fuente, país, n por split, uso por modelo (train / tune / test externo), licencia — de `DATA_CARD.md` |
| 2 | Validación: detector v2 (histórico, declarado) · detector v3 (mAP por lesión + AUC imagen externo) · grader (E7) · fusión (E8), con IC |
| 3 | Comparación con herramientas existentes: licencia, on-device, guías configurables, BYOM, validación externa publicada, procedencia de entrenamiento auditable, costo |
| 4 | Supervisión Annotix: n revisadas, % aceptadas/editadas/rechazadas por lector, κ, IoU, n adjudicadas · o rendimiento por perfil si Fig. 6 no basta |

**P6.2 🔴 Borrador 1 (≤ 3.500 palabras; objetivo 3.300)** [R: López coordina · Baier (Methods software, Results) · Barrientos (estadística) · Uribe (modelos, Annotix) · Almendras/Leiva (clínica)]

| Sección | Palabras | Contenido |
|---|---|---|
| Abstract (≤ 350) | — | Background and Objective / Methods / Results (AUC externo con IC, mAP v3 vs v2, κ, latencia nativo) / Conclusions |
| Highlights | — | 3–5 × ≤ 85 caracteres |
| 1 Introduction | 450 | brecha de tamizaje y conectividad; soberanía de datos (Ley 21.719, GDPR); guías locales; estado del arte (IDx-DR, EyeArt, trabajos CMPB de RD); el problema de la procedencia de entrenamiento no auditable; objetivo |
| 2 Methods | 1.400 | 2.1 Arquitectura (Fig. 1) · 2.2 Contrato de modelos (roles, fichas, teselado declarado) · 2.3 Motor de guías y fusión/discrepancia · 2.4 Canvas, auditoría `manuallyModified`, `.dird`, exportación · 2.5 **Modelos de referencia y pipeline expert-in-the-loop** (Fig. 2, Tabla 1): datos, pseudoetiquetas, lectura doble cegada, adjudicación, teselado, entrenamiento, calibración · 2.6 Evaluación: plan pre-registrado, métricas, IC, externos, benchmark · 2.7 Ética y disponibilidad: datos públicos, lectores = coautores, tres depósitos |
| 3 Results | 800 | Tabla 2 + Figs. 5–6; supervisión (Tabla 4); detector v3 vs v2 por lesión; APTOS externo; grader; fusión; subgrupos; rendimiento nativo vs WASM; calidad |
| 4 Discussion | 650 | plataforma (no solo modelo); Tabla 3; trazabilidad de entrenamiento como respuesta a la pregunta que el preprint no pudo responder; revisión humana justificada **con datos** (grado 1 OOD); limitaciones: sin estudio de lectores ni usabilidad (futuro FONIS), hemorragias débiles, sin metadatos de cámara/edad/sexo, no dispositivo médico, Messidor espejo si aplica; uso actual (tesis UACh 2025, docencia, DPG). Annotix citado una vez como herramienta publicada, sin tono promocional |
| 5 Conclusions | 150 | qué es / qué no es / disponibilidad |

Reglas: cada número ↔ archivo en `validation/**/results/`; "externo" solo para conjuntos que el modelo evaluado no vio; sin "human-in-the-loop" como eslogan (términos: *clinician-verified decision support*, *expert-in-the-loop model improvement*); sin "zero cost"; preprint medRxiv citado como antecedente con lo que cambió.

**P6.3 🟡 Tabla 3** [R: Baier · Leiva] — fuentes primarias (papers/FDA/CE), no marketing.

**P6.4 🟡 Suplementario** — `DATA_CARD.md`, tres fichas (v2 histórica, v3, grader), `TRIPOD-AI-mapping.md`, `ANALYSIS_PLAN.md`, `annotix_agreement.json`, JSON de resultados. Video opcional.

**P6.5 🔴 Releer guía de autores CMPB a mano** [R: López] — confirmar 3.500/350/50, highlights, formato de referencias, declaración de IA.

**Hito semana 7:** Borrador 1 completo.

---

### Fase 7 — Semana 8 (14 → 18-dic): revisión y envío

**P7.1 🔴 Consistencia** [R: Barrientos] — `docs/internal/trazabilidad_numeros.md`; licencia/DOI/versión iguales en paper, `CITATION.cff`, `.zenodo.json`, README, landing, fichas, `Cargo.toml`, `package.json`; ≤ 3.500 palabras; ≤ 50 refs.

**P7.2 🔴 Revisión de coautores** (72 h) + aprobación por correo con fecha.

**P7.3 🔴 Carta de presentación** — problema; plataforma abierta on-device con modelos intercambiables; pipeline de entrenamiento **auditable** (novedad frente a la literatura de RD); validación externa pre-registrada; relación con preprint medRxiv y Annotix; scope CMPB. 3–5 revisores sugeridos sin conflicto.

**P7.4 🔴 Envío** — Editorial Manager, Original Research, **subscription**; declaraciones (COI, INES-52 nombre completo, data availability con tres DOIs, CRediT, IA generativa); highlights.

**P7.5 Post-envío** — nota en medRxiv; Cartera TecMedHub, CV Normalizado, CDI; difusión al aceptarse (DIRD+ y Annotix).

---

## 4. Fichas de modelo schema 2.1 — propuesta

### 4.1 Grader (`classifier_v1`)

```json
{
  "schema_version": "2.1",
  "name": "DIRDgrader-v1",
  "version": "1.0.0",
  "role": "grader",
  "license": "AGPL-3.0",
  "doi": "10.5281/zenodo.<version-doi>",
  "trained_on": [
    { "dataset": "APTOS 2019 train split (deduplicated)", "n": 0 },
    { "dataset": "DDR DR_grading train", "n": 6835 }
  ],
  "tuned_on": [{ "dataset": "DDR DR_grading val", "n": 2733 }],
  "validated_on": [
    { "dataset": "DDR DR_grading test (minus lesion-detection images)", "n": 0, "metrics": {}, "ci95": {} },
    { "dataset": "IDRiD grading", "n": 516, "metrics": {} }
  ],
  "input": { "tensor_name": "images", "shape": [1, 3, 512, 512], "layout": "NCHW", "dtype": "float32",
    "preprocessing": { "retina_crop": true, "pad_to_square": true, "resize_to": [512, 512],
      "letterbox": false, "normalize": "divide_by_255", "color_order": "RGB" } },
  "output": { "tensor_name": "probs", "format": "classifier_v1", "shape": [1, 5], "activation": "softmax_included",
    "labels": ["no_dr", "mild_npdr", "moderate_npdr", "severe_npdr", "pdr"], "referable_from_index": 2,
    "calibration": { "method": "temperature_scaling", "temperature": 1.0, "fitted_on": "DDR val" },
    "operating_point": { "referable_threshold": 0.5, "fitted_on": "DDR val", "frozen": true } },
  "minimum_dird_version": "3.0.0"
}
```

### 4.2 Detector v3 (`yolo_end2end_v2` + teselado declarado)

```json
{
  "schema_version": "2.1",
  "name": "DIRDv3r0",
  "version": "3.0.0",
  "role": "detector",
  "license": "AGPL-3.0",
  "doi": "10.5281/zenodo.<version-doi>",
  "trained_on": [
    { "dataset": "DDR lesion-detection train+val (official boxes MA/HE/EX/SE; OD/fovea pseudo-labeled by DIRDv2r0 and adjudicated by two blinded readers in Annotix)", "n": 532 },
    { "dataset": "IDRiD segmentation train (masks → boxes)", "n": 54 },
    { "dataset": "IDRiD localization train (OD/fovea centres → boxes)", "n": 413 }
  ],
  "annotation_provenance": { "repository": "https://github.com/Debaq/dird_annotations", "doi": "10.5281/zenodo.<annotations-doi>",
    "audit_log_sha256_head": "<hash>", "readers": 2, "agreement": { "kappa_presence": 0.0, "mean_iou": 0.0 } },
  "input": { "tensor_name": "images", "shape": [1, 3, 640, 640], "layout": "NCHW", "dtype": "float32",
    "preprocessing": { "retina_crop": false, "letterbox": false, "normalize": "divide_by_255", "color_order": "RGB" } },
  "inference": { "tiling": { "enabled": true, "normalize_retina_diameter_px": 1600, "tile": 640, "overlap": 0.2,
    "global_pass_classes": ["optic_disc", "fovea"], "tiled_pass_classes": ["microaneurysm", "hemorrhage", "hard_exudate", "cotton_wool_spot"],
    "merge": "nms_per_class", "iou_threshold": 0.5 } },
  "output": { "tensor_name": "output", "format": "yolo_end2end_v2", "max_detections": 300 },
  "classes": [
    { "id": 0, "name": "optic_disc", "severity": "landmark" }, { "id": 1, "name": "fovea", "severity": "landmark" },
    { "id": 2, "name": "microaneurysm", "severity": "mild" }, { "id": 3, "name": "hemorrhage", "severity": "moderate-severe" },
    { "id": 4, "name": "hard_exudate", "severity": "moderate" }, { "id": 5, "name": "cotton_wool_spot", "severity": "moderate-severe" }
  ],
  "per_class_thresholds": {}, "minimum_dird_version": "3.0.0"
}
```

Reglas: `role` por defecto `detector`; `inference.tiling` ausente = una pasada a `input.shape` (compatibilidad con
v2). `labels`/`classes` mapean a la guía vía `class_mapping`.

## 5. Bloque de fusión en la guía clínica — propuesta

```json
"image_grader": {
  "enabled": true,
  "decision_source": "grader",
  "referable_threshold": null,
  "discrepancy_rules": [
    { "id": "grader_referable_no_lesions",
      "when": { "referable_prob": ">= threshold", "lesion_count": "== 0" }, "action": "flag_priority_review" },
    { "id": "lesions_without_referable_grade",
      "when": { "referable_prob": "< threshold", "moderate_lesions": ">= 1" }, "action": "flag_priority_review" }
  ],
  "fallback_without_grader": "detector_rules"
}
```

`decision_source ∈ {grader, detector, or, and}` reproduce las reglas de E8.

## 6. Decisiones cerradas (N. Baier, 2026-10-24)

1. **Backend de inferencia: nativo `ort` en Rust** con dos pasadas (global + teselas); WASM fallback con el mismo teselado.
2. **Autoría: 6** — Baier, Uribe, López, Almendras, Barrientos, Leiva. Arrigo, Mancilla y Braña no van (Acknowledgements si corresponde). Correspondencia: confirmar F. López.
3. **Entrenamiento: Kaggle** con API.
4. **Lectura ciega en la app: fuera de v3.0.0** (ROADMAP v3.1).
5. **Acceso: suscripción, 0 USD.** Sin presupuesto para APC (tope ≈ 1.000 USD).
6. **Detector: ruta B+** — reentrenar v3 con procedencia limpia (DDR-det + IDRiD), MA/HE separados, teselado con normalización de escala. v2 queda documentado como histórico. Si v3 no supera a v2 en la puerta de la semana 4, se publica v2 declarado.
7. **Pipeline expert-in-the-loop auditable en Annotix, público**: lectura doble cegada de OD/fóvea por Almendras y Leiva (TMO, coautores), `audit.jsonl` con cadena de hashes, acuerdo κ/IoU, repo `dird_annotations` sin imágenes + DOI. Annotix se cita una vez como herramienta publicada.
8. **Cronograma: 8 semanas**, envío objetivo **18-dic-2026**.

## 7. Acta de decisión B/A

_(pendiente — semana 4, P4.4)_

## 8. Fuera de la ruta crítica (no bloquea el envío)

- **E13 / métricas de supervisión en uso real**: con Almendras y Leiva (coautores) sobre imágenes públicas se podría medir aceptación/edición de hallazgos en la app sin comité. Solo si sobra tiempo en semana 5; si no, Discusión lo declara futuro.
- Estudio de lectores con externos (FONIS), SUS, cápsula reproducible, JOSS como DOI de software, Software Update para v4, lectura ciega en la app.

---

## Anexo A. Problemas del preprint que no pueden repetirse, contaminación APTOS y terminología

Problemas detectados en el preprint (`~/Escritorio/Archivo_disco_duro_2026-10-16/Publicaciones/preprint/dird_preprint_v2.pdf`)
que **no** pueden repetirse:

| # | Problema | Corrección |
|---|---|---|
| 1 | Dice licencia **MIT**; el repo, `.zenodo.json` y `dird_models` son **AGPL-3.0** | AGPL-3.0 en todo el texto |
| 2 | Dice **YOLOv26n, 9.467.502 parámetros**; la ficha `detection-v2.0.0.json` dice **YOLOv26s** | Usar la ficha del modelo como fuente única |
| 3 | El resumen mezcla AP con IoU 0,1 e IoU 0,5 (AP 0,243) | Una sola tabla, umbral declarado |
| 4 | Afirma que la detección es "suficiente para el rol de apoyo" con AP ≈ 0 en microaneurismas y exudados | El exp-1 es **resultado negativo**: se reporta como límite |
| 5 | "Validación interna" mAP 0,578 sobre pseudoetiquetas generadas por el mismo pipeline (circular) | Eliminar como evidencia de desempeño |
| 6 | Velocidad 0,297 s/img sin especificar CPU; el repo mide 112–163 ms/img | Benchmark con hardware documentado (§2, E11) |
| 7 | DOI inconsistentes (19687226 en texto, 19666272 en badge) | Usar **DOI de concepto** de Zenodo en todas partes |
| 8 | Cita Annotix como preprint con primer autor equivocado | Baier N. et al., *Computers* 2026, 15(8):496, doi:10.3390/computers15080496 |
| 9 | Párrafo "TMO > 97 %" duplicado; numeración de figuras rota | Revisión editorial |
| 10 | Financiamiento declarado solo como "Internal Research Fund (grant INES-52)" | Mantener INES-52 y nombrarlo completo: proyecto institucional ANID InES (UACh, VIDCA) |
| 11 | Sobreafirmaciones: "no existe en ninguna herramienta publicada", "costo cero", "elimina la carga de cumplimiento" | Eliminar o matizar con evidencia |
| 12 | Media sección de política sanitaria chilena (DART) | Reducir a 2–3 líneas: la revista evalúa software; el contexto chileno va en 2–3 líneas de Introduction |

### ⚠️ Hallazgo crítico: el exp-2 (APTOS) está contaminado

- `validation/models/detection-v2.0.0.json` declara que el detector se entrenó con **APTOS 2019**
  (500 imágenes pseudoetiquetadas, según el preprint).
- `validation/experiment-2-aptos/REPORT.md` lo presenta como validación **OOD** y evalúa sobre
  **todo** `train.csv` (n = 3.662), que incluye esas 500 imágenes.
- Consecuencia: AUC 0,949 y el punto de operación calibrado (Sens 0,978 / Spec 0,931) son
  **in-distribution**, no externos. La evidencia externa real es **DDR** (AUC 0,840) y
  **Messidor-2** (pendiente con imágenes crudas).
- Acción: P1.5 / E0 (y E14 para que APTOS vuelva a ser externo con v3). Hasta resolverlo, **ningún texto** puede llamar "externo" a APTOS.

### Terminología: dejar de usar "human-in-the-loop" como eslogan

El término está criticado (sesgo de automatización, supervisión nominal, *moral crumple zone*,
art. 14 del AI Act). DIRD+ hace **dos cosas distintas** y se nombran por separado:

| Qué hace | Término a usar |
|---|---|
| La IA propone hallazgos editables; el TMO corrige y firma; queda auditoría (`manuallyModified`) | *clinician-verified decision support* / *AI-drafted, specialist-signed reading* |
| Las correcciones del especialista alimentan el reentrenamiento | *expert-in-the-loop model improvement* (aprendizaje activo) |

La revisión humana se justifica con **nuestros datos** (exp-5: sensibilidad grado 1 cae de
0,99 a 0,44–0,51 fuera de distribución), no como valor agregado no demostrado. No afirmar
que "TMO + DIRD+ supera a cada uno por separado" hasta tener un estudio de lectores.

---

---

## Anexo B. Inventario de datasets y procedencia

| Dataset | Uso | n | Etiqueta | Acceso / licencia | Estado |
|---|---|---|---|---|---|
| APTOS 2019 (`train.csv`) | Entrenamiento clasificador | 3.662 | Grado 0–4 por imagen (1 calificador) | Kaggle, uso de competencia | ✅ en `validation/` |
| DDR – DR grading | Entrenamiento (train), ajuste (val), **test externo** (test) | 13.673 (6.835 / 2.733 / 4.105); 1.151 no calificables | Grado 0–4 + 5 = no calificable | Nankai, investigación | ✅ `validation/data/ddr` |
| Messidor-2 (**crudo ADCIS**) | **Test externo** | 1.748 | Grado adjudicado (Krause 2018) | Solicitud a ADCIS | ⚠️ hoy se usa un espejo preprocesado; pedir originales |
| IDRiD – grading | **Test externo** | 516 (413 / 103) | Grado 0–4 + edema macular | Grand-challenge | ✅ (subset segmentación ya usado) |
| IDRiD – segmentation | **Entrenamiento v3** (train 54) + test por lesión (test 27) | 81 | Máscaras por lesión | Grand-challenge (CC BY 4.0) | ⚠️ descargar completo |
| IDRiD – localization | **Entrenamiento v3** (OD/fóvea) | 516 (413 / 103) | Centro OD y fóvea | Grand-challenge (CC BY 4.0) | ⚠️ descargar |
| DDR – lesion detection | **Entrenamiento v3** (train 383 + val 149) + test por lesión (225) | 757 | Cajas MA/HE/EX/SE | Nankai, investigación | ⚠️ descargar |

Se materializa en P1.7 como `validation/DATA_CARD.md` con: fuente, versión/fecha de descarga, licencia, cita
obligatoria y conteos finales por split tras limpieza.

---

## Anexo C. Tabla de experimentos (E0–E13) con métricas

Regla general: **plan de análisis escrito y commiteado antes de tocar los test externos**
(`validation/ANALYSIS_PLAN.md`, P1.9). Umbrales se fijan en DDR-val y no
se modifican al ver DDR-test, Messidor-2 ni IDRiD.

| ID | Experimento | Pregunta | Métricas | Prioridad |
|---|---|---|---|---|
| **E0** | Re-etiquetar exp-2 | APTOS es in-distribution para v2 (IDs irrecuperables) y externo para v3 | Reescribir REPORT con ambas lecturas | 🔴 bloqueante |
| **E14** | **Detector v3** (procedencia limpia + teselado, pipeline Annotix) | ¿Supera a v2 por lesión y en imagen, con entrenamiento auditable? | mAP50 por clase (DDR-det test, IDRiD-seg test); AUC imagen externo (APTOS, DDR-grading minus 757, Messidor-2); κ/IoU de lectores | 🔴 |
| E1 | IDRiD detección (v2, existente) | — | Pasa a histórico de v2; el test por lesión de v3 es E14 | ✅ hecho (v2) |
| **E6** | Entrenar clasificador | ¿Qué modelo liviano clasifica mejor en CPU? | QWK (grado 0–4), AUC derivable (≥ 2), latencia CPU | 🔴 |
| **E7** | Validación externa clasificador | ¿Generaliza? | AUC con IC 95 % bootstrap; Sens a Spec 0,80/0,90; QWK; calibración (ECE, curva de confiabilidad); sensibilidad por grado | 🔴 |
| **E8** | Fusión clasificador + detector | ¿Qué aporta combinar? | Reglas: solo clasificador / solo detector / OR / **bandera de discrepancia**; % de casos marcados y cuántos de ellos son verdaderos positivos | 🔴 (es la función nueva del software) |
| E9 | Ablación de atajos | ¿El modelo aprende la cámara? | Con/sin recorte; baseline de tamaño (§1.2-4) | 🟡 |
| E10 | Subgrupos (actualiza exp-5) | ¿Dónde falla? | Por grado, por dataset/sitio, por calidad | 🟡 |
| **E11** | Benchmark de rendimiento | ¿Corre en hardware modesto? | ms/img (media, p95), RAM pico, tiempo de arranque; WASM con/sin SIMD y threads (no hay runtime nativo, ver H1); ≥ 3 perfiles de hardware **con modelo de CPU declarado** (PC laboratorio, notebook antiguo, kiosko Archcraft 2 GB) | 🔴 |
| E12 | Calidad del software | ¿Es confiable? | Cobertura de tests; tests del motor de guías (ICDR 2024 y MINSAL 2017 con casos frontera); round-trip `.dird` | 🔴 (la revista lo mira) |
| E13 | Métricas de supervisión | ¿El especialista realmente revisa? | % de propuestas aceptadas / editadas / rechazadas desde `manuallyModified` (piloto con tesistas o TMO del equipo) | 🟢 opcional, fuera de ruta crítica (ver §8; con coautores sobre datos públicos no requiere comité) |

### Detalle E6 — grader (clasificador por imagen)

- **Candidatos** (exportables a ONNX, CPU): YOLO26-cls (n y s; mismo flujo Ultralytics, AGPL),
  EfficientNet-B0, MobileNetV3-Large. Objetivo: ≤ 20 MB, ≤ 60 ms/img en CPU de laboratorio.
- **Datos:** APTOS (sin las 500 del detector si se recuperan; si no, completo) + DDR-train.
  Ajuste en DDR-val. **Nunca** DDR-test, Messidor-2 ni IDRiD-grading.
- **Tareas:** (a) binaria derivable (grado ≥ 2) — salida principal de tamizaje;
  (b) 5 grados con pérdida ordinal o regresión + umbrales — salida informativa.
- **Desbalance:** muestreo ponderado por clase; reportar distribución por split.
- **Semillas:** 3; reportar media ± DE.
- **Selección:** mejor AUC derivable en DDR-val con latencia dentro de objetivo.
- **Entrenamiento y anotación de ejemplos difíciles:** registrar en Annotix (vincula con
  Baier et al. 2026, *Computers*).
- **Salida:** `dird_models` → `grader-v1.0.0.onnx` + ficha JSON (misma estructura que
  `detection-v2.0.0.json` pero schema 2.1, ver §3: datos de entrenamiento **explícitos**, métricas, limitaciones).

### Detalle E8 — fusión

- El **clasificador decide** el tamizaje; el **detector explica** dónde.
- **Bandera "revisar con prioridad"** cuando discrepan (clasificador derivable sin lesiones
  detectadas, o lesiones moderadas con clasificador no derivable).
- Reportar: tasa de bandera, VPP de la bandera, y casos derivables que **ninguno** detecta.

---

---

## Anexo D. Riesgos

| Riesgo | Mitigación |
|---|---|
| No se recuperan los IDs APTOS del detector v2 | Resuelto por diseño: v3 no usa APTOS (E14); v2 se declara in-distribution |
| Detector v3 no supera a v2 (n pequeño: 586 imágenes) | Puerta semana 4 (P4.4): publicar v2 declarado + grader; v3 a Software Update |
| Teselado lento en kiosko 2 GB (15–30 pasadas) | Nativo `ort` + dos pasadas; E11 lo reporta; ajuste para desactivar teselas (una pasada 640, declarado como modo degradado) |
| Lectores no terminan las 532 × 2 cajas en semana 2 | Carga ≈ 1,5 h por lector; si falta, adjudicar solo desacuerdos y declarar n revisadas |
| ADCIS no entrega Messidor-2 crudo a tiempo | Usar DDR-test + IDRiD-grading como externos; Messidor queda como suplementario con advertencia |
| Clasificador aprende la cámara (atajo) | E9 + recorte obligatorio; si persiste, reportarlo |
| El revisor objeta "clinical decision support" sin estudio clínico ni de usabilidad | Intended use explícito, no dispositivo médico, estudio de lectores y usabilidad como trabajo futuro (FONIS); precedente ECGMiner (§0.3) |
| Inconsistencias residuales (licencia, DOI, modelo) | Revisión cruzada final contra `CITATION.cff` y fichas JSON |
| Binarios de ONNX Runtime no compilan/enlazan en CI para Windows o macOS | Probar `ort` en CI la semana 3 (P2.6); si falla en un SO, ese instalador sale con WASM-only y el paper lo declara; nativo nunca bloquea el release |
| Presupuesto 0 USD: ningún OA posible | Suscripción + preprint medRxiv; no aceptar "transfer" a revista OA hermana (CMPB Update, 2.990 USD) |
| Guía de autores CMPB leída solo por snippets (3.500/350/50) | Releer a mano en ScienceDirect en semana 5 antes de cerrar el borrador |
| Desk reject por "solo descripción de software" | Tabla 3 comparativa + validación externa pre-registrada + plan B de revista (§0.1) |

---

## Anexo E. Responsables sugeridos (a confirmar en P1.11)

| Área | Persona |
|---|---|
| Software, contrato de modelos, backend `ort` nativo con teselado, release | N. Baier |
| Datos, procedencia v2 (P1.4), proyecto Annotix y adjudicación, entrenamiento grader (E6) y detector v3 (E14), fichas | V. Uribe |
| Validación y estadística (E7–E10, IC, calibración) | N. Baier · H. Barrientos |
| **Lectura doble cegada OD/fóvea en Annotix (P2.1)**, revisión clínica (casos frontera de guías, Figs. 3–4) | C. Almendras · C. Leiva (TMO) |
| Redacción, coordinación y autor de correspondencia | F. López |
