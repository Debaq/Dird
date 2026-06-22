# DIRD+ AI Model Interface Specification

**Version**: 2.0
**Status**: Stable for v2.0 release
**Specification license**: CC-BY-SA 4.0
**Reference models license**: AGPL-3.0

This document specifies the **contract** that any AI model must satisfy to be loadable into DIRD+. Following this contract, third parties can train and deploy their own retinal lesion detection models inside DIRD+ without modifying the application code.

---

## 1. Why a model contract?

DIRD+ ships with reference AI models (DIRDv1r1, DIRDv2r0), but it is designed to be **model-agnostic**: organizations should be able to plug in their own ONNX models, trained on their own data, calibrated to their own population.

This matters because:

- Diabetic retinopathy presentation varies by population (genetics, glycemic control patterns, comorbidities).
- Fundus camera characteristics vary by manufacturer and clinic.
- Regulatory environments may require nationally-validated models.
- Research groups want to deploy their improvements without forking DIRD+.

A clear interface contract makes DIRD+ a **platform**, not just an application.

---

## 2. Format and runtime

| Item | Requirement |
|------|-------------|
| Container format | ONNX (Open Neural Network Exchange) |
| ONNX opset | 13 or higher |
| Runtime | ONNX Runtime ≥ 1.18 (CPU; GPU optional) |
| File extension | `.onnx` |
| Maximum size | No hard limit, but ≤ 200 MB is recommended for web deployment |

The reference models are exported from PyTorch (Ultralytics YOLO family) to ONNX with end-to-end NMS.

---

## 3. Input specification

### 3.1 Tensor shape

The model must accept a single input tensor:

| Dimension | Size | Meaning |
|-----------|------|---------|
| Batch | 1 | Inference is one-image-at-a-time |
| Channels | 3 | RGB |
| Height | 640 | Pixels |
| Width | 640 | Pixels |

Shape notation: `[1, 3, 640, 640]` (NCHW layout).

Input tensor name should be `images` (default) or declared in the model card (see §6).

### 3.2 Preprocessing performed by DIRD+

Before invoking the model, DIRD+ applies the following preprocessing:

1. **Resize** the input image to 640×640 using bilinear interpolation, preserving aspect ratio with letterbox padding (gray border, value 114/255).
2. **Convert** to RGB (if input is grayscale, replicate the single channel; if BGR, swap).
3. **Normalize** pixel values: divide by 255.0 so that values lie in [0.0, 1.0]. **No mean subtraction or ImageNet normalization** is applied by default.
4. **Transpose** to NCHW (channels first).
5. **Cast** to `float32`.

Models trained with a different normalization scheme (e.g., ImageNet mean/std) must declare it in the model card so DIRD+ can apply the correct preprocessing.

### 3.3 Coordinate system

After resize+letterbox, all coordinates produced by the model are in the **640×640 letterboxed image space**. DIRD+ transforms them back to original-image coordinates for display.

---

## 4. Output specification

The model must produce a single output tensor with end-to-end NMS already applied. **DIRD+ does not perform post-NMS in the application code**; the model is expected to be a self-contained detector.

### 4.1 Tensor shape

The output tensor shape is:

```
[1, num_detections, 6]
```

Where each row of the last dimension contains:

| Index | Field      | Type    | Range / Meaning |
|-------|------------|---------|-----------------|
| 0     | x_min      | float32 | Bounding box left, in [0, 640] |
| 1     | y_min      | float32 | Bounding box top, in [0, 640] |
| 2     | x_max      | float32 | Bounding box right, in [0, 640] |
| 3     | y_max      | float32 | Bounding box bottom, in [0, 640] |
| 4     | confidence | float32 | Detection confidence, in [0.0, 1.0] |
| 5     | class_id   | float32 | Integer class index (cast from float), in [0, num_classes − 1] |

`num_detections` is variable and ≥ 0. When the model finds no lesions, the tensor has shape `[1, 0, 6]`.

