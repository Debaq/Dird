# Roadmap DPG — DIRD+

**Fecha base:** 2026-05-20
**Versión actual del código:** 1.0.1 (export), schema Dexie v16
**Objetivo:** llegar a v2.0 con compromisos DPG cumplidos antes de enviar postulación.

## Estado actual vs compromisos (resumen ejecutivo)

| Compromiso | Estado | Evidencia |
|---|---|---|
| PRIVACY.md / SECURITY.md / ROADMAP.md / docs/dird-format.md / docs/model-interface.md | ✅ copiados al repo (2026-05-20) | archivos en raíz + `docs/` |
| DPG Compliance en README | ✅ sección agregada + TOC actualizada | `README.md` antes de "## Autor" |
| AES-256-GCM para `.dird` | ❌ cero | `dird-exporter.ts` empaqueta plano con JSZip |
| SQLCipher (AES-256) base local | ⚠️ **inconsistencia grave** | hoy no hay SQLite, hay **IndexedDB/Dexie v16**. Ver ⚠️1 |
| Argon2id KDF | ❌ cero | sin libs crypto en `package.json` ni `Cargo.toml` |
| Doble contraseña (login + cifrado) | ❌ cero | login actual = JWT remoto en `AdminLogin.tsx` (no local). Ver ⚠️2 |
| Wizard primer arranque | ❌ no existe | sin pantalla onboarding |
| Indicador estado cifrado en UI | ❌ no existe | — |
| Migración v1→v2 sin pérdida | ❌ no diseñada | Dexie tiene versionado, pero sin path a cifrado |
| Carga modelos ONNX externos | ⚠️ parcial | `onnx-manager.ts`, `model-downloader.ts`, `ModelSettings.tsx` ya existen, pero hardcoded a `Debaq/dird_models` y sin selector |
| Model card / metadata | ✅ parcial | `model-metadata.ts` define interface; falta JSON-Schema y validador estricto |
| `scripts/validate_model_card.py` | ❌ no existe | hay `validation/scripts/debug/validate_dird.py` que parsea, no valida |
| Sanity-check inferencia | ❌ no existe | shapes sí se chequean en `onnx-manager.ts:251` |
| Registro persistente `<user_data>/models/` | ❌ no existe | hoy Cache API del browser (`dird-onnx-models`); Tauri FS sin comandos |
| GitHub Security Advisories activado | ❓ fuera del repo | acción en GitHub UI |
| LICENSE AGPL-3.0 en `dird_models` | ❓ no verificable desde acá | repo externo |
| Web EN feature parity | ✅ landing bilingüe (`docs/index.html` + `docs/en.html`) | ✅ |
| App UI i18n EN/ES | ✅ i18next configurado, `es.json` 69 KB, `en.json` 57 KB | ⚠️ verificar paridad de claves |
| LICENSE AGPL-3.0 repo principal | ✅ | `LICENSE` en raíz |

### Inconsistencias críticas (⚠️) a resolver **antes** de redactar la postulación

**⚠️1 — SQLCipher vs IndexedDB.** La postulación promete SQLCipher pero el código usa Dexie/IndexedDB con 16 migraciones activas (`src/lib/db/schema.ts:164-366`). Tres salidas:
- **(A)** Migrar todo a SQLite via Tauri `tauri-plugin-sql` + SQLCipher. Coste alto (re-escritura de toda la capa data). 15–25 días.
- **(B)** Mantener IndexedDB y cifrar a nivel **registro** (campos sensibles → AES-GCM antes de escribir; índices solo sobre IDs/hashes). Más rápido (5–8 días), pero el compromiso público dice "SQLCipher" explícitamente → riesgo reputacional.
- **(C)** Reformular compromiso a "cifrado equivalente AES-256-GCM por registro con KDF Argon2id" y documentar la decisión técnica. Honesto, evita reescritura masiva. **Recomendado si trabajas solo.**

**⚠️2 — Doble contraseña.** El "login" actual (`AdminLogin.tsx`) es contra backend remoto vía JWT, no un login local de la app. Para DPG el modelo prometido es **local-first sin backend**. Hay que decidir si el login local reemplaza ese flujo admin o convive.

**⚠️3 — Roadmaps duplicados.** Ya hay `Roadmap_dird.md`, `Roadmap_metricas.md`, `Roadmap_sqlite.md`. El nuevo `ROADMAP.md` raíz debe consolidar o referenciar para evitar contradicciones.

