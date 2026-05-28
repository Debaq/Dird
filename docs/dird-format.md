# `.dird` File Format Specification

**Format versions**: 2.0 (current, encrypted), 1.0.1 (legacy, plain ZIP)
**Status**: Stable
**License**: This specification is released under CC-BY-SA 4.0. The reference implementation in DIRD+ is licensed under AGPL-3.0.

This document describes the `.dird` file format used by DIRD+ to export and import patient and session data. The format is **open and non-proprietary**: any developer or tool can read, write, or transform `.dird` files using standard ZIP, JSON, AES-256-GCM and Argon2id tooling.

---

## 1. Overview

A `.dird` file is one of:

- **v2.0 (current)**: An **encrypted container** wrapping a ZIP payload. The container starts with the magic bytes `DIRD` and uses AES-256-GCM with an Argon2id-derived key. See §1.1.
- **v1.0.1 (legacy)**: A plain **ZIP archive**. Detected by the absence of the `DIRD` magic. Supported for import only, for migration from pre-v2.0 installations.

Once decrypted (v2.0) or opened directly (v1.0.1), the inner ZIP contains JSON metadata, image blobs, and PDF reports for one or more patients or sessions.

The file extension is `.dird`. For v2.0 the MIME type is `application/octet-stream`; for v1.0.1 it is `application/zip`.

### 1.1 Encrypted container (v2.0)

Binary layout (little-endian unless noted):

| Offset | Size | Field               | Notes |
|-------:|-----:|---------------------|-------|
|      0 |    4 | `magic`             | ASCII `"DIRD"` (`0x44 0x49 0x52 0x44`) |
|      4 |    2 | `version`           | `2` for v2.0 |
|      6 |    2 | `flags`             | Reserved, MUST be `0` |
|      8 |    1 | `kdf_algo`          | `1` = Argon2id |
|      9 |    4 | `kdf_m_kib`         | Argon2id memory cost in KiB (default `65536` = 64 MiB) |
|     13 |    4 | `kdf_t`             | Argon2id time cost (default `3`) |
|     17 |    1 | `kdf_p`             | Argon2id parallelism (default `4`) |
|     18 |   16 | `salt`              | Argon2id salt |
|     34 |   12 | `wrapped_dek_nonce` | AES-256-GCM nonce for the wrapped DEK |
|     46 |   48 | `wrapped_dek`       | 32-byte DEK encrypted with KEK + 16-byte GCM tag |
|     94 |   12 | `content_nonce`     | AES-256-GCM nonce for the inner ZIP |
|    106 |    … | `ciphertext`        | Inner ZIP encrypted with DEK, 16-byte GCM tag appended |

Algorithms:

- **KDF**: Argon2id (RFC 9106). The user-supplied passphrase + `salt` derive a 32-byte KEK using `kdf_m_kib`/`kdf_t`/`kdf_p`. DIRD+ writes OWASP-2025 parameters (`m=64 MiB`, `t=3`, `p=4`).
- **AEAD**: AES-256-GCM with 96-bit nonces and 128-bit tags.
- **Associated data**:
  - DEK wrap: ASCII `"DIRD-DEK-v2"`.
  - Content: ASCII `"DIRD-v2"`.

Decryption flow:

1. Parse header; verify `magic == "DIRD"` and `version == 2`.
2. Derive `KEK = Argon2id(passphrase, salt, params from header)`.
3. `DEK = AES-256-GCM_decrypt(KEK, wrapped_dek_nonce, wrapped_dek, aad="DIRD-DEK-v2")`.
4. `inner_zip = AES-256-GCM_decrypt(DEK, content_nonce, ciphertext, aad="DIRD-v2")`.
5. Proceed with the v1.0.1 ZIP-level layout described below.

If any AEAD step fails, the container is rejected (incorrect passphrase, tampered bytes, or wrong version). DIRD+ does not implement passphrase recovery — losing the passphrase makes the file permanently unrecoverable.

The inner ZIP payload follows the layout described in the rest of this document.

---

## 2. Export types

`.dird` files come in three flavours, distinguished by the `export_type` field in `metadata.json`:

| `export_type` | Contents |
|---------------|----------|
| `full`        | All patients and all their sessions. |
| `patient`     | One patient and all their sessions. |
| `session`     | One single session. |

The directory structure differs slightly between `patient`/`full` exports and `session` exports.

---

## 3. Directory structure

### 3.1 `export_type = "patient"` or `"full"`

```
example.dird/
├── metadata.json
└── sessions/
    ├── session_001/
    │   ├── images/
    │   │   ├── img_001.jpg
    │   │   ├── img_002.png
    │   │   └── ...
    │   ├── images_metadata.json
    │   ├── detections.json
    │   ├── segmentations.json
    │   ├── measurements.json
    │   └── reports/
    │       ├── report_screening.pdf
    │       └── report_followup.pdf
    ├── session_002/
    │   └── ...
    └── ...
```

