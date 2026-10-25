# DIRD+ Public Roadmap

This document lists planned improvements to DIRD+. It is a **public commitment**, not a marketing forecast: items here are tracked in GitHub Issues and Releases.

Items move through these states: **Planned → In progress → Released → Validated**.

---

## v2.0 — Security and openness (**released**: v2.0.0 2026-04-20 → v2.2.1 2026-06-24)

All items below shipped and are verifiable in the repository (`src-tauri/src/crypto.rs`, `db.rs`, `models.rs`; `src/components/onboarding/FirstRunWizard.tsx`; `src/components/layout/EncryptionBadge.tsx`; `docs/`). Audited 2026-10-24.

### Security
- [x] **At-rest encryption for the SQLite database** using SQLCipher (AES-256).
- [x] **At-rest encryption for `.dird` export files** using AES-256-GCM.
- [x] **Argon2id key derivation** from user-provided encryption password (OWASP 2025 parameters).
- [x] **Dual-password model**: separate user login password and encryption password.
- [x] **First-launch security wizard** to set up both passwords with clear UX.
- [x] **Encryption status indicator** visible in the main UI.

### Model agnosticism
- [x] **External ONNX model loader**: in-app dialog to select a local `.onnx` model file.
- [x] **Model registry** within the application configuration directory.
- [x] **Model validation** on load: input/output tensor shapes, class metadata.
- [x] **Documentation**: `docs/reference/model-interface.md` specifying the model contract.

### Documentation
- [x] `PRIVACY.md` published.
- [x] `SECURITY.md` published.
- [x] `ROADMAP.md` published (this document).
- [x] `docs/reference/dird-format.md` published.
- [x] `docs/reference/model-interface.md` published.
- [x] `LICENSE` confirmed in `dird_models`.
- [x] DPG Standard compliance section added to README.
- [x] GitHub Security Advisories / private vulnerability reporting enabled on the repository (see `SECURITY.md`).

### Internationalization
- [x] English version of the project website at full feature parity with Spanish.

---

## v2.1 — Clinical usability (partially released)

### Workflow improvements
- [ ] Bulk import of retinal images for screening campaigns (not started).
- [ ] Improved patient search and filtering.
- [ ] Configurable PDF report templates.
- [x] Multi-language UI: English, Spanish (released v2.2.1; ~1,650 keys, no hardcoded strings).
- [ ] Portuguese UI.

### Audit and accountability
- [x] **Audit trail of human correction** of AI findings (`manuallyModified`, operator per session) — released v2.2.
- [ ] Encrypted access/modification log and session timeout → moved to v3.1.

---

## v2.2 — Model validation and improvements (validation released; retraining moved to v3.0)

### Validation
- [x] **External validation on DDR** (China, n = 12,522, raw images) — `validation/experiment-4-ddr/`, AUC 0.84 OOD, frozen thresholds transport.
- [x] **Subgroup / fairness analysis** (severity, lesion type, site) — `validation/experiment-5-fairness/`.
- [~] **External validation on Messidor-2** — preliminary on a preprocessed mirror (`experiment-3-messidor/`); re-run on raw ADCIS images pending.
- [x] **APTOS 2019 re-labelled as in-distribution** for detector v2 (the model was trained on 500 APTOS images; IDs not recoverable).
- [ ] **External validation on EyePACS** (US cohort).
- [x] Validation reports with bootstrap 95 % CIs, intended-use and clinical-risk statements, TRIPOD+AI mapping (`validation/`).

### Reference model
Moved to **v3.0** below.

---

## v3.0 — Reference models v3 and native inference (in progress, target Q4 2026)

### Reference models
- [ ] **Detector v3** retrained from scratch on public datasets with auditable provenance (DDR lesion-detection + IDRiD; no APTOS), microaneurysm and hemorrhage as separate classes, scale-normalised tiling for small lesions.
- [ ] **Expert-in-the-loop annotation pipeline** in Annotix: blinded double reading, inter-reader agreement, hash-chained audit log, published as `dird_annotations` (annotations only, no images).
- [ ] **Image-level grader** (5-grade classifier, referable probability, calibrated) — new model role `grader`, model-card schema 2.1.
- [ ] **Fusion and discrepancy flag** between detector and grader, configurable per clinical guideline (JSON).

### Runtime
- [ ] **Native ONNX Runtime** in the Rust backend (`ort`), two-pass (global + tiled) inference; WebAssembly kept as fallback.
- [ ] Model and grader versions in the PDF report and in `.dird` exports (format 2.1).

### Publication
- [ ] Software article submitted to *Computer Methods and Programs in Biomedicine*.

---

## v3.1 — Interoperability (planned, 2027)

### Clinical standards
- [ ] **DICOM input support** for retinal images.
- [ ] **FHIR-compatible export** of patient records.
- [ ] **SNOMED CT mapping** for diagnostic terms.
- [ ] **ICD-11 export** in clinical reports.

### Multi-user and workflow
- [ ] **Optional local multi-user mode** for shared workstations in clinics.
- [ ] **Role-based access control** within the application.
- [ ] **Blind-read mode** (clinician grades before seeing AI output) to mitigate automation bias.
- [ ] **Session timeout** and encrypted access/modification log.

---

## v3.2 — Segmentation (planned, 2027)

### New AI capabilities
- [ ] Vessel segmentation
- [ ] Microaneurysm segmentation
- [ ] Hemorrhage segmentation
- [ ] Neovascularization segmentation
- [ ] Exudate segmentation

These are in active research; releases will be staged as each class reaches acceptable validation metrics.

---

## Continuous (no fixed version)

- **Security patches**: as needed, see [SECURITY.md](SECURITY.md).
- **Bug fixes**: ongoing, tracked in GitHub Issues.
- **Documentation improvements**: ongoing, contributions welcome.
- **Community engagement**: GitHub Discussions, scientific publications.

---

## How to influence this roadmap

- **Open a GitHub Issue** to propose a feature or report a bug.
- **Start a GitHub Discussion** to discuss broader directions.
- **Submit a Pull Request** if you want to contribute directly.
- **Cite DIRD+ in your research** — peer-reviewed deployment evidence helps prioritize features.

This roadmap is a living document. Priorities may shift based on community feedback, peer review, regulatory developments, and clinical needs identified in deployments.

---

**Project**: DIRD+ — Diabetic Imaging Retinopathy Detector
**Maintainer**: Nicolás Baier Quezada, Universidad Austral de Chile (UACh), Puerto Montt
**License**: GNU Affero General Public License v3.0 (AGPL-3.0)