---

## FASE 0 — Pre-postulación (bloqueantes DPG)

### F0.1 — Decisión técnica cifrado at-rest (⚠️1)

- **Qué:** elegir entre opción A/B/C y dejarla escrita en `docs/security-architecture.md`.
- **Archivos:** nuevo `docs/security-architecture.md`, actualiza `SECURITY.md`.
- **Esfuerzo:** 0.5 día (decisión + ADR).
- **Dependencias:** ninguna. **Bloquea todo F0.3, F0.4, F0.5.**
- **Aceptación:** ADR firmado, redacción DPG ajustada para reflejar la elección.
- **Riesgo:** elegir A y no terminar antes del envío.

### F0.2 — Documentación DPG (los 5 archivos) ✅ HECHO (2026-05-20)

- **Qué:** copiar al repo PRIVACY.md, SECURITY.md, ROADMAP.md, docs/dird-format.md, docs/model-interface.md. Sumar sección "DPG Standard Compliance" al README (9 indicadores DPGA).
- **Archivos:** raíz + `docs/` + `README.md`. TOC del README también actualizada.
- **Pendiente derivado:**
  - Ajustar `PRIVACY.md` §5 ("Encryption at rest") cuando F0.5 cierre: hoy describe estado v2.0 que aún no existe.
  - Ajustar `docs/model-interface.md` cuando F0.9 cierre: hoy asume cargador externo implementado.
  - Re-leer `SECURITY.md` tras F0.1 para que coincida con la decisión cripto elegida.
  - Validar links rotos con un linter (`markdown-link-check`) antes del envío.

### F0.3 — Cripto core: KDF + primitivas

- **Qué:** módulo `src/lib/crypto/` con: `deriveKey()` Argon2id (m=64 MiB, t=3, p=4), `encryptBlob()`/`decryptBlob()` AES-256-GCM (nonce 96-bit, tag 128-bit), `wrapKey()`/`unwrapKey()` para envolver DEK con KEK derivada. Test vectors RFC 9106.
- **Libs:** `argon2-browser` o `hash-wasm` (WASM, funciona en Tauri y web). AES-GCM nativo `crypto.subtle`.
- **Archivos:** `src/lib/crypto/{kdf.ts, aead.ts, keystore.ts, index.ts}`, tests en `src/lib/crypto/__tests__/`.
- **Esfuerzo:** 2–3 días.
- **Dependencias:** F0.1.
- **Aceptación:** suite Vitest con vectores conocidos pasa; bench Argon2id en máquina dev <1.5 s.
- **Riesgo:** Argon2 WASM lento en navegadores viejos; en Tauri considerar implementación nativa Rust (`argon2` crate) expuesta vía `invoke`.

### F0.4 — Cifrado del `.dird` (AES-256-GCM)

- **Qué:** modificar `dird-exporter.ts` e `importer.ts`: tras generar ZIP, cifrar bytes con DEK (random por export), envolver DEK con KEK derivada de contraseña de export, escribir contenedor `.dird` con header versionado (magic `DIRD`, version u16, KDF params, salt, nonce, wrapped-DEK, ciphertext, tag). Bump `export_version` a `2.0.0`. Importer detecta header v1.0.1 plano vs v2.0.0 cifrado.
- **Archivos:** `src/lib/export/dird-exporter.ts`, `src/lib/export/dird-importer.ts`, nuevo `src/lib/export/dird-container.ts`, `docs/dird-format.md`.
- **Esfuerzo:** 3 días.
- **Dependencias:** F0.3.
- **Aceptación:** round-trip de export→import con contraseña correcta restaura datos; contraseña errónea falla con error claro; import de `.dird` v1.0.1 sigue funcionando (compat).
- **Riesgo:** archivos grandes (>1 GB PDFs/blobs) → cifrado en chunks streaming si JSZip lo permite, si no documentar límite.

### F0.5 — Cifrado base local (según F0.1)

**Si opción B/C (cifrado por registro IndexedDB):**
- **Qué:** middleware Dexie que intercepta `put/get` en tablas sensibles (`patients`, `images`, `detections`, `segmentations`, `measurements`, `reports`, `imageClassifications`). Campos cifrados → `{ciphertext, nonce, aad}`. Índices sobre `id` y `eyeType` quedan en claro (necesarios para queries). DEK guardada cifrada en tabla `meta` con KEK derivada de contraseña de cifrado al desbloqueo.
- **Archivos:** `src/lib/db/schema.ts` (v17), `src/lib/db/crypto-layer.ts`, `src/lib/db/unlock-service.ts`.
- **Esfuerzo:** 5–7 días.