Output tensor name should be `output` (default) or declared in the model card.

### 4.2 Alternative output formats

DIRD+ v2.0 also accepts the following alternative output formats, declared in the model card:

- **`yolo_v8_native`**: `[1, num_classes + 4, num_anchors]` requiring DIRD+ to run NMS. Supported for compatibility but not recommended.
- **`yolo_end2end_v2`**: the canonical format above (`[1, num_detections, 6]`).

If no format is declared, DIRD+ assumes `yolo_end2end_v2`.

---

## 5. Class definitions

The reference DIRD+ models use the following class indices:

| Class ID | Class name           | Description                                | Severity hint |
|----------|----------------------|--------------------------------------------|---------------|
| 0        | `optic_disc`         | Anatomical landmark                        | landmark      |
| 1        | `fovea`              | Anatomical landmark                        | landmark      |
| 2        | `hard_exudate`       | Lipid deposits                             | moderate      |
| 3        | `hemorrhage`         | Retinal hemorrhage                         | moderate-severe |
| 4        | `cotton_wool_spot`   | Soft exudate / nerve fiber infarct         | moderate-severe |
| 5        | `microhemorrhages`   | Microhemorrhages and dot hemorrhages       | mild-moderate |
| 6        | `edema`              | Macular edema                              | severe        |
| 7        | `microaneurysm`      | Capillary aneurysm                         | mild          |
| 8        | `neovascularization` | Pathological new vessels                   | severe        |
| 9        | `venous_beading`     | Venous calibre irregularity                | severe        |
| 10       | `IRMA`               | Intraretinal microvascular abnormalities   | severe        |

**Custom models** may define their own classes by providing a class mapping in the model card. DIRD+ will use the mapping to label detections in the UI and reports.

---

## 6. Model card (`.json` companion file)

Each ONNX model must be accompanied by a JSON **model card** with the same base filename:

- Model: `my-model.onnx`
- Card: `my-model.json`

The model card declares all metadata needed by DIRD+ to load and use the model correctly:

```json
{
  "schema_version": "2.0",
  "name": "DIRDv2r0",
  "version": "2.0.0",
  "description": "Reference DIRD+ detection model, YOLOv26s end2end NMS",
  "license": "AGPL-3.0",
  "doi": "10.5281/zenodo.19685466",
  "authors": [
    "Nicolás Baier Quezada"
  ],
  "trained_on": "Internal dataset based on IDRiD",
  "validated_on": [
    {
      "dataset": "APTOS 2019 Blindness Detection",
      "n": 3662,
      "metrics": {
        "sensitivity": 0.978,
        "specificity": 0.933,
        "MCC": 0.911,
        "AUC_ROC": 0.967
      },
      "operating_point": "PCT_fpr02",
      "doi_report": null
    }
  ],
  "input": {
    "tensor_name": "images",
    "shape": [1, 3, 640, 640],
    "layout": "NCHW",
    "dtype": "float32",
    "preprocessing": {
      "resize_to": [640, 640],
      "letterbox": true,
      "letterbox_color": [114, 114, 114],
      "normalize": "divide_by_255",
      "color_order": "RGB"
    }
  },
  "output": {
    "tensor_name": "output",
    "format": "yolo_end2end_v2",
    "max_detections": 300
  },
  "classes": [
    { "id": 0, "name": "optic_disc",         "severity": "landmark" },
    { "id": 1, "name": "fovea",              "severity": "landmark" },
    { "id": 2, "name": "hard_exudate",       "severity": "moderate" },
    { "id": 3, "name": "hemorrhage",         "severity": "moderate-severe" },
    { "id": 4, "name": "cotton_wool_spot",   "severity": "moderate-severe" },
    { "id": 5, "name": "microhemorrhages",   "severity": "mild-moderate" }
  ],
  "per_class_thresholds": {
    "hard_exudate": 0.63,
    "microhemorrhages": 0.26,
    "cotton_wool_spot": 0.85,
    "hemorrhage": 0.05
  },
  "default_confidence_threshold": 0.25,
  "minimum_dird_version": "2.0.0",
  "tags": ["diabetic-retinopathy", "ophthalmology", "yolo", "edge"]
}
```

