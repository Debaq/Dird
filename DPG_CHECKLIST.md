# DPG Submission Checklist — DIRD+ v2.2.0

**Last updated**: 2026-06-05
**Target release**: v2.2.0 (first DPG-compliant cut)
**Status**: ready to submit — automated QA green; manual GUI QA + tag/release pending (see §4)

This document captures the state of every DPG Standard indicator and every commitment made in the DPGA application form. Open items must be closed before pressing "submit" on the application portal.

> **2026-06-05 cleanup pass** (post 2026-05-28): removed all legacy remote backend (PHP, token economy, contribution/sharing upload, installation beacons), the Academy module, and the dead PWA/web-version framing — DIRD+ is now strictly desktop-only and 100% local, matching every privacy claim. Documentation converted to English (README, wiki, repo About, REFERENCES); internal notes moved under `docs/internal/` with a marker README. See `project_backend_purge` / `project_docs_english_overhaul` history.

## 1. DPG Standard indicators

| # | Indicator | Required | Status | Evidence |
|---|-----------|----------|:---:|----------|
| 1 | SDG Relevance | ✅ | ✅ | README §DPG, project website |
| 2 | Open Licensing | ✅ | ✅ | `LICENSE` AGPL-3.0; `Debaq/dird_models` AGPL-3.0 (verified via `gh api`) |
| 3 | Clear Ownership | ✅ | ✅ | README §DPG, Zenodo deposit |
| 4 | Platform Independence | ✅ | ✅ | Tauri 2 + Rust + ONNX Runtime (all OSS), runs offline |
| 5 | Documentation | ✅ | ✅ | README (English), `docs/dird-format.md`, `docs/model-interface.md` (+ `docs/example-card.json`), GitHub Wiki (English, 12 pages), preprint |
| 6 | Non-PII Data Extraction | ✅ | ✅ | Open formats (ONNX, JSON, SQLite, ZIP); spec docs |
| 7 | Privacy & Applicable Laws | ✅ | ✅ | `PRIVACY.md` |
| 8 | Open Standards | ✅ | ✅ | ONNX, PDF, SQLite, JSON, AES-256-GCM, Argon2id (RFC 9106) |
| 9A | Data Privacy & Security | ✅ | ✅ | SQLCipher + AES-256-GCM `.dird` + dual passphrase; `EncryptionBadge` UI |
| 9B | Inappropriate Content | ✅ N/A | ✅ N/A | Single-operator clinical tool, no UGC |
| 9C | Protection from Harassment | ✅ N/A | ✅ N/A | No user-to-user interactions in-app |

## 2. Technical commitments made in the application

### 2.1 At-rest encryption with dual passphrase

| Commitment | Status | Where |
|---|:---:|---|
| AES-256-GCM `.dird` containers | ✅ | `src/lib/export/dird-container.ts`, header v2.0 |
| SQLCipher (AES-256) for the local database | ✅ | `src-tauri/src/db.rs` (`rusqlite` `bundled-sqlcipher-vendored-openssl`) |
| Argon2id KDF, OWASP 2025 parameters (m=64 MiB, t=3, p=4) | ✅ | `src-tauri/src/crypto.rs`; raw key passed to SQLCipher via `PRAGMA key = x'…'` (bypasses internal PBKDF2) |
| Two distinct passwords (application + export) | ✅ | `src/stores/auth-store.ts`, `FirstRunWizard`, `SecuritySettings` |
| First-launch wizard | ✅ | `src/components/onboarding/FirstRunWizard.tsx` |
| Visible encryption-state indicator | ✅ | `src/components/layout/EncryptionBadge.tsx` (always in header) |
| No password-recovery mechanism (Signal/Bitwarden posture) | ✅ | Wizard step 4 acknowledgement; documented in `PRIVACY.md` §5.2 |
| Clean migration v1.0.1 → v2.0 | ✅ | `src/lib/db-sql/migrator.ts` + `MigrationWizard` (backup `.dird` before migration; idempotent via `meta.migrated_from`) |

### 2.2bis Local LLM on-demand (no remote inference)

| Commitment | Status | Where |
|---|:---:|---|
| Embedded llama.cpp backend (in-process inference) | ✅ | `src-tauri/src/llm.rs` via crate `llama-cpp-2` |
| Curated catalog of small open-weight models (9 entries: SmolLM2/TinyLlama/Llama-3.2/Qwen2.5/Gemma-2/Phi-3.5; 230 MB–2.4 GB Q4_K_M) | ✅ | `CATALOG` const in `llm.rs` |
| User-driven download (no bundled weights) with resumable progress events | ✅ | `llm_download` Tauri command + `llm:download_progress` event |
| Settings → AI Models → "Local assistant" UI | ✅ | `src/components/settings/LocalLLMSection.tsx` |
| Chat templating per model family (TinyLlama / ChatML / Llama-3 / Phi-3 / Gemma) | ✅ | `render_prompt` in `llm.rs` |
| Removal of remote LLM service (`token-service` → local implementation) | ✅ | rewritten to call `llmGenerate`; renamed `src/lib/api/token-service.ts` → `report-ai-service.ts` (2026-06-05) |
| 100% local inference (no PII transmitted post-download) | ✅ | Documented in `PRIVACY.md` §6 |