**Si opción A (SQLCipher via Tauri):**
- **Qué:** instalar `tauri-plugin-sql` con feature SQLCipher, definir esquema equivalente, escribir capa de DAO que reemplace Dexie, migrador one-shot Dexie→SQLite.
- **Archivos:** `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs`, todo `src/lib/db/`.
- **Esfuerzo:** 15–25 días. **No recomendado solo bajo presión de envío.**

- **Dependencias:** F0.3.
- **Aceptación:** datos nuevos cifrados; backup IndexedDB ilegible sin contraseña; bench query típica <200 ms con cifrado.
- **Riesgo:** romper queries existentes que dependan de índices sobre campos cifrados. Auditar usos antes.

### F0.6 — Doble contraseña + login local + wizard

- **Qué:**
  - Pantalla `FirstRunWizard` (3 pasos: bienvenida, contraseña de usuario, contraseña de cifrado).
  - Pantalla `LoginScreen` para arranques posteriores.
  - Settings → Seguridad: cambio de contraseña de cifrado (con re-wrap de DEK), cambio de contraseña de login.
  - Política: contraseña de cifrado sin recovery (warning explícito + checkbox "entiendo que perderla = pérdida de datos").
  - Reformular `AdminLogin.tsx` o coexistencia.
- **Archivos:** nuevos `src/components/onboarding/FirstRunWizard.tsx`, `src/components/auth/LoginScreen.tsx`, `src/components/settings/SecuritySettings.tsx`, store `src/stores/auth-store.ts`.
- **Esfuerzo:** 4–5 días.
- **Dependencias:** F0.3, F0.5, F0.1 (decisión ⚠️2 sobre coexistencia con login admin remoto).
- **Aceptación:** primer arranque dispara wizard; wizard completado nunca vuelve a aparecer; relogin tras cierre; cambio de contraseña no corrompe DB; perder contraseña → app inservible (esperado).
- **Riesgo:** UX confusa "dos contraseñas". Mitigación: copy claro, ejemplos en wizard.

### F0.7 — Indicador estado cifrado en UI

- **Qué:** badge persistente en header/sidebar: 🔒 "Cifrado activo" / ⚠️ "Sin cifrado" (modo legacy v1). Click → drawer con detalles (algoritmo, KDF params, último desbloqueo).
- **Archivos:** `src/components/layout/EncryptionBadge.tsx` + integración en layout actual.
- **Esfuerzo:** 0.5 día.
- **Dependencias:** F0.5.
- **Aceptación:** badge visible en todas las rutas principales.
- **Riesgo:** ninguno.

### F0.8 — Migración v1.0.1 → v2.0

- **Qué:** detectar instalación previa sin cifrado, ofrecer wizard de migración (configurar contraseñas, re-empaquetar IndexedDB con cifrado por registro). Generar backup `.dird` cifrado antes. Marcar `migrated_from: "1.0.1"` en `meta`.
- **Archivos:** `src/lib/db/migration-v2.ts`, integración en `App.tsx` boot flow.
- **Esfuerzo:** 2–3 días.
- **Dependencias:** F0.4, F0.5, F0.6.
- **Aceptación:** instalación con datos v1 migra sin pérdida; rollback documentado (restaurar el `.dird` previo).
- **Riesgo:** fallo a media migración deja DB inconsistente → transacción + flag `migration_in_progress`.

### F0.9 — Carga modelos ONNX externos

- **Qué:**
  - Settings → AI Models → "Add Model" abre file picker (`.onnx` + `.json` model card).
  - Validador `src/lib/ai/model-card-validator.ts` con JSON-Schema (Zod o Ajv) según spec `docs/model-interface.md`.
  - Validación de shapes input/output contra metadata (extender `onnx-manager.ts:251`).
  - Sanity-check: imagen de prueba embebida (`public/test-fundus.png`) → run inference → verificar que devuelve tensor con shape esperado y no NaN.
  - Registro persistente: Tauri command `save_model(name, onnx_bytes, card_json)` → escribe en `<app_data_dir>/models/<id>/`. Web fallback: IndexedDB blob store.
  - Lista de modelos instalados, botón "Activar".
