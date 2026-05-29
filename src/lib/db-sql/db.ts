// Facade `db` Dexie-compatible, respaldado por SQLCipher.
//
// Drop-in para `import { db } from '@/lib/db/schema'`. Las tablas con BLOBs
// (`images`, `reports`) tienen subclases que serializan el Blob de forma asíncrona.

import type {
  Patient,
  Session,
  Image,
  Detection,
  Segmentation,
  Report,
  Measurement,
  ImageClassification,
  PendingContribution,
} from '@/lib/db/schema';
import { TableShim } from './shim';
import {
  patientsMapper, sessionsMapper, imagesMapper, detectionsMapper, segmentationsMapper,
  reportsMapper, measurementsMapper, imageClassificationsMapper, pendingContributionsMapper,
  imageToRowWithBlobs, reportToRowWithBlob,
} from './mappers';
import { dbExecute, P, type SqlParam } from './client';
import { bumpDbVersion } from './version-store';

class ImagesShim extends TableShim<Image> {
  constructor() {
    super('images', imagesMapper);
  }

  async add(obj: Image): Promise<number> {
    const row = await imageToRowWithBlobs(obj);
    return this._insertWithRow(row);
  }

  async put(obj: Image): Promise<number> {
    if (obj.id !== undefined && obj.id !== null) {
      const existing = await this.get(obj.id);
      if (existing) {
        await this._updateWithRow(obj.id, await imageToRowWithBlobs(obj));
        return obj.id;
      }
    }
    return this.add(obj);
  }

  async update(id: number, partial: Partial<Image>): Promise<void> {
    const row = await imageToRowWithBlobs(partial);
    if (Object.keys(row).length === 0) return;
    await this._updateWithRow(id, row);
  }

  private async _insertWithRow(row: Record<string, SqlParam>): Promise<number> {
    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(',');
    const params = cols.map((c) => row[c]);
    const r = await dbExecute(
      `INSERT INTO images (${cols.join(',')}) VALUES (${placeholders})`,
      params,
    );
    bumpDbVersion();
    return r.last_insert_id;
  }

  private async _updateWithRow(id: number, row: Record<string, SqlParam>): Promise<void> {
    const cols = Object.keys(row).filter((c) => c !== 'id');
    if (cols.length === 0) return;
    const sets = cols.map((c) => `${c} = ?`).join(', ');
    const params: SqlParam[] = cols.map((c) => row[c]);
    params.push(P.int(id));
    await dbExecute(`UPDATE images SET ${sets} WHERE id = ?`, params);
    bumpDbVersion();
  }
}

class ReportsShim extends TableShim<Report> {
  constructor() {
    super('reports', reportsMapper);
  }

  async add(obj: Report): Promise<number> {
    const row = await reportToRowWithBlob(obj);
    const cols = Object.keys(row);
    const placeholders = cols.map(() => '?').join(',');
    const params = cols.map((c) => row[c]);
    const r = await dbExecute(
      `INSERT INTO reports (${cols.join(',')}) VALUES (${placeholders})`,
      params,
    );
    bumpDbVersion();
    return r.last_insert_id;
  }

  async put(obj: Report): Promise<number> {
    if (obj.id !== undefined && obj.id !== null) {
      const existing = await this.get(obj.id);
      if (existing) {
        await this._updateInternal(obj.id, obj);
        return obj.id;
      }
    }
    return this.add(obj);
  }

  async update(id: number, partial: Partial<Report>): Promise<void> {
    await this._updateInternal(id, partial);
  }

  private async _updateInternal(id: number, partial: Partial<Report>): Promise<void> {
    const row = await reportToRowWithBlob(partial);
    const cols = Object.keys(row).filter((c) => c !== 'id');
    if (cols.length === 0) return;
    const sets = cols.map((c) => `${c} = ?`).join(', ');
    const params: SqlParam[] = cols.map((c) => row[c]);
    params.push(P.int(id));
    await dbExecute(`UPDATE reports SET ${sets} WHERE id = ?`, params);
    bumpDbVersion();
  }
}

/**
 * Wrapper Dexie-compatible para transacciones. SQLite ya es secuencial dentro
 * de la única conexión global, así que envolvemos en BEGIN/COMMIT con rollback
 * automático ante error. Firma flexible (Dexie acepta varios shapes):
 *
 *   db.transaction('rw', table, fn)
 *   db.transaction('rw', [t1, t2, …], fn)
 *   db.transaction('rw', t1, t2, fn)   (variádica)
 */
async function transaction(mode: 'r' | 'rw', ...rest: unknown[]): Promise<void> {
  const fn = rest[rest.length - 1] as () => Promise<unknown>;
  if (typeof fn !== 'function') {
    throw new Error('transaction: el último argumento debe ser la función');
  }
  void mode; // SQLite no distingue rw/r para una sola conexión
  await dbExecute('BEGIN', []);
  try {
    await fn();
    await dbExecute('COMMIT', []);
    bumpDbVersion();
  } catch (e) {
    try { await dbExecute('ROLLBACK', []); } catch { /* noop */ }
    throw e;
  }
}

/**
 * Stub para `db.on('event', cb)` estilo Dexie. SQLCipher no emite eventos
 * en runtime; los componentes que usaban `db.on('blocked', …)` quedan inertes
 * (sin efecto) bajo SQLite — no es necesario porque no hay bloqueos de upgrade.
 */
function on(_event: string, _cb: (...args: unknown[]) => void): void {
  /* noop — SQLite no usa los eventos de Dexie. */
}

export const sqlDb = {
  patients: new TableShim<Patient>('patients', patientsMapper),
  sessions: new TableShim<Session>('sessions', sessionsMapper),
  images: new ImagesShim(),
  detections: new TableShim<Detection>('detections', detectionsMapper),
  segmentations: new TableShim<Segmentation>('segmentations', segmentationsMapper),
  reports: new ReportsShim(),
  measurements: new TableShim<Measurement>('measurements', measurementsMapper),
  imageClassifications: new TableShim<ImageClassification>('image_classifications', imageClassificationsMapper),
  pendingContributions: new TableShim<PendingContribution>('pending_contributions', pendingContributionsMapper),
  transaction,
  on,
};

export type SqlDb = typeof sqlDb;
