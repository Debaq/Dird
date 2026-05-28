# DPG Submission Checklist — DIRD+ v2.2.0

**Last updated**: 2026-05-28
**Target release**: v2.2.0 (first DPG-compliant cut)
**Status**: ready to submit

This document captures the state of every DPG Standard indicator and every commitment made in the DPGA application form. Open items must be closed before pressing "submit" on the application portal.

## 1. DPG Standard indicators

| # | Indicator | Required | Status | Evidence |
|---|-----------|----------|:---:|----------|
| 1 | SDG Relevance | ✅ | ✅ | README §DPG, project website |
| 2 | Open Licensing | ✅ | ✅ | `LICENSE` AGPL-3.0; `Debaq/dird_models` AGPL-3.0 (verified via `gh api`) |
| 3 | Clear Ownership | ✅ | ✅ | README §DPG, Zenodo deposit |
| 4 | Platform Independence | ✅ | ✅ | Tauri 2 + Rust + ONNX Runtime (all OSS), runs offline |
| 5 | Documentation | ✅ | ✅ | README, `docs/dird-format.md`, `docs/model-interface.md`, preprint |
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
| Removal of remote LLM service (`token-service` → local implementation) | ✅ | `src/lib/api/token-service.ts` rewritten to call `llmGenerate` |
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
| Website parity EN ↔ ES (landing) | ✅ | `docs/index.html` (ES) + `docs/en.html` (EN) |
| App UI parity EN ↔ ES | ✅ | 1210/1210 i18n keys, 0 Spanish-only leaf strings remaining |

## 3. Pending items (post-submission tracker)

These were not part of the pre-submission commitments and are openly disclosed in `ROADMAP.md`.

| Item | Target | Tracker |
|---|---|---|
| Runtime swap of Dexie → SQLite (requires real-data testing) | v2.2.x | F0.8b in `roadmap_dpg.md` |
| ~~Replace remote LLM token service with local LLM~~ | ✅ v2.2.0 | — completed in this release |
| E2E test suite (Playwright) covering wizard, login, encrypted export/import, model install, migration | v2.2.x | F0.12 — manual checklist below until automated |

## 4. Pre-submission manual QA checklist

Run before tagging `v2.2.0`:

- [ ] `pnpm test` — vitest passes (currently 52 tests, 7 files)
- [ ] `cargo test --lib --manifest-path src-tauri/Cargo.toml` — Rust unit tests pass (9: crypto 5/5, db 4/4)
- [ ] `npx tsc --noEmit` — TypeScript clean
- [ ] `cargo check --manifest-path src-tauri/Cargo.toml` — Rust check clean
- [ ] `cargo tauri build --debug` — bundle compiles
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
- [ ] `python3 scripts/validate_model_card.py docs/example-card.json` returns 0 (provide an example card)
- [ ] `markdown-link-check` on README, PRIVACY, SECURITY, ROADMAP, docs/dird-format.md, docs/model-interface.md
- [ ] Tag: `git tag v2.2.0 && git push origin v2.2.0` (triggers `.github/workflows/release.yml`)
- [ ] Verify release artifacts attached on GitHub Releases
- [ ] Update DPGA submission with link to v2.2.0 release tag

## 5. Submission link

https://www.digitalpublicgoods.net/

After approval, replace the "DPG nominee" badge in `README.md` with the official "DPG approved" badge provided by DPGA.