### 2.2 External ONNX model loading (model-agnostic platform)

| Commitment | Status | Where |
|---|:---:|---|
| Settings → AI Models → Add Model file picker | ✅ | `src/components/settings/CustomModelsSection.tsx` |
| Model-card JSON schema validation | ✅ | `src/lib/ai/model-card-validator.ts` (15 vitest cases pass) |
| Input/output shape validation | ✅ | `src/lib/ai/model-registry.ts` `sanityCheckModel` |
| Inference sanity check on a test tensor | ✅ | Idem |
| Persistent registry at `<user_data>/models/` | ✅ | `src-tauri/src/models.rs` (`models_install/list/uninstall/set_active`) |
| Active-model selection from the list | ✅ | `models_set_active` + UI |
| `scripts/validate_model_card.py` CLI | ✅ | Standalone, optional `--onnx` for ORT sanity check |

### 2.3 Repository-level commitments

| Commitment | Status | Notes |
|---|:---:|---|
| GitHub Security Advisories enabled on `Debaq/Dird` | ✅ | Activated 2026-05-26 via `gh api -X PUT … /private-vulnerability-reporting` |
| GitHub Security Advisories enabled on `Debaq/dird_models` | ✅ | Same procedure |
| AGPL-3.0 LICENSE in `dird_models` repo | ✅ | Verified via `gh api repos/Debaq/dird_models` (`license.spdx_id = "AGPL-3.0"`) |
| Website parity EN ↔ ES (landing) | ✅ | `docs/index.html` (ES) + `docs/en.html` (EN); web-version framing removed 2026-06-05 |
| App UI parity EN ↔ ES | ✅ | 1052/1052 i18n keys, 0 mismatches (academy/contribution/token keys removed in both) |

## 3. Pending items (post-submission tracker)

These were not part of the pre-submission commitments and are openly disclosed in `ROADMAP.md`.

| Item | Target | Tracker |
|---|---|---|
| ~~Runtime swap of Dexie → SQLite~~ | ✅ v2.2.0 | — completed in F0.8b (commit `ae0d26f4`) |
| ~~Replace remote LLM token service with local LLM~~ | ✅ v2.2.0 | — completed in this release |
| E2E test suite (Playwright) covering wizard, login, encrypted export/import, model install, migration | v2.2.x | F0.12 — manual checklist below until automated |

## 4. Pre-submission manual QA checklist

Run before tagging `v2.2.0`:

- [x] `pnpm test` — vitest passes (52 tests, 7 files) — verified 2026-06-05
- [x] `cargo test --lib` — Rust unit tests pass (9/9) — verified 2026-06-05 (fixed table-count test after removing `pending_contributions`)
- [x] `npx tsc --noEmit` — TypeScript clean — verified 2026-06-05
- [x] `cargo check` — Rust check clean (3 warnings) — verified 2026-06-05
- [ ] `cargo tauri build --debug` — bundle compiles
- [x] i18n EN↔ES parity — 1052/1052 keys, 0 mismatches — verified 2026-06-05
- [ ] Run `cargo tauri dev`:
  - [ ] First-launch wizard appears, asks both passwords
  - [ ] Database opens after wizard; `EncryptionBadge` shows "Cifrado / Encrypted"
  - [ ] Re-launch shows `LoginScreen`; wrong password rejected with toast
  - [ ] Export a session to `.dird` (encrypted)
  - [ ] Import the `.dird` on a clean install with correct password → restores
  - [ ] Import with wrong password → graceful error
  - [ ] Settings → AI Models → Add Model with a valid ONNX + card → installs and activates
  - [ ] Install with invalid card → errors enumerated, no FS side-effects
  - [ ] Settings → AI Models → Local assistant → download a small model (SmolLM2 360M, ~230 MB) → activate → "Probar" returns text
  - [ ] `processConclusion` (Report generator) routes through local LLM when one is active
  - [ ] If running upgrade scenario with v1.0.1 IndexedDB data → MigrationWizard appears, backup downloaded, migration completes
- [x] `python3 scripts/validate_model_card.py docs/example-card.json` returns 0 — example card created & validated 2026-06-05
- [ ] `markdown-link-check` on README, PRIVACY, SECURITY, ROADMAP, docs/dird-format.md, docs/model-interface.md
- [ ] **Sensitive data**: the old admin credential hash still lives in GitHub PR refs `refs/pull/28` (closed) and `refs/pull/29` (merged) — removed from all branches/tags via `git filter-repo`, but PR refs need GitHub Support to purge. Low risk (the backend it protected no longer exists); rotate only if that backend is still live.
- [ ] Tag: `git tag v2.2.0 && git push origin v2.2.0` (triggers `.github/workflows/release.yml`)
- [ ] Verify release artifacts attached on GitHub Releases
- [ ] Update DPGA submission with link to v2.2.0 release tag

## 5. Submission link

https://www.digitalpublicgoods.net/

After approval, replace the "DPG nominee" badge in `README.md` with the official "DPG approved" badge provided by DPGA.
