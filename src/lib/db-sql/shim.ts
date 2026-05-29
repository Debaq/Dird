// Shim mínimo compatible con la API de Dexie usada por DIRD+.
//
// Soporta el subset detectado en el inventario de la app:
//   .get(id) / .add(obj) / .put(obj) / .delete(id) / .update(id, partial)
//   .toArray() / .count() / .orderBy(field)
//   .where(field).equals(v) → .toArray() / .delete() / .first() / .count()
//   .where(field).anyOf(values) → .toArray() / .delete() / .first() / .count()
//
// NO es un reemplazo de Dexie: no incluye live queries, transactions, schema
// versioning ni queries encadenadas avanzadas. Para todo eso usar la nueva API
// directa en `@/lib/db-sql/client`.

import {
  dbExecute,
  dbQuery,
  dbQueryAll,
  P,
  type SqlParam,
} from './client';
import { camelToSnake } from './mapper';
import { bumpDbVersion } from './version-store';

interface WhereBuilder<T> {
  equals: (value: unknown) => WhereExecutor<T>;
  anyOf: (values: unknown[]) => WhereExecutor<T>;
}

export interface TableMapper<T> {
  /** snake_case → camelCase + parseo de Date/JSON/blob. */
  rowToObject(row: Record<string, unknown>): T;
  /** camelCase → snake_case + serialización inversa. */
  objectToRow(obj: Partial<T>): Record<string, SqlParam>;
  /** Columnas que entran en INSERT (orden estable). */
  insertColumns(): string[];
}

function buildWhere(field: string, op: 'equals' | 'anyOf', values: unknown[]) {
  const col = camelToSnake(field);
  if (op === 'equals') {
    return { sql: `${col} = ?`, params: [toParam(values[0])] };
  }
  const placeholders = values.map(() => '?').join(',');
  return { sql: `${col} IN (${placeholders})`, params: values.map(toParam) };
}

function toParam(v: unknown): SqlParam {
  if (v === null || v === undefined) return P.null();
  if (v instanceof Date) return P.date(v);
  if (v instanceof Uint8Array) return P.blob(v);
  if (typeof v === 'boolean') return P.bool(v);
  if (typeof v === 'string') return P.text(v);
  if (typeof v === 'number') return Number.isInteger(v) ? P.int(v) : P.real(v);
  return P.json(v);
}

interface WhereExecutor<T> {
  toArray(): Promise<T[]>;
  delete(): Promise<number>;
  first(): Promise<T | undefined>;
  count(): Promise<number>;
  /** Filtro adicional en memoria estilo Dexie `.and(predicate)`. */
  and(predicate: (row: T) => boolean): WhereExecutor<T>;
  /** Orden descendente al traer resultados. */
  reverse(): WhereExecutor<T>;
  /** Ordena en memoria por nombre de campo (camelCase). */
  sortBy(field: keyof T & string): Promise<T[]>;
}

export class TableShim<T extends { id?: number }> {
  constructor(public readonly table: string, private mapper: TableMapper<T>) {}

  async get(id: number): Promise<T | undefined> {
    const rows = await dbQueryAll<Record<string, unknown>>(
      `SELECT * FROM ${this.table} WHERE id = ?`,
      [P.int(id)],
    );
    return rows.length ? this.mapper.rowToObject(rows[0]) : undefined;
  }

  async toArray(): Promise<T[]> {
    const rows = await dbQueryAll<Record<string, unknown>>(`SELECT * FROM ${this.table}`);
    return rows.map((r) => this.mapper.rowToObject(r));
  }

  async count(): Promise<number> {
    const r = await dbQuery(`SELECT count(*) AS c FROM ${this.table}`);
    const cell = r.rows[0]?.[0];
    return cell && cell.t === 'int' ? cell.v : 0;
  }

  async add(obj: T): Promise<number> {
    const row = this.mapper.objectToRow(obj);
    const cols = this.mapper.insertColumns();
    const params: SqlParam[] = [];
    const colNames: string[] = [];
    for (const c of cols) {
      if (c === 'id') continue;
      colNames.push(c);
      params.push(row[c] ?? P.null());
    }
    const placeholders = colNames.map(() => '?').join(',');
    const r = await dbExecute(
      `INSERT INTO ${this.table} (${colNames.join(',')}) VALUES (${placeholders})`,
      params,
    );
    bumpDbVersion();
    return r.last_insert_id;
  }

  async put(obj: T): Promise<number> {
    if (obj.id !== undefined && obj.id !== null) {
      const exists = await this.get(obj.id);
      if (exists) {
        await this.update(obj.id, obj);
        return obj.id;
      }
    }
    return this.add(obj);
  }

  async delete(id: number): Promise<void> {
    await dbExecute(`DELETE FROM ${this.table} WHERE id = ?`, [P.int(id)]);
    bumpDbVersion();
  }

  async update(id: number, partial: Partial<T>): Promise<void> {
    const row = this.mapper.objectToRow(partial);
    const cols = Object.keys(row).filter((c) => c !== 'id');
    if (cols.length === 0) return;
    const sets = cols.map((c) => `${c} = ?`).join(', ');
    const params = cols.map((c) => row[c]);
    params.push(P.int(id));
    await dbExecute(`UPDATE ${this.table} SET ${sets} WHERE id = ?`, params);
    bumpDbVersion();
  }

  async bulkAdd(objs: T[]): Promise<number[]> {
    const ids: number[] = [];
    for (const o of objs) ids.push(await this.add(o));
    return ids;
  }

