# Roadmap: Eliminar Dexie → SQLite unificado (web + desktop)

Branch: `w/tauri`
Objetivo: **un solo motor SQLite en ambos builds**. Archivo `.sqlite` binario intercambiable entre web (sqlite-wasm + OPFS) y desktop (tauri-plugin-sql). Sin conversión, sin ZIP intermedio.

---

## Stack elegido

| Entorno | Motor | Persistencia |
|---------|-------|--------------|
| Browser (dev/web) | `@sqlite.org/sqlite-wasm` (oficial) | OPFS (archivo `.sqlite` real) |
| Desktop (Tauri) | `tauri-plugin-sql` (SQLite) | Filesystem nativo |

Mismo binario SQLite, mismo schema, mismo archivo → **intercambio = copy-paste**.

Caveats:
- OPFS requiere COOP/COEP (ya configurado en `vite.config.ts` para ONNX) ✓
- Safari <17 sin OPFS → fallback a VFS-IndexedDB de sqlite-wasm
- Migración desde Dexie: script one-shot al primer arranque

---

## Superficie actual a migrar

- **9 tablas Dexie**: patients, sessions, images, detections, segmentations, reports, measurements, imageClassifications, pendingContributions
- **16 versiones de migración** Dexie (consolidar a DDL único)
- **38 archivos** importan `@/lib/db`
- **10 componentes** usan `useLiveQuery` (37 ocurrencias) — requiere hook reactivo propio
- **Blobs**: imágenes (originalBlob, processedBlob) + PDFs de reports → columnas `BLOB`
- **JSON anidado**: bbox, lesions, quadrantAnalysisData, metadata → columnas `TEXT` (JSON.stringify)
- **Dates** → `TEXT` ISO8601 (SQLite no tiene tipo date nativo)

---

## Fase 1 — Deps + schema SQL

- [x] `npm install @sqlite.org/sqlite-wasm @tauri-apps/plugin-sql`
- [ ] Agregar `tauri-plugin-sql` a `src-tauri/Cargo.toml` + `src-tauri/src/lib.rs`
- [ ] Crear `src/lib/db/sql-schema.ts`:
  - DDL único con `CREATE TABLE IF NOT EXISTS`
  - Tipos: INTEGER PK autoincrement, TEXT (strings + dates + JSON), BLOB (imágenes/PDFs), INTEGER (booleans 0/1)
  - Índices equivalentes a los de Dexie (imageId, sessionId, patientId, compound sessionId+type, etc)
  - Versión schema en tabla `_meta`

## Fase 2 — Adapter cross-platform

- [ ] `src/lib/db/sqlite-driver.ts`: detecta runtime
  - Tauri: `import Database from '@tauri-apps/plugin-sql'`
  - Browser: `sqlite3InitModule({ locateFile })`, abrir con `new OpfsDb('dird.sqlite')` o `new IdbDb('dird.sqlite')` si no hay OPFS
- [ ] API unificada: `execute(sql, params)`, `query<T>(sql, params)`, `transaction(fn)`
- [ ] Bootstrap: crear tablas desde `sql-schema.ts` si DB vacía

## Fase 3 — Repositorio Dexie-compat

Objetivo: **no tocar los 38 callers**. Recrear la shape de Dexie sobre SQLite.

- [ ] `src/lib/db/sqlite-repo.ts` exporta `db` con `.patients`, `.sessions`, `.images`, etc
- [ ] Cada tabla implementa subset usado:
  - `.add(obj)` → INSERT returning id
  - `.put(obj)` → INSERT OR REPLACE
  - `.update(id, changes)` → UPDATE
  - `.delete(id)` → DELETE
  - `.get(id)` → SELECT … WHERE id=?
  - `.where(col).equals(v)` / `.anyOf([v])` → builder fluent con `.toArray()`, `.first()`, `.count()`, `.delete()`, `.modify(fn)`
  - `.toCollection().modify(fn)`
  - `.bulkAdd(arr)`
