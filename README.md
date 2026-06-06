# DIRD+ — Diabetic Retinopathy Detection Platform with Edge-Computing AI

<p align="center">
  <img src="public/logo.svg" alt="DIRD+ Logo" width="140" />
</p>

<p align="center">
  <strong>Desktop application whose AI runs entirely on-device.</strong><br>
  Full privacy. No server dependency. No per-screening cost. Packaged with Tauri v2.
</p>

> 🌐 **Idioma / Language:** This README is in English (canonical, for international and Digital Public Goods reviewers). The user interface ships in both Spanish and English.

> **Important notice:** DIRD+ is a research-and-development system. It is **not** an approved medical device and must **not** be used as the sole diagnostic criterion in real clinical settings. Every finding must be reviewed by a qualified ophthalmologist.

[![License: AGPL v3](https://img.shields.io/badge/License-AGPLv3-blue.svg)](LICENSE) [![DOI](https://zenodo.org/badge/1114058644.svg)](https://doi.org/10.5281/zenodo.19666272) [![Website](https://img.shields.io/badge/Website-debaq.github.io%2FDird-10b981)](https://debaq.github.io/Dird/) [![DPG](https://img.shields.io/badge/Digital%20Public%20Good-nominee-orange)](https://digitalpublicgoods.net/standard)

<p align="center">
  <a href="#the-problem">Problem</a> · 
  <a href="#the-solution">Solution</a> · 
  <a href="#bring-your-own-model">Bring Your Own Model</a> · 
  <a href="#market-differentiators">Market</a> · 
  <a href="#technical-architecture">Architecture</a> · 
  <a href="#digital-public-goods-standard-compliance">DPG</a>
</p>

---

## Table of Contents

- [The Problem](#the-problem)
  - [Global Epidemiology](#global-epidemiology)
  - [Chile Context](#chile-context)
  - [The Screening Gap](#the-screening-gap)
- [The Solution](#the-solution)
  - [Value Proposition](#value-proposition)
  - [Clinical Workflow](#clinical-workflow)
  - [Pluggable Clinical-Guideline Engine](#pluggable-clinical-guideline-engine)
  - [Separation of Roles: Clinical Guideline vs. Local LLM](#separation-of-roles-clinical-guideline-vs-local-llm)
- [Bring Your Own Model](#bring-your-own-model)
- [Market Differentiators](#market-differentiators)
- [Technical Architecture](#technical-architecture)
  - [Architecture Diagram](#architecture-diagram)
  - [Technology Stack](#technology-stack)
  - [AI Inference Pipeline](#ai-inference-pipeline)
  - [Database Schema](#database-schema)
  - [Project Structure](#project-structure)
- [Features](#features)
- [Installation & Build](#installation--build)
- [Supported Clinical Guidelines](#supported-clinical-guidelines)
- [Roadmap](#roadmap)
- [Scientific References](#scientific-references)
- [Digital Public Goods Standard Compliance](#digital-public-goods-standard-compliance)
- [Author](#author)

---

## The Problem

### Global Epidemiology

Diabetic retinopathy (DR) is the **leading cause of blindness among working-age adults** (20–74) in developed countries (WHO, World Report on Vision, 2019). More than **80% of this blindness is preventable** with early detection and timely treatment.

| Indicator | Figure | Source |
|-----------|--------|--------|
| Adults with diabetes worldwide | 537 million (2021) | IDF Diabetes Atlas, 10th ed. |
| Projection for 2045 | 783 million | IDF, 2021 |
| DR prevalence among people with diabetes | 22–35% | Teo et al., *Ophthalmology*, 2021; Yau et al., *Diabetes Care*, 2012 |
| People with some degree of DR | ~103 million (2020) | Teo et al., 2021 |
| Vision-threatening DR | 6–10% of people with diabetes | Yau et al., 2012 |
| Blindness cases due to DR | ~860,000 | GBD 2020, *Lancet Global Health* |
| Undiagnosed people with diabetes | ~240 million | IDF, 2021 |

Untreated, roughly **50% of patients with proliferative DR become legally blind within 5 years** (National Eye Institute, NIH).

### Chile Context

Chile faces a particularly critical situation:

| Indicator | Figure | Source |
|-----------|--------|--------|
| Diabetes prevalence in adults | **12.3%** (~1.7 million people) | National Health Survey 2016–2017, MINSAL |
| Suspected diabetes (incl. undiagnosed) | 15.8% | ENS 2016–2017 |
| Prevalence in people over 65 | >30% | ENS 2016–2017 |
| Estimated people with diabetes and some DR | 425,000–595,000 | Cardiovascular Health Program, MINSAL |
| People with diabetes receiving timely eye screening | **Only 15–30%** | Cardiovascular Health Program, MINSAL |
| Ophthalmologists in the country | ~1,100–1,300 | Chilean Society of Ophthalmology |
| Concentrated in the Metropolitan Region | 60–65% | Health Superintendency |
| Density in remote regions | <3 per 100,000 inhabitants | Provider Registry, Health Superintendency |

DR has been included in Chile's **Explicit Health Guarantees (GES)** since 2006, obliging the State to guarantee access to screening and treatment. However, **GES waiting lists for ophthalmology exceed the guaranteed timeframes** in several regions, and the uneven distribution of specialists leaves regions such as Aysén, Magallanes, Atacama, and Araucanía with insufficient coverage.

### The Screening Gap

WHO and the ADA recommend fundus exams **at least every 1–2 years** for everyone with diabetes. Reality differs:

| Country/Region | Timely screening rate | Source |
|----------------|----------------------|--------|
| High-income countries | 50–70% | Piyasena et al., *PLoS ONE*, 2019 |
| Low/middle-income countries | 10–30% | Piyasena et al., 2019 |
| Chile (public primary care) | 15–30% | MINSAL |

**Main barriers:**
- **Shortage of specialists**: estimated global deficit of >200,000 ophthalmologists (Resnikoff et al., *BJO*, 2020)
- **Cost**: an ophthalmologist exam costs USD 50–200 in Latin America
- **Geographic access**: urban concentration of specialists
- **Waiting times**: 6–12 months in the Chilean public system
- **Connectivity**: 40–60% of rural facilities have limited internet (ITU, 2022)

---

## The Solution

DIRD+ is a **desktop application** (Linux/Windows/macOS, packaged with Tauri v2) that runs computer-vision models for diabetic retinopathy detection **entirely on the user's device** via ONNX Runtime:

- Encrypted persistent history, a local SQLite database, and 100% offline operation after installation.

Fundus images are processed locally — **patient data never leaves the device**.

### Value Proposition

| Aspect | What DIRD+ offers | Why it matters |
|--------|-------------------|----------------|
| **Full privacy** | On-device AI inference. Zero data transmission to external servers | Compliance with data-protection and health-data regulations with no extra effort |
| **Zero operating cost** | No licenses, no per-screening fees, no proprietary hardware | Viable for budget-constrained rural primary-care clinics |
| **Works offline** | Models downloaded once, stored locally. History and patients in an encrypted SQLite database | Operational in areas without stable connectivity |
| **Adaptable clinical guidelines** | Pluggable engine: ICDR 2024 (international), MINSAL Chile 2017. Add new guidelines without changing code | Adaptable to local protocols without depending on a foreign vendor |
| **Open source** | Fully auditable source code. Algorithms, thresholds, and criteria are verifiable | Transparency for regulators, researchers, and clinicians |
| **Portability** | `.dird` format (ZIP) to export/import complete patients | Interoperability across installations without vendor lock-in |

### Clinical Workflow

```
1. CAPTURE             2. UPLOAD              3. AI ANALYSIS          4. REVIEW
Fundus camera       →  Upload images       →  Automatic lesion     →  Interactive
(any camera)           into the desktop        detection (ONNX)        multi-layer canvas
                       app, OD / OI            + segmentation          with annotation tools

5. CLASSIFICATION      6. REPORT              7. EXPORT
Severity per        →  Configurable PDF    →  .dird format
clinical guideline     with conclusions       portable across
(ICDR/MINSAL)          and recommendations    installations
```

**Everything happens on the device. No server. No internet (after the first model download).**

### Pluggable Clinical-Guideline Engine

DIRD+ includes a **guideline-agnostic clinical classification engine** — a capability no other DR screening system offers. While every competitor (DART, IDx-DR, EyeArt, Google ARDA) implements a fixed, closed classification criterion — usually a binary "refer / don't refer" result — DIRD+ lets **any clinical guideline be loaded as a JSON file without changing code**.

| Capability | Impact |
|------------|--------|
| **Guidelines as data, not code** | Adding a new country's guideline means writing a JSON file and registering it. No development, no waiting on the vendor |
| **Detailed severity classification** | Not just "refer/don't refer": DIRD+ classifies into 5+ levels (no DR → mild → moderate → severe → proliferative), with per-level treatments, urgency, and follow-up interval |
| **Per-quadrant spatial analysis** | Lesion distribution across 4 quadrants + macular center. Automatically evaluates the 4-2-1 rule (ICDR criterion for severe NPDR) |
| **Multiple simultaneous guidelines** | Classify the same image under ICDR (international) and MINSAL (Chile) to compare criteria. Useful in research and teaching |
| **Integrated treatment protocols** | Each severity level defines clinical actions, urgency (routine/accelerated/urgent), and follow-up interval in days |
| **AI → clinical class mapping** | Translates model detections (microaneurysm, hemorrhage, cotton_wool_spot…) into the guideline's clinical categories |
| **Preserved human correction** | The clinician can modify the generated classification. The system flags `manuallyModified: true` for traceability |
| **Automatic validation** | On load, the system validates structure, level coherence, rules, and protocols. It reports errors and warnings |

**Currently implemented guidelines:** ICDR 2024 (International Council of Ophthalmology) and MINSAL Chile 2017 (Chilean national GES protocol).

To add any other country's guideline, create `public/clinical-guidelines/my_guideline.json` (severity levels, classification rules, treatment protocols, class mapping), register it in `public/clinical-guidelines/index.json`, and the app detects it automatically on reload. No programming knowledge is required — only the clinical knowledge to define the criteria.

### Separation of Roles: Clinical Guideline vs. Local LLM

A core design principle of DIRD+ is the **strict separation between clinical classification and narrative text generation**:

```
┌──────────────────────────────────────────────────────────────────────┐
│                 CLASSIFICATION (local, deterministic)                 │
│                                                                       │
│  AI detections → Clinical-guideline engine → Severity + Treatment     │
│  (local ONNX)    (pluggable JSON)             + Urgency + Follow-up    │
│                                                                       │
│  The CLINICAL GUIDELINE decides. Explicit, auditable, reproducible    │
│  rules. No generative AI. No black box.                               │
└──────────────────────────┬────────────────────────────────────────────┘
                           │
                           ▼ already-classified structured data
┌──────────────────────────────────────────────────────────────────────┐
│                    NARRATION (local, optional)                        │
│                                                                       │
│  Classification data → Local LLM → Clinical conclusion prose          │
│  (severity, lesions,   (llama.cpp)  for the report                    │
│   treatments, urgency)                                                │
│                                                                       │
│  The LLM NARRATES. It receives the decision already made by the       │
│  guideline and writes it as readable clinical text. It does not       │
│  classify or diagnose. The clinician can edit the text before         │
│  finalizing the report.                                               │
└───────────────────────────────────────────────────────────────────────┘
```

The local LLM is an **optional writing aid** that runs in-process via llama.cpp — no remote inference, no data leaves the device. DIRD+ works completely without it: severity, treatments, urgency, and follow-up are determined locally by the clinical guideline. This separation keeps classification **traceable** (to explicit guideline rules), **reproducible** (same image + same guideline = same result), and free of any generative-AI bias on the medical decision.

---

## Bring Your Own Model

DIRD+ ships with reference models (DIRDv1r1, DIRDv2r0) but is **model-agnostic by design**: any organization can train and plug in its own ONNX model — calibrated to its own population — **without modifying the application**.

The full contract is specified in **[`docs/model-interface.md`](docs/model-interface.md)**. In short, a custom model needs:

- **Format**: ONNX, runnable by ONNX Runtime. Input tensor `[1, 3, 640, 640]` (RGB, normalized), output as detection boxes `[x, y, w, h, confidence, class…]`.
- **A model card** (`.json` companion) declaring its class mapping, input/output shapes, and metadata. See [`docs/model-interface.md` §6](docs/model-interface.md) for required fields and [`docs/example-card.json`](docs/example-card.json) for a complete, validated example.
- **Class definitions**: the reference models use class IDs `0–10` (`optic_disc`, `fovea`, `hard_exudate`, `hemorrhage`, `cotton_wool_spot`, `microhemorrhages`, `edema`, `microaneurysm`, `neovascularization`, `venous_beading`, `IRMA`). Custom models may declare **their own classes** in the model card; DIRD+ uses that mapping to label detections in the UI and feed the clinical-guideline engine.

Load it from **Settings → AI Models → Add Model** (file picker). DIRD+ validates the model card schema, checks input/output tensor shapes, and runs an inference sanity check before registering it under `<user_data>/models/`. A standalone validator is also provided:

```bash
python3 scripts/validate_model_card.py my-card.json --onnx my-model.onnx
```

> **Why this matters for screening programs:** a national health service, university, or research group can retrain on its own cohort and deploy inside DIRD+ with no vendor dependency and no code changes — only a model file and a model card.

---

## Market Differentiators

| Feature | DART (TeleDx, Chile) | IDx-DR | Google ARDA | EyeArt | Phelcom Eyer | **DIRD+** |
|---|---|---|---|---|---|---|
| **Processing** | Cloud | Cloud | Cloud | Cloud | Cloud | **Edge (desktop)** |
| **Data leaves device** | Yes | Yes (US) | Yes (Google Cloud) | Yes (US) | Yes (Brazil) | **No** |
| **Works offline** | No | No | No | No | No | **Yes** |
| **Required hardware** | Camera + internet | Topcon NW400 (~USD 15–25K) | Tabletop camera (~USD 5–15K) | Compatible camera (~USD 5–15K) | Smartphone + adapter (~USD 3–5K) | **Any existing camera** |
| **Cost per screening** | Volume license (MINSAL) | ~USD 40–55 | Not commercial | ~USD 8–15 | Subscription | **USD 0** |
| **Open source** | No | No | Partial (papers) | No | No | **Yes** |
| **Multi-guideline** | No | No (binary) | No | No | No | **Yes (ICDR, MINSAL, extensible)** |
| **Detailed classification** | Risk (yes/no) | Binary | 5 levels | Refer/no | Refer/no | **5+ levels per guideline, with quadrants** |
| **Review/annotation canvas** | No | No | No | No | No | **Yes (multi-layer, measurements)** |
| **Regulatory approval** | Published clinical validation (*Eye*) | FDA De Novo, CE | CE, Thai FDA | FDA 510(k), CE | ANVISA | In development |
| **Data sovereignty** | Partial (cloud in Chile) | No (US) | No (Google) | No (US) | No (Brazil) | **Yes (100% local)** |

**No other platform combines edge-computing desktop processing + offline operation + open source + multi-guideline clinical support for DR screening.**

**DART** (TeleDx) is the most mature DR-screening platform deployed by MINSAL in Chile (170+ public facilities, >350,000 exams; sensitivity 94.6%, specificity 74.3%, validated in *Eye*). DART proved AI screening works in Chile, but its cloud architecture requires internet for every exam and transmits images off-device. **DIRD+ does not aim to replace DART but to complement it**: it enables screening in facilities without connectivity, provides detailed per-quadrant analysis tools for the clinician, and offers an open-source alternative without vendor lock-in.

### Why existing solutions haven't closed the gap

| Barrier | How it hurts | How DIRD+ solves it |
|---------|--------------|---------------------|
| **Internet dependency** | 95%+ of solutions require cloud. Rural areas that most need screening have the worst connectivity (e.g. Google ARDA failed in rural Thai clinics due to network issues — Beede et al., *CHI*, 2020) | Works 100% offline after the first download |
| **Cost per screening** | USD 8–55 per screening adds up; for 1.7M Chileans with diabetes that is USD 13–93M/year in software licenses alone | USD 0 per screening |
| **Proprietary hardware** | IDx-DR requires a Topcon NW400 camera (~USD 25K), creating vendor lock-in | Works with any fundus image |
| **Data sovereignty** | Retinal images (biometric data) sent to servers in the US, China, or Singapore | Data never leaves the device |
| **Clinical adaptability** | Binary result without adaptation to local protocols | Multi-guideline: MINSAL Chile, ICDR, or custom guidelines |
| **Vendor lock-in** | If the vendor raises prices or disappears, the clinic loses screening capacity | Open source; data exportable in an open format |

### Data sovereignty as a regulatory advantage

DIRD+'s edge-computing architecture is compliant **by design**: there is no data to protect in transit because it never leaves the device. This aligns with Chile's Law 21.096 (biometric data as a constitutional protection), Chile's Law 21.719 (2024, GDPR-aligned), and the EU GDPR's treatment of health data as a special category with cross-border transfer restrictions (Art. 9, 44–49).

---

## Technical Architecture

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                   USER DEVICE (Tauri desktop)                   │
│                                                                 │
│  ┌────────────────┐  ┌───────────────────┐  ┌───────────────┐  │
│  │   React 18     │  │  ONNX Runtime     │  │  SQLite +     │  │
│  │   TypeScript   │  │  (WebAssembly)    │  │  SQLCipher    │  │
│  │                │  │                   │  │  (AES-256)    │  │
│  │  ┌──────────┐  │  │  ONNX models:     │  │  8 tables:    │  │
│  │  │ Canvas   │  │  │  - Detection      │  │  - patients   │  │
│  │  │ Konva    │◄─┼──┤  - Segmentation   │  │  - sessions   │  │
│  │  │ layers   │  │  │                   │  │  - images     │  │
│  │  └──────────┘  │  │  Analysis:        │  │  - detections │  │
│  │                │  │  - DR classifier  │  │  - segments   │  │
│  │  ┌──────────┐  │  │  - Quadrants      │  │  - reports    │  │
│  │  │ PDF      │  │  │  - Macular edema  │  │  - measures   │  │
│  │  │ jsPDF    │  │  │  - Cup/disc       │  │  - classif.   │  │
│  │  └──────────┘  │  │                   │  │               │  │
│  │                │  │  OpenCV.js         │  └───────────────┘  │
│  │  ┌──────────┐  │  │  optic-disc       │  ┌───────────────┐  │
│  │  │ Clinical │  │  │  refinement       │  │  Local LLM    │  │
│  │  │ guidelines│ │  │                   │  │  llama.cpp    │  │
│  │  │ ICDR     │  │  │  Optimizations:   │  │  (on-demand,  │  │
│  │  │ MINSAL   │  │  │  - SIMD           │  │  report prose)│  │
│  │  └──────────┘  │  │  - Multi-thread   │  └───────────────┘  │
│  └────────────────┘  └───────────────────┘                     │
│                                                                 │
│         All AI inference happens here ▲                         │
│         100% local — no backend, no network                     │
└─────────────────────────────────────────────────────────────────┘
```

### Technology Stack

**Desktop shell:** Tauri v2 (native cross-platform shell, Rust + WebView), WebKitGTK 4.1 (Linux webview), Rust 1.93+.

**Frontend:** React 18.3, TypeScript 5.7 (strict), Vite 6, Tailwind CSS 3.4, Radix UI, React Router 6, Zustand 5 (global state: config, canvas, patient), Framer Motion 11, i18next 24.2 (Spanish/English), Vitest + happy-dom.

**AI & inference:** ONNX Runtime Web 1.23 (WebAssembly engine running inside the Tauri webview), ONNX models (detection bounding boxes + segmentation masks), OpenCV.js (optic-disc refinement), llama.cpp via the `llama-cpp-2` Rust crate (optional in-process LLM for report prose).

**Storage:** SQLite with SQLCipher (`rusqlite`, `bundled-sqlcipher-vendored-openssl`) for the AES-256-encrypted local database; Argon2id key derivation (`src-tauri/src/crypto.rs`); JSZip for the portable `.dird` (ZIP) export format.

**Reports:** jsPDF 2.5 + jspdf-autotable 3.8 (client-side PDF generation).

### AI Inference Pipeline

Image processing runs entirely in WebAssembly, on-device:

```
Fundus image (any camera)
  │
  ▼ 1. PREPROCESS    Resize to 640×640, normalize pixel values
  │
  ▼ 2. ONNX INFERENCE   Detection model → boxes with class + confidence
  │                     Segmentation model → per-lesion pixel masks
  │                     (SIMD enabled, Intel/AMD/ARM CPU profiles)
  │
  ▼ 3. POST-PROCESS   Non-Maximum Suppression (IoU 0.45), confidence threshold
  │
  ▼ 4. SPATIAL ANALYSIS   Quadrant distribution (4 zones + center),
  │                       macular-edema detection, cup/disc ratio (OpenCV.js),
  │                       spatial calibration from the optic disc
  │
  ▼ 5. CLINICAL CLASSIFICATION   Apply selected guideline (ICDR 2024 / MINSAL 2017),
  │                              map lesions → guideline criteria, evaluate 4-2-1 rule,
  │                              produce severity, treatments, follow-up, urgency
  │
  ▼ 6. STORAGE   Persist to the encrypted SQLite database
```

**Detectable classes:** microaneurysms, hemorrhages (dot/blot), hard exudates, cotton-wool spots, neovascularization, optic disc, fovea, edema, venous beading, IRMA. **Severity levels (ICDR 2024):** no DR → mild NPDR → moderate NPDR → severe NPDR → proliferative DR.

### Database Schema

Local **SQLite database encrypted at rest with SQLCipher (AES-256)**, 8 tables:

| Table | Key fields | Purpose |
|-------|------------|---------|
| **patients** | patientId, name, diabetes (type/duration), HTN, dyslipidemia, medications | Demographics and clinical data |
| **sessions** | patientId, date, modelVersions, locked, type (normal/combined) | Clinical visits |
| **images** | sessionId, eyeType (OD/OI), originalBlob, order | Fundus images |
| **detections** | imageId, type (ai/manual), bbox, class, confidence | Lesion bounding boxes |
| **segmentations** | imageId, type (ai/manual), maskData, class, opacity | Segmentation masks |
| **imageClassifications** | imageId, severity, guideline, treatments[], followupDays, urgency, rationale, manuallyModified | Per-guideline DR classification |
| **reports** | sessionId, type (preview/final), pdfBlob, evaluatorNotes, conclusionEdited | Generated PDF reports |
| **measurements** | imageId, origin, destination, distancePixels, distanceDD | Calibrated measurements |

The `.dird` container format is specified in [`docs/dird-format.md`](docs/dird-format.md).

### Project Structure

```
src/
├── components/
│   ├── canvas/               # Multi-layer annotation canvas (Konva)
│   │   └── advanced-editor/  # Advanced editor with specialized tools
│   ├── patients/             # Patient management, export/import
│   ├── upload/               # Image upload, gallery, session view
│   ├── reports/              # PDF report generation
│   ├── settings/             # Settings (models, processing, appearance, security)
│   ├── onboarding/           # First-run security wizard
│   ├── demo/                 # Demo patient and loading screen
│   └── ui/                   # Reusable UI primitives (Radix + Tailwind)
├── lib/
│   ├── ai/                   # InferenceService, ONNXModelManager, ModelDownloader, llm-client
│   ├── analysis/             # ImageDRClassifier, QuadrantCalculator, EdemaDetector,
│   │                         # HemorrhageDetector, MicroaneurysmDetector,
│   │                         # OpticDiscCuppingDetector, SpatialCalibrator
│   ├── clinical-guidelines/  # GuidelineLoader, MultiGuidelineClassifier
│   ├── db-sql/               # SQLite access layer (shim, mappers, migrator)
│   ├── db/                   # Legacy Dexie schema (one-time migration only)
│   ├── export/               # DirdExporter, DirdImporter (.dird ZIP format)
│   ├── pdf/                  # PDF report rendering engine
│   ├── classes/              # ClassManager (model class metadata)
│   └── api/                  # ReportAIService (local-LLM report polishing)
├── stores/                   # Zustand global state (config, canvas, patient)
├── i18n/                     # Internationalization (Spanish/English)
├── hooks/                    # Custom hooks
├── types/                    # TypeScript interfaces
└── App.tsx                   # Main router + parallel initialization
src-tauri/                    # Rust shell: crypto (Argon2id), SQLCipher db, llama.cpp LLM, model registry
```

---

## Features

- **Patient & session management** — create, edit, archive, and search patients; clinical data (diabetes type/duration, HTN, dyslipidemia, medications); sessions as clinical visits; preloaded demo patient; combined sessions for longitudinal analysis.
- **On-device AI analysis** — dual models (detection + segmentation) on ONNX Runtime (WebAssembly) with SIMD and multi-threading; models downloaded once from [`Debaq/dird_models`](https://github.com/Debaq/dird_models) and stored locally; configurable confidence threshold; per-CPU optimization; batch processing; persistent per-inference performance metrics exportable to JSON.
- **Interactive annotation canvas** — 5 layers (original image, AI detections, AI segmentations, manual annotations, measurements); tools for selection, freehand, polygon, distance/area measurement, zoom, pan; per-layer visibility/opacity/lock; clinical overlays (retinal quadrants, macular zone, optic-disc area); human correction over AI results.
- **Multi-guideline clinical classification** — severity per selected guideline; per-quadrant analysis; specialized detectors (hemorrhages, microaneurysms, macular edema, cup/disc); 4-2-1 rule; output of severity, treatments, follow-up, urgency, rationale; clinician can adjust the generated classification.
- **PDF report generation** — editable preview and final report; clinical conclusion produced locally by the active guideline, with **optional prose polishing by the embedded local LLM (no network)**; configurable sections; customizable gallery; evaluator notes and signature; patient fields hideable for privacy.
- **At-rest encryption** — first-run wizard sets up a dual-password model (application + export); SQLCipher AES-256 database and AES-256-GCM `.dird` containers; Argon2id key derivation; encryption-status badge always visible.
- **Session comparison** — compare statistics across 2+ sessions of the same patient; detection counts, severity, temporal trend; combined sessions with origin traceability.
- **Export & import** — `.dird` (ZIP) with complete data; three export levels (full patient, single session, all data); ID remapping on import; collision detection before overwriting.

---

## Installation & Build

DIRD+ is distributed as a **desktop application** (Linux, Windows, macOS) packaged with Tauri v2. The embedded local webview runs the frontend — there is no HTTP server.

### Prerequisites

- **Rust toolchain** (via [rustup](https://rustup.rs/))
- **Node.js 20+** and [pnpm](https://pnpm.io/) (`npm i -g pnpm`)
- WebKitGTK system dependencies (Linux):
  - Arch: `sudo pacman -S webkit2gtk-4.1 libayatana-appindicator librsvg patchelf base-devel cmake`
  - Debian/Ubuntu: `sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev patchelf build-essential cmake`
  - (`cmake` and a C/C++ toolchain are required to build the embedded llama.cpp.)

### Clone + install

```bash
git clone https://github.com/Debaq/Dird.git
cd Dird
pnpm install
```

### Development

```bash
pnpm tauri:dev          # launch the desktop app with HMR
```

The first Rust build takes ~2–3 min; subsequent launches are near-instant.

### Production build

```bash
pnpm tauri:build        # build frontend + Rust in release mode
```

The binary lands in `./src-tauri/target/release/app`. **No AppImage/deb/rpm are produced by default** (`bundle.active=false` in `src-tauri/tauri.conf.json`); set it to `true` to produce distribution packages.

### Tests

```bash
pnpm test               # Vitest (52 tests)
cargo test --manifest-path src-tauri/Cargo.toml   # Rust unit tests (crypto, db)
```

Coverage: ONNX pipeline (NMS, post-process), clinical-guideline engine (ICDR 2024 integration, 4-2-1 rule), guideline validator, model-card validator, crypto, and SQLite layer.

> DIRD+ is 100% local: it needs no environment variables and no remote backend. All inference (ONNX detection + LLM narration) runs inside the Tauri process.

---

## Supported Clinical Guidelines

| Guideline | Country | Description | Reference |
|-----------|---------|-------------|-----------|
| **ICDR 2024** | International | International Clinical Diabetic Retinopathy Disease Severity Scale | International Council of Ophthalmology |
| **MINSAL Chile 2017** | Chile | Diabetic Retinopathy Clinical Guideline — Ministry of Health | GES Problem #31 |

The guideline system is extensible — new guidelines are added as JSON files without modifying code.

---

## Roadmap

See [`ROADMAP.md`](ROADMAP.md) for the full public roadmap. Highlights:

- **Technical validation** on public datasets (APTOS 2019, IDRiD) and per-device inference benchmarks.
- **Clinical validation** with 200–500 images graded by Chilean ophthalmologists; sensitivity/specificity against a gold standard; pilot in a rural primary-care clinic.
- **Technical features**: full IRMA and venous-beading detection (4-2-1 criteria), DICOM camera integration, privacy-preserving federated learning.
- **Regulatory**: dossier preparation for Chile's ISP (software medical device), alignment with the FDA SaMD framework.

---

## Scientific References

Full references supporting the epidemiological, clinical, and technical context are in [`REFERENCES.md`](REFERENCES.md).

---

## Digital Public Goods Standard Compliance

DIRD+ aligns with the [Digital Public Goods Standard](https://digitalpublicgoods.net/standard) maintained by the Digital Public Goods Alliance (DPGA).

| # | Indicator | Status | Evidence |
|---|-----------|:---:|----------|
| 1 | **SDG Relevance** | ✅ | SDG 3 (Health), SDG 9 (Innovation), SDG 10 (Reduced Inequalities). See [project website](https://debaq.github.io/Dird/). |
| 2 | **Open Licensing** | ✅ | [GNU AGPL-3.0](LICENSE) (OSI-approved). Reference AI models published under AGPL-3.0 in [dird_models](https://github.com/Debaq/dird_models). |
| 3 | **Clear Ownership** | ✅ | Owned by Nicolás Baier Quezada (lead) and the DIRD+ team, Universidad Austral de Chile (UACh). See [project website](https://debaq.github.io/Dird/) and the Zenodo deposit ([DOI 10.5281/zenodo.19687226](https://doi.org/10.5281/zenodo.19687226)). |
| 4 | **Platform Independence** | ✅ | Built on a fully open stack (Tauri, React, ONNX Runtime, SQLite, Rust). Runs offline; no proprietary services required. |
| 5 | **Documentation** | ✅ | This README, [project website](https://debaq.github.io/Dird/), [docs/](docs/), [preprint](https://doi.org/10.64898/2026.04.26.26351745), and the [Wiki](https://github.com/Debaq/Dird/wiki). |
| 6 | **Non-PII Data Extraction** | ✅ | All non-PII data (models, configurations, derived metrics) uses open standards: ONNX, JSON, SQLite, ZIP. See [docs/dird-format.md](docs/dird-format.md) and [docs/model-interface.md](docs/model-interface.md). |
| 7 | **Privacy & Applicable Laws** | ✅ | See [PRIVACY.md](PRIVACY.md). Compatible by design with GDPR, HIPAA, and Chilean Laws 19.628 and 21.719. |
| 8 | **Open Standards & Best Practices** | ✅ | ONNX, ISO 32000 (PDF), SQLite, JSON (RFC 8259), Argon2id (RFC 9106), AES-256-GCM. SemVer 2.0.0, Privacy by Design. |
| 9A | **Data Privacy & Security** | ✅ | Local-only processing. AES-256 at-rest encryption (SQLCipher + `.dird` GCM) with Argon2id key derivation and a dual-password model. See [PRIVACY.md](PRIVACY.md) and [SECURITY.md](SECURITY.md). |
| 9B | **Inappropriate & Illegal Content** | ✅ N/A | DIRD+ does not collect, store, or distribute user-generated content. It is a single-operator clinical tool. |
| 9C | **Protection from Harassment** | ✅ N/A | DIRD+ does not facilitate inter-user interactions within the application. |

### Key documents

- 📄 [PRIVACY.md](PRIVACY.md) — privacy policy and data handling
- 🔒 [SECURITY.md](SECURITY.md) — vulnerability disclosure policy
- 🗺️ [ROADMAP.md](ROADMAP.md) — public development roadmap
- 📦 [docs/dird-format.md](docs/dird-format.md) — `.dird` file-format specification
- 🧠 [docs/model-interface.md](docs/model-interface.md) — ONNX model contract for plug-in models

### Scientific citation

If you use DIRD+ in research, please cite:

- **Application**: Baier Quezada, N., Uribe, V., López, F., Almendras, C., Barrientos, H., & Leiva, C. (2026). *DIRD+ — Diabetic Imaging Retinopathy Detector*. Zenodo. https://doi.org/10.5281/zenodo.19687226
- **Reference model**: Baier Quezada, N., Uribe, V., López, F., Almendras, C., Barrientos, H., & Leiva, C. (2026). *DIRDv2r0 — Diabetic retinopathy detection model*. Zenodo. https://doi.org/10.5281/zenodo.19685466
- **Preprint**: Baier Quezada, N., Uribe, V., López, F., Almendras, C., Barrientos, H., & Leiva, C. (2026). *External validation of DIRD+ on APTOS 2019*. medRxiv. https://doi.org/10.64898/2026.04.26.26351745

---

## Authors

Universidad Austral de Chile, Puerto Montt 🇨🇱

- **Nicolás Baier Quezada** — lead author & maintainer
- **Vanessa Uribe**
- **Fernanda López**
- **Carolina Almendras**
- **Haydee Barrientos**
- **Cristian Leiva**

Bug reports and contributions via [issues](https://github.com/Debaq/Dird/issues) and pull requests.

DIRD+ is free software under the **GNU AGPLv3** license (strong copyleft). Contributions are welcome.