### 6.1 Required fields

- `schema_version` (must be `"2.0"` for this specification)
- `name`, `version`, `license`
- `input` block (tensor_name, shape, layout, dtype, preprocessing)
- `output` block (tensor_name, format)
- `classes` array

### 6.2 Optional but recommended fields

- `description`, `authors`, `doi`
- `trained_on`, `validated_on`
- `per_class_thresholds`, `default_confidence_threshold`
- `minimum_dird_version`
- `tags`

---

## 7. Loading a custom model in DIRD+

From DIRD+ v2.0:

1. Open **Settings → AI Models**.
2. Click **Add Model**.
3. Select the `.onnx` file. DIRD+ looks for a `.json` model card in the same directory and prompts if missing or invalid.
4. DIRD+ validates the model card schema and runs a sanity-check inference on a built-in test image.
5. If validation passes, the model appears in the model list.
6. Activate the desired model from the list. All subsequent inference uses it until changed.

DIRD+ keeps a registry of installed models in its configuration directory (`<user_data>/models/`), so models persist across application updates.

---

## 8. Validation requirements for production use

DIRD+ does **not** enforce any minimum performance threshold to load a model. However, models displayed in the application UI carry the warning "Custom model — no DIRD+ validation" unless the validating organization opts to publish validation data.

For models intended for clinical use:

1. The deploying organization is responsible for clinical validation under applicable regulations.
2. Model cards should declare validation metrics with sample size and dataset.
3. DIRD+ recommends external validation on at least one out-of-distribution dataset (e.g., APTOS, Messidor-2, EyePACS).

---

## 9. Example: minimal custom model

A minimal `my-model.json` for a model trained on a custom 2-class detector (background + lesion):

```json
{
  "schema_version": "2.0",
  "name": "MyClinicModel",
  "version": "0.1.0",
  "license": "AGPL-3.0",
  "input": {
    "tensor_name": "images",
    "shape": [1, 3, 640, 640],
    "layout": "NCHW",
    "dtype": "float32",
    "preprocessing": {
      "resize_to": [640, 640],
      "letterbox": true,
      "normalize": "divide_by_255",
      "color_order": "RGB"
    }
  },
  "output": {
    "tensor_name": "output",
    "format": "yolo_end2end_v2"
  },
  "classes": [
    { "id": 0, "name": "lesion", "severity": "unknown" }
  ]
}
```

---

## 10. Validation tooling

A reference validator script (`scripts/validate_model_card.py`) is provided in the DIRD+ repository. It checks:

- JSON schema conformance.
- ONNX model loadability via `onnxruntime`.
- Input tensor shape matches the declared shape.
- Output tensor shape matches the declared format.
- Sanity-check inference on a test image (no crash, sensible output range).

Usage:

```bash
python scripts/validate_model_card.py my-model.onnx my-model.json
```

---

## 11. Versioning of this specification

| Version | Changes |
|---------|---------|
| 2.0     | Initial public specification (DIRD+ v2.0 release). |

Future versions of this specification will preserve backwards compatibility for at least one DIRD+ major version. Breaking changes will be announced with at least 6 months of notice.

---

## 12. Contributing

Suggestions for the model interface specification are welcome via GitHub Issues labeled `model-interface`. Substantive proposals should be submitted as Pull Requests against this file.

---

**Specification**: DIRD+ Model Interface
**Version**: 2.0
**License**: CC-BY-SA 4.0
**Reference implementation**: DIRD+ (AGPL-3.0)
**Maintainer**: Nicolás Baier Quezada, Universidad Austral de Chile (UACh)