- **Archivos:** `src/lib/ai/model-card-validator.ts`, `src/lib/ai/model-registry.ts`, `src/components/settings/ModelSettings.tsx` (extender), `src-tauri/src/commands/models.rs`, `scripts/validate_model_card.py`.
- **Esfuerzo:** 5–7 días.
- **Dependencias:** `docs/model-interface.md` final (F0.2). Independiente de F0.3–F0.8.
- **Aceptación:** instalar modelo de tercero válido → aparece en lista → activar → inferencia funciona. Modelo inválido (shape distinto, card malformada) rechazado con mensaje claro. Script `validate_model_card.py` valida desde CLI con exit codes.
- **Riesgo:** modelo malicioso (ONNX puede contener custom ops). Mitigación: lista blanca de opsets, warning explícito al instalar.

### F0.10 — GitHub Security Advisories + LICENSE en `dird_models`

- **Qué:** activar GHSA en Settings→Security del repo principal y `dird_models`. Verificar `LICENSE` AGPL-3.0 en `dird_models` (commit si falta).
- **Esfuerzo:** 0.5 día.
- **Dependencias:** ninguna. Hacer **ya**.
- **Aceptación:** advisories habilitado, `dird_models/LICENSE` accesible vía URL pública.

### F0.11 — Paridad EN en UI

- **Qué:** diff entre `src/i18n/locales/es.json` (69 KB) y `en.json` (57 KB) → completar claves faltantes. Audit visual de pantallas en `lng=en`.
- **Archivos:** `src/i18n/locales/en.json`.
- **Esfuerzo:** 1–2 días.
- **Dependencias:** ninguna.
- **Aceptación:** script de diff de claves devuelve 0; smoke-test de 5 pantallas clave en inglés.
- **Riesgo:** drift continuo al desarrollar otras features en paralelo.

### F0.12 — QA, freeze y release v2.0

- **Qué:** suite de tests E2E (Playwright o WebDriver) cubriendo: wizard, login, export/import cifrado, instalación modelo externo, migración v1→v2. Tag `v2.0.0`, build Tauri release.
- **Archivos:** `tests/e2e/`, `.github/workflows/release.yml` (ya existe según memoria — verificar).
- **Esfuerzo:** 3–4 días.
- **Dependencias:** todo F0.
- **Aceptación:** tag publicado, binario descargable, checklist DPG firmado.

---

## FASE 1 — Post-postulación inmediata (v2.0.x, 1–2 meses)

- **F1.1** Reportes de bugs del shake-out post-release (estimar 5 días buffer).
- **F1.2** Hardening cripto: integrar `argon2` crate Rust si Argon2-WASM resultó lento (2 días).
- **F1.3** Documentar formato `.dird` v2.0 con ejemplos hexdump (1 día).
- **F1.4** CI de smoke-test del importer contra `.dird` de referencia firmados (2 días).
- **F1.5** Limpiar roadmaps duplicados (`Roadmap_dird.md`, `_metricas.md`, `_sqlite.md`) o convertir a histórico bajo `docs/archive/` (0.5 día).

---

## FASE 2 — v2.1 (Q3 2026)

| Item | Notas | Esfuerzo |
|---|---|---|
| Bulk import de imágenes | Drag-drop multi-archivo + cola con progress; sesión auto-asignada | 4–5 d |
| Multi-idioma UI ampliado | Sumar PT, FR mínimo. Workflow Crowdin opcional | 3–4 d |
| Audit log cifrado | Tabla `audit_log` cifrada, append-only, hash chain. Acciones: login, export, modelo activado, edición clínica | 4 d |
| Session timeout | Auto-lock tras N min inactividad → re-pide contraseña de usuario | 1 d |
| Plantillas de reporte configurables | Editor de plantilla con variables, persistido en `reportTemplates` | 5–6 d |

Total v2.1: **17–20 días**.

---

## FASE 3 — v2.2 (Q4 2026)

| Item | Esfuerzo |
|---|---|
| Validación externa Messidor-2 + EyePACS (script + paper técnico) | 8–10 d |
| Reentrenamiento hemorragia / exudado duro | Fuera del repo app (en `dird_models`); 15–20 d ML |
| Separación microaneurisma / microhemorragia | Etiquetado + retrain; 10 d |
| Release DIRDv3 (modelo, no app) | Empaquetar + actualizar `model-downloader.ts` registry | 2 d app-side |

---

## FASE 4 — v3.0 y posteriores (2027)

