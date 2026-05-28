// Migrador IndexedDB (Dexie v16) → SQLite (SQLCipher).
//
// Lee todos los registros de la base Dexie legacy y los inserta en la base
// SQLite cifrada usando los repositorios del shim. La operación es idempotente:
// si la tabla SQLite ya contiene los datos (chequea `meta.migrated_from`) no
// re-ejecuta. Marca `meta.migrated_from = "1.0.1"` y `meta.migrated_at` al final.

import { db as dexieDb } from '@/lib/db/schema';
import { sqlDb } from './db';
import { dbExecute, dbQueryOne, P } from './client';

export type MigrationStep =
  | 'patients' | 'sessions' | 'images' | 'detections' | 'segmentations'
  | 'reports' | 'measurements' | 'imageClassifications' | 'pendingContributions';

export interface MigrationProgress {
  step: MigrationStep | 'done' | 'init';
  current: number;
  total: number;
  message: string;
}

export type ProgressCallback = (p: MigrationProgress) => void;

async function getMeta(key: string): Promise<string | null> {
  const r = await dbQueryOne<{ value: string }>(
    'SELECT value FROM meta WHERE key = ?',
    [P.text(key)],
  );
  return r ? (r.value as string) : null;
}

async function setMeta(key: string, value: string): Promise<void> {
  await dbExecute(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [P.text(key), P.text(value)],
  );
}

export async function isAlreadyMigrated(): Promise<boolean> {
  const v = await getMeta('migrated_from');
  return v === '1.0.1';
}

export async function isInProgress(): Promise<boolean> {
  return (await getMeta('migration_in_progress')) === '1';
}

/**
 * Cuenta los registros que se migrarán para mostrar progreso.
 */
export async function countDexieRecords(): Promise<Record<MigrationStep, number>> {
  return {
    patients: await dexieDb.patients.count(),
    sessions: await dexieDb.sessions.count(),
    images: await dexieDb.images.count(),
    detections: await dexieDb.detections.count(),
    segmentations: await dexieDb.segmentations.count(),
    reports: await dexieDb.reports.count(),
    measurements: await dexieDb.measurements.count(),
    imageClassifications: await dexieDb.imageClassifications.count(),
    pendingContributions: await dexieDb.pendingContributions.count(),
  };
}

/**
 * Migra todos los datos de Dexie → SQLite. Mantiene los IDs originales
 * insertándolos explícitamente para que las foreign keys sigan apuntando.
 */
export async function migrateAll(progress?: ProgressCallback): Promise<void> {
  if (await isAlreadyMigrated()) {
    progress?.({ step: 'done', current: 1, total: 1, message: 'Ya migrado.' });
    return;
  }

  await setMeta('migration_in_progress', '1');

  const counts = await countDexieRecords();
  const grandTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  let done = 0;
  const tick = (step: MigrationStep, n: number) => {
    done += n;
    progress?.({
      step,
      current: done,
      total: grandTotal,
      message: `Migrando ${step}…`,
    });
  };

  // patients
  for (const p of await dexieDb.patients.toArray()) {
    await sqlDb.patients.put(p);
    tick('patients', 1);
  }

  // sessions
  for (const s of await dexieDb.sessions.toArray()) {
    await sqlDb.sessions.put(s);
    tick('sessions', 1);
  }

  // images (con BLOBs)
  for (const img of await dexieDb.images.toArray()) {
    await sqlDb.images.put(img);
    tick('images', 1);
  }

  // detections
  for (const d of await dexieDb.detections.toArray()) {
    await sqlDb.detections.put(d);
    tick('detections', 1);
  }

  // segmentations
  for (const seg of await dexieDb.segmentations.toArray()) {
    await sqlDb.segmentations.put(seg);
    tick('segmentations', 1);
  }

  // reports (con PDFs)
  for (const r of await dexieDb.reports.toArray()) {
    await sqlDb.reports.put(r);
    tick('reports', 1);
  }

  // measurements
  for (const m of await dexieDb.measurements.toArray()) {
    await sqlDb.measurements.put(m);
    tick('measurements', 1);
  }

  // imageClassifications
  for (const c of await dexieDb.imageClassifications.toArray()) {
    await sqlDb.imageClassifications.put(c);
    tick('imageClassifications', 1);
  }

  // pendingContributions
  for (const pc of await dexieDb.pendingContributions.toArray()) {
    await sqlDb.pendingContributions.put(pc);
    tick('pendingContributions', 1);
  }

  await setMeta('migrated_from', '1.0.1');
  await setMeta('migrated_at', new Date().toISOString());
  await setMeta('migration_in_progress', '0');

  progress?.({ step: 'done', current: grandTotal, total: grandTotal, message: 'Migración completa.' });
}

/**
 * Detecta si la base Dexie legacy contiene datos que aún no se hayan migrado.
 */
export async function needsMigration(): Promise<boolean> {
  if (await isAlreadyMigrated()) return false;
  const counts = await countDexieRecords();
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  return total > 0;
}
