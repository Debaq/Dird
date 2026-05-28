import { invoke } from '@tauri-apps/api/core';

export type SqlParam =
  | { t: 'null' }
  | { t: 'int'; v: number }
  | { t: 'real'; v: number }
  | { t: 'text'; v: string }
  | { t: 'blob'; v: number[] }
  | { t: 'bool'; v: boolean };

export type SqlCell =
  | { t: 'null' }
  | { t: 'int'; v: number }
  | { t: 'real'; v: number }
  | { t: 'text'; v: string }
  | { t: 'blob'; v: number[] };

export interface ExecResult {
  rows_affected: number;
  last_insert_id: number;
}

export interface QueryResult {
  columns: string[];
  rows: SqlCell[][];
}

export const P = {
  null: (): SqlParam => ({ t: 'null' }),
  int: (v: number): SqlParam => ({ t: 'int', v: Math.trunc(v) }),
  real: (v: number): SqlParam => ({ t: 'real', v }),
  text: (v: string): SqlParam => ({ t: 'text', v }),
  blob: (v: Uint8Array): SqlParam => ({ t: 'blob', v: Array.from(v) }),
  bool: (v: boolean): SqlParam => ({ t: 'bool', v }),
  date: (v: Date): SqlParam => ({ t: 'text', v: v.toISOString() }),
  /** Convierte un valor opcional a SqlParam — null/undefined → t:'null'. */
  opt: (v: string | number | boolean | Date | null | undefined): SqlParam => {
    if (v === null || v === undefined) return { t: 'null' };
    if (v instanceof Date) return { t: 'text', v: v.toISOString() };
    if (typeof v === 'string') return { t: 'text', v };
    if (typeof v === 'boolean') return { t: 'bool', v };
    return Number.isInteger(v) ? { t: 'int', v } : { t: 'real', v };
  },
  json: (v: unknown): SqlParam => ({ t: 'text', v: JSON.stringify(v) }),
};

/** Convierte una celda SQL en valor JS típico. BLOB → Uint8Array. NULL → null. */
export function cellValue(c: SqlCell): unknown {
  switch (c.t) {
    case 'null': return null;
    case 'blob': return new Uint8Array(c.v);
    default: return c.v;
  }
}

/** Convierte una fila en objeto plano usando columns. */
export function rowToObject(columns: string[], row: SqlCell[]): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (let i = 0; i < columns.length; i++) {
    out[columns[i]] = cellValue(row[i]);
  }
  return out;
}

export async function dbOpen(password: string): Promise<void> {
  await invoke('db_open', { password });
}

export async function dbClose(): Promise<void> {
  await invoke('db_close');
}

export async function dbIsOpen(): Promise<boolean> {
  return invoke<boolean>('db_is_open');
}

export async function dbExists(): Promise<boolean> {
  return invoke<boolean>('db_exists');
}

export async function dbSchemaVersion(): Promise<number | null> {
  return invoke<number | null>('db_schema_version');
}

export async function dbExecute(sql: string, params: SqlParam[] = []): Promise<ExecResult> {
  return invoke<ExecResult>('db_execute', { sql, params });
}

export async function dbQuery(sql: string, params: SqlParam[] = []): Promise<QueryResult> {
  return invoke<QueryResult>('db_query', { sql, params });
}

export async function dbQueryAll<T = Record<string, unknown>>(
  sql: string,
  params: SqlParam[] = [],
): Promise<T[]> {
  const r = await dbQuery(sql, params);
  return r.rows.map((row) => rowToObject(r.columns, row) as T);
}

export async function dbQueryOne<T = Record<string, unknown>>(
  sql: string,
  params: SqlParam[] = [],
): Promise<T | null> {
  const r = await dbQuery(sql, params);
  if (r.rows.length === 0) return null;
  return rowToObject(r.columns, r.rows[0]) as T;
}

export async function dbChangePassword(newPassword: string): Promise<void> {
  await invoke('db_change_password_with_handle', { newPassword });
}