| Item | Notas | Esfuerzo grueso |
|---|---|---|
| Soporte DICOM | Lectura con `dcmjs`, parser de tags relevantes, anonimización | 10–15 d |
| FHIR export | Recursos: Patient, Observation, ImagingStudy, DiagnosticReport | 8–10 d |
| SNOMED CT mapping | Tabla de mapeo clases → SCT codes, UI de revisión | 5 d |
| ICD-11 | Mapeo equivalente | 3 d |
| Multi-user local + RBAC | Roles (admin, clínico, lectura), permisos por sesión, separación DEK por usuario | 12–15 d |
| **v3.1** — Segmentación vasos / microaneurismas / hemorragias / neovasc / exudados | Modelos nuevos + UI de overlay multi-canal | 20+ d app-side |

---

## Camino crítico

```
F0.10 (GHSA + LICENSE)  ──► independiente, hacer ya
F0.1 (decisión cripto)  ──► F0.3 ──► F0.4 ──► F0.8 ──► F0.12
                              │       │
                              │       └─► F0.5 ──► F0.6 ──► F0.7
                              │                     │
                              │                     └─► F0.8
F0.2 (docs)             ──► requiere F0.1 cerrada antes de SECURITY.md
F0.9 (modelos ONNX)     ──► paralelo, solo depende de F0.2 (model-interface.md)
F0.11 (i18n parity)     ──► paralelo total
```

**Cuello de botella:** F0.1 bloquea cripto entero. Resolver día 1.

## Estimación total FASE 0

| Escenario | Días-persona |
|---|---|
| **Opción C/B (cifrado por registro IndexedDB)** | **23–32 días** |
| Opción A (migrar a SQLCipher) | 45–60 días |

Solo: agregar 30% buffer → **30–42 días reales** para opción B/C.

## Orden de ataque recomendado (solo, opción C)

1. ~~**Día 1–2:** F0.2 (publicar los 5 docs y sección DPG en README).~~ ✅ **HECHO 2026-05-20**
2. **Día 1:** F0.1 (ADR) + F0.10 (GHSA + LICENSE remoto). Cierra decisiones externas.
3. **Día 3–5:** F0.3 (cripto core con tests). Fundación.
4. **Día 6–8:** F0.4 (cifrar `.dird`). Demo visible más rápido.
5. **Día 9–15:** F0.5 (cifrado IndexedDB por registro) + F0.6 (wizard/login).
6. **Día 16:** F0.7 (badge UI).
7. **Día 17–19:** F0.8 (migración v1→v2).
8. **Día 20–26:** F0.9 (modelos ONNX externos). Paralelizable con F0.11.
9. **Día 27–28:** F0.11 (paridad EN).
10. **Día 29–32:** F0.12 (QA + release v2.0).
11. **Enviar postulación DPG.**

## Decisiones técnicas pendientes

1. **⚠️1** SQLCipher real (opción A) vs cifrado por registro IndexedDB (B) vs reformular el compromiso (C). **Recomendado C+B.**
2. **⚠️2** ¿`AdminLogin.tsx` remoto convive con login local nuevo, o se elimina? Si convive, ¿qué datos remotos justifica?
3. **Argon2 backend:** WASM (`hash-wasm`) único, o WASM en web + Rust nativo en Tauri (vía `invoke`). Recomendado dual desde el inicio para no migrar después.
4. **Argon2 params en hardware débil:** ¿degradar a m=32 MiB si dispositivo no aguanta 64 MiB, o exigir mínimo? Postura DPG = exigir 64 MiB (memoria-hard real).
5. **Streaming AES-GCM en exports grandes:** GCM tiene límite 2³⁹-256 bytes por nonce. Para `.dird` >64 GB hay que segmentar. ¿Documentar límite máximo o implementar AES-GCM-SIV / chunked AEAD?
6. **Sanity-check de modelos:** imagen de fundus de prueba bajo qué licencia (debe ir en repo). ¿Usar una sintética generada, o una real CC0?
7. **Política wipe:** N intentos fallidos de contraseña de cifrado → ¿wipe automático, lock indefinido, o solo retraso exponencial? Postura DPG sugiere lock + warning, no wipe.
8. **Formato del header `.dird` v2:** ¿propio (recomendado) o age-encryption (`age`) reutilizado? `age` es estándar pero añade dep.
9. **Consolidación de los Roadmap_*.md** existentes: ¿mover a `docs/archive/` o reescribir como `ROADMAP.md` único? Afecta F0.2.