  async bulkPut(objs: T[]): Promise<number[]> {
    const ids: number[] = [];
    for (const o of objs) ids.push(await this.put(o));
    return ids;
  }

  /**
   * `where(field)` clásico Dexie devuelve un builder con `.equals()` y `.anyOf()`.
   * `where({a: v1, b: v2})` (object form) devuelve un executor con `a = v1 AND b = v2`.
   */
  where(field: string): WhereBuilder<T>;
  where(filter: Record<string, unknown>): WhereExecutor<T>;
  where(field: string | Record<string, unknown>): WhereBuilder<T> | WhereExecutor<T> {
    if (typeof field === 'object' && field !== null) {
      const parts: string[] = [];
      const params: SqlParam[] = [];
      for (const [k, v] of Object.entries(field)) {
        parts.push(`${camelToSnake(k)} = ?`);
        params.push(toParam(v));
      }
      return this._executor({ sql: parts.join(' AND '), params });
    }
    return {
      equals: (v: unknown) => this._executor(buildWhere(field, 'equals', [v])),
      anyOf: (vs: unknown[]) => this._executor(buildWhere(field, 'anyOf', vs)),
    };
  }

  private _executor(
    w: { sql: string; params: SqlParam[] },
    andPreds: Array<(row: T) => boolean> = [],
    descending = false,
  ): WhereExecutor<T> {
    const self = this;
    const applyFilter = (rows: T[]): T[] => {
      if (andPreds.length === 0) return rows;
      return rows.filter((r) => andPreds.every((p) => p(r)));
    };
    const orderClause = descending ? ' ORDER BY id DESC' : '';
    return {
      async toArray() {
        const rows = await dbQueryAll<Record<string, unknown>>(
          `SELECT * FROM ${self.table} WHERE ${w.sql}${orderClause}`,
          w.params,
        );
        return applyFilter(rows.map((r) => self.mapper.rowToObject(r)));
      },
      async delete() {
        if (andPreds.length === 0) {
          const r = await dbExecute(`DELETE FROM ${self.table} WHERE ${w.sql}`, w.params);
          bumpDbVersion();
          return r.rows_affected;
        }
        // Con predicado: trae, filtra, borra por id.
        const rows = await dbQueryAll<Record<string, unknown>>(
          `SELECT * FROM ${self.table} WHERE ${w.sql}`, w.params,
        );
        const filtered = applyFilter(rows.map((r) => self.mapper.rowToObject(r)));
        let n = 0;
        for (const obj of filtered) {
          const id = (obj as { id?: number }).id;
          if (id !== undefined) {
            await dbExecute(`DELETE FROM ${self.table} WHERE id = ?`, [P.int(id)]);
            n++;
          }
        }
        if (n > 0) bumpDbVersion();
        return n;
      },
      async first() {
        if (andPreds.length === 0) {
          const rows = await dbQueryAll<Record<string, unknown>>(
            `SELECT * FROM ${self.table} WHERE ${w.sql}${orderClause} LIMIT 1`,
            w.params,
          );
          return rows.length ? self.mapper.rowToObject(rows[0]) : undefined;
        }
        const rows = await this.toArray();
        return rows[0];
      },
      async count() {
        if (andPreds.length === 0) {
          const r = await dbQuery(
            `SELECT count(*) AS c FROM ${self.table} WHERE ${w.sql}`,
            w.params,
          );
          const cell = r.rows[0]?.[0];
          return cell && cell.t === 'int' ? cell.v : 0;
        }
        return (await this.toArray()).length;
      },
      and(predicate: (row: T) => boolean) {
        return self._executor(w, [...andPreds, predicate], descending);
      },
      reverse() {
        return self._executor(w, andPreds, true);
      },
      async sortBy(field: keyof T & string) {
        const rows = await this.toArray();
        return [...rows].sort((a, b) => {
          const av = (a as Record<string, unknown>)[field];
          const bv = (b as Record<string, unknown>)[field];
          if (av == null && bv == null) return 0;
          if (av == null) return -1;
          if (bv == null) return 1;
          if (av < bv) return -1;
          if (av > bv) return 1;
          return 0;
        });
      },
    };
  }

  orderBy(field: string): {
    toArray: () => Promise<T[]>;
    reverse: () => { toArray: () => Promise<T[]> };
    first: () => Promise<T | undefined>;
    last: () => Promise<T | undefined>;
  } {
    const col = camelToSnake(field);
    const run = async (asc: boolean) => {
      const rows = await dbQueryAll<Record<string, unknown>>(
        `SELECT * FROM ${this.table} ORDER BY ${col} ${asc ? 'ASC' : 'DESC'}`,
      );
      return rows.map((r) => this.mapper.rowToObject(r));
    };
    return {
      toArray: () => run(true),
      reverse: () => ({ toArray: () => run(false) }),
      first: async () => {
        const rs = await run(true);
        return rs[0];
      },
      last: async () => {
        const rs = await run(false);
        return rs[0];
      },
    };
  }

  /** Acceso a una sub-query simple por offset/limit. */
  async slice(offset: number, limit: number): Promise<T[]> {
    const rows = await dbQueryAll<Record<string, unknown>>(
      `SELECT * FROM ${this.table} LIMIT ? OFFSET ?`,
      [P.int(limit), P.int(offset)],
    );
    return rows.map((r) => this.mapper.rowToObject(r));
  }
}