### 3.2 `export_type = "session"`

For single-session exports, the contents of the session folder are placed at the root of the archive:

```
example.dird/
├── metadata.json
├── images/
│   └── ...
├── images_metadata.json
├── detections.json
├── segmentations.json
├── measurements.json
└── reports/
    └── ...
```

---

## 4. File contents

### 4.1 `metadata.json` (always present, root)

JSON document with the export header and patient information.

```json
{
  "export_version": "1.0.1",
  "exported_at": "2026-05-20T14:32:00Z",
  "export_type": "full | patient | session",
  "patient": {
    "id": "uuid-or-internal-id",
    "name": "string | null",
    "national_id": "string | null",
    "date_of_birth": "YYYY-MM-DD | null",
    "gender": "M | F | X | null",
    "contact": {
      "phone": "string | null",
      "email": "string | null"
    },
    "clinical_history": "string | null"
  },
  "sessions": [
    {
      "id": "session_001",
      "session_date": "ISO-8601",
      "clinician_id": "string",
      "notes": "string | null"
    }
  ]
}
```

Fields marked `| null` are optional. DIRD+ writes them as `null` when absent; tools reading the format must accept either `null` or missing keys.

**Notes:**
- `exported_at` and `session_date` follow **ISO 8601** with timezone (RFC 3339 profile recommended).
- `id` values are internal identifiers; they are unique within the file but not globally unique unless a UUID is used.

### 4.2 `images/` (per session)

A folder containing the raw retinal image files (JPEG or PNG). File names are referenced from `images_metadata.json`.

- Recommended format: **JPEG** for fundus photographs, **PNG** for any post-processed image where lossless compression is desired.
- Filenames should be ASCII-safe and unique within the session.

### 4.3 `images_metadata.json` (per session)

Metadata for each image in `images/`.

```json
{
  "version": "1.0.1",
  "images": [
    {
      "id": "img_001",
      "filename": "img_001.jpg",
      "eyeType": "OD | OS | unknown",
      "capture_date": "ISO-8601 | null",
      "width": 1024,
      "height": 1024,
      "device": "string | null",
      "notes": "string | null"
    }
  ]
}
```

- `eyeType`: `OD` (oculus dexter / right), `OS` (oculus sinister / left), or `unknown`.

### 4.4 `detections.json` (per session)

Bounding box detections produced by the AI model, with foreign key references to images.

```json
{
  "version": "1.0.1",
  "model": {
    "name": "DIRDv2r0",
    "version": "2.0.0",
    "doi": "10.5281/zenodo.19685466"
  },
  "detections": [
    {
      "id": "det_001",
      "imageId": "img_001",
      "class": "hemorrhage | hard_exudate | cotton_wool_spot | microhemorrhages | optic_disc | fovea | ...",
      "confidence": 0.87,
      "bbox": {
        "x": 245.5,
        "y": 312.8,
        "width": 18.3,
        "height": 16.0,
        "coord_system": "pixel"
      },
      "validated_by_clinician": true,
      "clinician_note": "string | null"
    }
  ]
}
```

- Bounding box coordinates are in **pixels** of the original image, with the origin at the top-left corner (standard image coordinate system).
- `confidence` is the raw model score, in the range [0, 1].
- `validated_by_clinician` indicates whether a qualified clinician has reviewed this specific detection.

### 4.5 `segmentations.json` (per session)

Pixel-level segmentation masks. Available when the model produces segmentation output (planned for v3+; in v2.0 this file may be present but empty or absent).

```json
{
  "version": "1.0.1",
  "segmentations": [
    {
      "id": "seg_001",
      "imageId": "img_001",
      "class": "vessel | hemorrhage | ...",
      "mask_filename": "masks/seg_001.png",
      "encoding": "binary_png | rle | polygon"
    }
  ]
}
```

Mask files (when encoding is `binary_png`) live in a `masks/` folder alongside `images/`.

### 4.6 `measurements.json` (per session)

Derived measurements computed from the images or detections (vessel calibers, lesion counts, area fractions, etc.).

```json
{
  "version": "1.0.1",
  "measurements": [
    {
      "id": "meas_001",
      "imageId": "img_001",
      "metric": "lesion_count | vessel_caliber | ...",
      "value": 12,
      "unit": "count | mm | um | ratio | ...",
      "method": "string"
    }
  ]
}
```

### 4.7 `reports/*.pdf` (per session)

Clinical PDF reports generated by the application. File naming convention:

```
report_<type>.pdf
```

where `<type>` is one of `screening`, `followup`, `referral`, or a custom string.

Reports are **standard PDF/A-compatible documents** that can be opened by any PDF reader.

---

## 5. Database mapping

For implementers extending DIRD+ or building compatible tools, this is the mapping between `.dird` file contents and the internal Dexie/IndexedDB schema used by the reference implementation:

| File in `.dird` | Database table | Notes |
|-----------------|----------------|-------|
| `metadata.patient` | `patients` | One record per file (or many in `full` exports) |
| `metadata.sessions[]` | `sessions` | Foreign key to patient |
| `images/*` + `images_metadata.json` | `images` (blob + metadata) | Images stored as blobs |
| `detections.json` | `detections` | Foreign key: `imageId` |
| `segmentations.json` | `segmentations` | Foreign key: `imageId` |
| `measurements.json` | `measurements` | Foreign key: `imageId` |
| `reports/*.pdf` | `reports` | Foreign key: `sessionId` |

Reference implementation:
- Exporter: `src/lib/export/dird-exporter.ts` (functions `exportPatient` at line 14, `exportSession` at line 108).
- Importer: `src/lib/export/dird-importer.ts`.
- Packaging: JSZip.

---

## 6. Encryption (v2.0+)

From DIRD+ v2.0 onward, `.dird` files may be **encrypted at rest** using **AES-256-GCM**, with the key derived from a user-provided password via **Argon2id**.

Encrypted `.dird` files have the following outer structure:

```
encrypted.dird (binary)
├── magic: "DIRDENC1" (8 bytes)
├── argon2_params: { time, memory, parallelism, salt } (256 bytes)
├── nonce: 12 bytes (random)
├── ciphertext: encrypted ZIP content (variable length)
└── auth_tag: 16 bytes (GCM authentication)
```

Unencrypted `.dird` files do not have the `DIRDENC1` magic; they begin with the standard ZIP `PK\x03\x04` signature. Tools must check the first 8 bytes to determine whether decryption is required.

Detailed encryption format will be specified in `docs/dird-encryption.md` (to be released alongside v2.0).

---

## 7. Open-source compatibility

Any standard tool can read an **unencrypted** `.dird` file:

```bash
# Inspect contents
unzip -l example.dird

# Extract everything
unzip example.dird -d extracted/

# Read metadata
unzip -p example.dird metadata.json | jq .
```

Python example:

```python
import zipfile
import json

with zipfile.ZipFile("example.dird") as z:
    with z.open("metadata.json") as f:
        meta = json.load(f)
    print(meta["export_version"], meta["export_type"])
```

JavaScript example (Node.js with JSZip):

```javascript
import JSZip from "jszip";
import { readFileSync } from "fs";

const zip = await JSZip.loadAsync(readFileSync("example.dird"));
const meta = JSON.parse(await zip.file("metadata.json").async("string"));
console.log(meta.export_version, meta.export_type);
```

---

## 8. Versioning

The format is versioned at two levels:

- **Container version**: in the binary header (`version` field). `2` for v2.0 encrypted containers; absent for v1.0.1 plain ZIPs (detected by the missing `DIRD` magic).
- **Inner payload version**: in `metadata.json` (`export_version` field). Current is **2.0.0** (paired with container v2.0); legacy was **1.0.1** (plain ZIP).

We follow **Semantic Versioning** for the format:

- **MAJOR** changes (e.g., 1.x → 2.x): incompatible schema changes. Old files cannot be read by new code without a converter.
- **MINOR** changes (e.g., 1.0 → 1.1): backwards-compatible additions. Old files remain readable; new files use new optional fields.
- **PATCH** changes (e.g., 1.0.0 → 1.0.1): documentation or clarification only; no schema changes.

DIRD+ supports reading all versions ≥ 1.0.0.

---

## 9. Implementation notes and caveats

- **File size**: PDFs and images embedded as blobs cause `.dird` files to grow quickly. For full backups of large patient cohorts, expect file sizes in the hundreds of megabytes to gigabytes.
- **Pre-encryption signing**: In version 1.0.1, unencrypted `.dird` files include no integrity signature. Tampering is detectable only by comparing hashes. Encryption (v2.0+) provides integrity via GCM authentication tags.
- **Patient identity uniqueness**: `patient.id` is unique within the file but not globally unique. When importing multiple `.dird` files, the importer must reconcile potential collisions.
- **Sensitive content**: Unencrypted `.dird` files contain personally identifiable information (PII) and protected health information (PHI). Treat them with the same care as any clinical record. Always use encrypted exports for any transfer outside the controlled clinical environment.

---

## 10. Contributing to this specification

This specification is maintained alongside the DIRD+ source code. Proposed changes are tracked as GitHub Issues with the `format-spec` label. Substantive proposals should be submitted as Pull Requests against this file.

Backwards compatibility is a core design value: changes that break version 1.x readers will only be accepted in a new major version (2.0).

---

**Format**: DIRD+ Patient Case File Format (`.dird`)
**Specification version**: 1.0.1
**Specification license**: CC-BY-SA 4.0
**Reference implementation**: DIRD+ (AGPL-3.0)
**Maintainer**: Nicolás Baier Quezada, Universidad Austral de Chile (UACh)
