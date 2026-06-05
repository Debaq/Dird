# Roadmap DIRD+ — Migración a Tauri

Branch de trabajo: `w/tauri`
Stack actual: Vite 6 + React 18 + TypeScript + ONNX Runtime Web + Dexie (IndexedDB) + Konva + i18next.

---

## Objetivo

Empaquetar DIRD+ como aplicación de escritorio multiplataforma (Linux, Windows, macOS) usando Tauri v2, manteniendo el mismo código web sin fork.

---

## Estado de branches (2026-04-20)

| Branch | Último commit | Notas |
|--------|---------------|-------|
| `w/tauri` | 2026-04-15 | **Branch activa**. Adelantada sobre todas. Aún no integra Tauri. |
| `v2.2025` | 2026-03-06 | Base de producción. 5 commits por detrás. |
| `fix-aaron` | 2026-02-22 | Ya mergeada en `w/tauri`. Sirve como backup. |
| `main` | 2025-12-10 | Histórica. 20 commits por detrás. |
| `old` | 2025-12-10 | Respaldo antiguo. |

---

## Fase 0 — Prerequisitos

- [ ] Instalar Rust toolchain (`rustup`)
- [ ] Dependencias WebKitGTK en Arch:
  - `webkit2gtk-4.1`
  - `libayatana-appindicator`
  - `librsvg`
  - `patchelf`
- [ ] Verificar que `pnpm build` genera `dist/` limpio en `w/tauri`

---

## Fase 1 — Scaffold Tauri

- [ ] Agregar deps:
  ```
  pnpm add -D @tauri-apps/cli@^2
  pnpm add @tauri-apps/api@^2
  ```
- [ ] Ejecutar `pnpm tauri init` → genera `src-tauri/`
- [ ] Configurar `src-tauri/tauri.conf.json`:
  - `identifier`: `org.tmeduca.dird`
  - `build.devUrl`: `http://localhost:5173`
  - `build.frontendDist`: `../dist`
  - `build.beforeDevCommand`: `pnpm dev:tauri`
  - `build.beforeBuildCommand`: `pnpm build:tauri`
  - Ventana: 1280×800, título "DIRD+"
  - Targets bundle: `appimage`, `deb`, `msi`, `dmg`

---

## Fase 2 — Vite dual mode (web + tauri)

Problema: `base: '/dird/'` rompe en Tauri (protocolo `tauri://localhost`).

- [ ] Crear mode `tauri` en `vite.config.ts`:
  - `base: '/'` cuando `process.env.TAURI_ENV_PLATFORM`
  - `server.strictPort: true`
  - `server.hmr.protocol: 'ws'`
- [ ] Nuevos scripts en `package.json`:
  ```
  "dev:tauri": "vite --mode tauri",
  "build:tauri": "tsc && vite build --mode tauri",
  "tauri": "tauri",
  "tauri:dev": "tauri dev",
  "tauri:build": "tauri build"
  ```

---

## Fase 3 — Compatibilidad runtime

### 3.1 Router
- [ ] Validar `BrowserRouter` en Tauri v2. Si falla en rutas profundas → usar `HashRouter` solo en build Tauri (detectar vía `import.meta.env.TAURI_ENV_PLATFORM`).

### 3.2 ONNX Runtime (crítico)
- [ ] Verificar carga de `.onnx` y `.wasm` desde protocolo `tauri://`
- [ ] Ajustar `app.security.headers` en `tauri.conf.json` para COOP/COEP
- [ ] Ajustar CSP para permitir `wasm-unsafe-eval`, `blob:` (workers)
- [ ] Si SharedArrayBuffer no disponible → forzar `ort.env.wasm.numThreads = 1`

### 3.3 Storage
- [ ] Dexie/IndexedDB: validar persistencia entre arranques de la app

### 3.4 Backend remoto (API PHP)
- [ ] Permitir dominios prod/dev en CSP de `tauri.conf.json`
- [ ] Mantener `.env` con `VITE_API_URL`

---

## Fase 4 — Bundle y assets

- [ ] Generar íconos: `pnpm tauri icon public/logo.svg`
- [ ] Verificar que `clinical-guidelines/` y modelos ONNX entren en bundle (vía `dist/`)
- [ ] Metadatos de bundle: versión, autor, licencia

---

## Fase 5 — Pruebas end-to-end

- [ ] `pnpm tauri:dev` carga home
- [ ] Subida de imagen → inferencia ONNX → guardado en Dexie
- [ ] Edición con Konva
- [ ] Exportación PDF (jsPDF)
- [ ] i18n (cambio de idioma)
- [ ] Guías clínicas renderizan
- [ ] Contribución a backend (upload)
- [ ] `pnpm tauri:build` genera AppImage funcional

---

## Fase 6 — Validación científica (en paralelo)

Ya iniciada en `w/tauri`:
- [x] Script APTOS 2019 (`validation/validate_dird.py`)
- [x] Script IDRiD (`validation/validate_idrid.py`)
- [ ] Documentar resultados en `REFERENCES.md`
- [ ] Integrar métricas en README

---

## Fase 7 — Cleanup

- [x] Desktop-only: PWA descartada, removidos `vite-plugin-pwa`, hooks y componentes asociados
- [ ] Actualizar README con instrucciones de build Tauri
- [ ] Crear CI para generar binarios multiplataforma (GitHub Actions)

---

## Riesgos conocidos

| Riesgo | Mitigación |
|--------|------------|
| SharedArrayBuffer no disponible en WebKitGTK | Forzar single-thread en ONNX |
| CSP estricta rompe ONNX WASM | Relajar con `wasm-unsafe-eval` y `blob:` |
| Rutas base (`/dird/`) rompen en Tauri | Modo `tauri` con `base: '/'` |
| Tamaño bundle (modelos ONNX ~20MB) | Aceptable para desktop, lazy load ya implementado |

---

## Orden de ejecución

1. Fase 0 (deps sistema)
2. Fase 1 (scaffold)
3. Fase 2 (vite dual)
4. Primer `tauri:dev` — validar home
5. Fase 3.2 (ONNX) — bloqueante
6. Resto de Fase 3
7. Fase 5 (pruebas)
8. Fase 4 (bundle final)
9. Fase 7 (cleanup)