- [ ] Serialización automática: Date ↔ ISO8601, objetos/arrays ↔ JSON, Blob ↔ Uint8Array
- [ ] Emitter `onChange(table)` para reactividad

## Fase 4 — useLiveQuery propio

- [ ] `src/lib/db/useLiveQuery.ts`: hook con misma firma que `dexie-react-hooks`
- [ ] Se suscribe al emitter del adapter; re-ejecuta query cuando cambia tabla relevante
- [ ] Reemplazar imports `from 'dexie-react-hooks'` → `from '@/lib/db/useLiveQuery'` en los 10 componentes
- [ ] Granularidad: por tabla al inicio; afinar después si performance lo requiere

## Fase 5 — Migración one-shot

- [ ] `src/lib/db/migrate-from-dexie.ts`:
  - Al arranque, si existe `DirdDatabase` (Dexie) y flag `dird_migrated_to_sqlite` ausente
  - Abre Dexie en modo readonly, lee todas las tablas
  - Inserta en SQLite en transacción única
  - Verifica conteos por tabla
  - Set `localStorage.dird_migrated_to_sqlite = version+timestamp`
  - NO borra Dexie (rollback manual posible durante transición)
- [ ] Mostrar toast de progreso / éxito

## Fase 6 — Intercambio web ↔ desktop

- [ ] Export `.sqlite`:
  - Browser: `SQLite3.exportDb()` → Blob → download via `<a download>`
  - Desktop: copiar archivo directo con tauri fs
- [ ] Import `.sqlite`:
  - Browser: `<input type="file">` → `SQLite3.importDb(bytes)`
  - Desktop: tauri dialog → abrir path
- [ ] UI en Settings → sección "Base de datos": botones Exportar / Importar
- [ ] Validación: verificar schema version del archivo importado antes de pisar
- [ ] Mantener `.dird` ZIP legacy para reports + imágenes sueltas (formato diferente, export selectivo)

## Fase 7 — Limpieza Dexie

Solo tras verificar 5-6 en uso real.

- [ ] `npm uninstall dexie dexie-react-hooks`
- [ ] Borrar `src/lib/db/schema.ts` (la clase Dexie); mover interfaces a `src/lib/db/types.ts`
- [ ] Borrar `migrate-from-dexie.ts` tras N meses
- [ ] Actualizar README y Roadmap_dird.md

---

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| OPFS no disponible (Safari viejo, contextos no seguros) | Fallback VFS-IndexedDB de sqlite-wasm |
| Performance `useLiveQuery` casero peor que Dexie | Invalidar solo tablas afectadas, no toda la DB |
| Blobs grandes (PDFs, imágenes) en SQLite degradan | Medir; si es problema mover a OPFS/filesystem y guardar solo path |
| Migración Dexie→SQLite corrompe datos | NO borrar Dexie, verificar conteos, permitir rollback |
| Schema drift web vs desktop | DDL único en `sql-schema.ts`, versión en `_meta` |
| tauri-plugin-sql version skew con sqlite-wasm | Pinear ambos a SQLite 3.45+ |
| COOP/COEP rompen CDN externos (opencv-js via jsdelivr) | Ya funciona con headers actuales; revalidar |

---

## Orden de ejecución

1. Fase 1 (schema DDL)
2. Fase 2 (driver)
3. Fase 3 (repo Dexie-compat) — momento de mayor riesgo, no tocar callers
4. Fase 4 (useLiveQuery) — swap imports
5. **Smoke test completo**: crear paciente, sesión, subir imagen, inferir, reporte
6. Fase 5 (migración) — solo cuando 1-4 verificados
7. Fase 6 (intercambio) — prioridad baja, independiente
8. Fase 7 (limpieza) — tras semanas de uso estable

## Criterio de éxito

- [ ] App abre y funciona idéntico con SQLite, sin regresiones
- [ ] Archivo `.sqlite` exportado en browser abre en desktop y viceversa
- [ ] Migración Dexie→SQLite preserva 100% de los datos existentes
- [ ] Bundle size no crece más de 2MB (sqlite-wasm ~1MB comprimido)
