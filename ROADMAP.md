# DIRD+ Public Roadmap

This document lists planned improvements to DIRD+. It is a **public commitment**, not a marketing forecast: items here are tracked in GitHub Issues and Releases.

Items move through these states: **Planned → In progress → Released → Validated**.

---

## v2.0 — Security and openness (in progress)

Target: before submission to the Digital Public Goods Alliance (DPGA).

### Security
- [ ] **At-rest encryption for the SQLite database** using SQLCipher (AES-256).
- [ ] **At-rest encryption for `.dird` export files** using AES-256-GCM.
- [ ] **Argon2id key derivation** from user-provided encryption password (OWASP 2025 parameters).
- [ ] **Dual-password model**: separate user login password and encryption password.
- [ ] **First-launch security wizard** to set up both passwords with clear UX.
- [ ] **Encryption status indicator** visible in the main UI.

### Model agnosticism
- [ ] **External ONNX model loader**: in-app dialog to select a local `.onnx` model file.
- [ ] **Model registry** within the application configuration directory.
- [ ] **Model validation** on load: input/output tensor shapes, class metadata.
- [ ] **Documentation**: `docs/model-interface.md` specifying the model contract.

### Documentation
- [ ] `PRIVACY.md` published.
- [ ] `SECURITY.md` published.
- [ ] `ROADMAP.md` published (this document).
- [ ] `docs/dird-format.md` published.
- [ ] `docs/model-interface.md` published.
- [ ] `LICENSE` confirmed in `dird_models`.
- [ ] DPG Standard compliance section added to README.
- [ ] GitHub Security Advisories enabled on the repository.

### Internationalization
- [ ] English version of the project website at full feature parity with Spanish.

---

## v2.1 — Clinical usability (planned, Q3 2026)

### Workflow improvements
- [ ] Bulk import of retinal images for screening campaigns.
- [ ] Improved patient search and filtering.
- [ ] Configurable PDF report templates.
- [ ] Multi-language UI: English, Spanish, Portuguese.

### Audit and accountability
- [ ] **Audit log** of access and modifications, stored encrypted alongside the database.
- [ ] **Session timeout** for in-app inactivity.

---

## v2.2 — Model improvements (planned, Q4 2026)

### Validation
- [ ] **External validation on Messidor-2** (European cohort, heterogeneous fundus cameras).
- [ ] **External validation on EyePACS** (US cohort).
- [ ] Publication of validation report and operating point recalibration.

### Reference model
- [ ] **Targeted retraining** for weaker classes: hemorrhage (current mAP 0.16), hard exudate (0.36).
- [ ] **Dedicated annotation** for microhemorrhage vs. microaneurysm separation.
- [ ] Release of DIRDv3 reference model.

---

## v3.0 — Interoperability (planned, 2027)

### Clinical standards
- [ ] **DICOM input support** for retinal images.
- [ ] **FHIR-compatible export** of patient records.
- [ ] **SNOMED CT mapping** for diagnostic terms.
- [ ] **ICD-11 export** in clinical reports.

### Multi-user
- [ ] **Optional local multi-user mode** for shared workstations in clinics.
- [ ] **Role-based access control** within the application.

---

## v3.1 — Segmentation (planned, 2027)

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
