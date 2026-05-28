import type { Patient } from '@/lib/db/schema';
import { dbExecute, dbQueryAll, dbQueryOne, P } from '../client';
import { intToBool, parseIsoDate } from '../mapper';

function rowToPatient(r: Record<string, unknown>): Patient {
  return {
    id: r.id as number,
    patientId: r.patient_id as string,
    name: r.name as string,
    dateOfBirth: parseIsoDate(r.date_of_birth) ?? new Date(0),
    status: r.status as 'active' | 'archived',
    diabetes: intToBool(r.diabetes),
    diabetesType: (r.diabetes_type as Patient['diabetesType']) ?? undefined,
    diabetesDuration: (r.diabetes_duration as number | null) ?? undefined,
    hta: intToBool(r.hta),
    dlp: intToBool(r.dlp),
    medications: JSON.parse((r.medications as string) ?? '[]'),
    otherConditions: (r.other_conditions as string | null) ?? undefined,
    metadata: r.metadata ? JSON.parse(r.metadata as string) : undefined,
    createdAt: parseIsoDate(r.created_at) ?? new Date(0),
    updatedAt: parseIsoDate(r.updated_at) ?? new Date(0),
  };
}

export async function getPatient(id: number): Promise<Patient | null> {
  const r = await dbQueryOne('SELECT * FROM patients WHERE id = ?', [P.int(id)]);
  return r ? rowToPatient(r) : null;
}

export async function getPatientByPatientId(patientId: string): Promise<Patient | null> {
  const r = await dbQueryOne('SELECT * FROM patients WHERE patient_id = ?', [P.text(patientId)]);
  return r ? rowToPatient(r) : null;
}

export async function listPatients(filter: { status?: 'active' | 'archived' } = {}): Promise<Patient[]> {
  if (filter.status) {
    const rows = await dbQueryAll('SELECT * FROM patients WHERE status = ? ORDER BY created_at DESC', [
      P.text(filter.status),
    ]);
    return rows.map(rowToPatient);
  }
  const rows = await dbQueryAll('SELECT * FROM patients ORDER BY created_at DESC');
  return rows.map(rowToPatient);
}

export async function insertPatient(p: Omit<Patient, 'id'>): Promise<number> {
  const now = new Date().toISOString();
  const r = await dbExecute(
    `INSERT INTO patients (
       patient_id, name, date_of_birth, status,
       diabetes, diabetes_type, diabetes_duration,
       hta, dlp, medications, other_conditions, metadata,
       created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      P.text(p.patientId),
      P.text(p.name),
      P.text(p.dateOfBirth.toISOString()),
      P.text(p.status),
      P.bool(p.diabetes),
      P.opt(p.diabetesType ?? null),
      P.opt(p.diabetesDuration ?? null),
      P.bool(p.hta),
      P.bool(p.dlp),
      P.json(p.medications),
      P.opt(p.otherConditions ?? null),
      p.metadata ? P.json(p.metadata) : P.null(),
      P.text(p.createdAt?.toISOString() ?? now),
      P.text(p.updatedAt?.toISOString() ?? now),
    ],
  );
  return r.last_insert_id;
}

export async function updatePatient(id: number, p: Partial<Omit<Patient, 'id'>>): Promise<void> {
  const fields: string[] = [];
  const params = [] as ReturnType<typeof P.text>[];
  const map: Array<[keyof Patient, string, (v: unknown) => ReturnType<typeof P.text>]> = [
    ['patientId', 'patient_id', (v) => P.text(v as string)],
    ['name', 'name', (v) => P.text(v as string)],
    ['dateOfBirth', 'date_of_birth', (v) => P.text((v as Date).toISOString())],
    ['status', 'status', (v) => P.text(v as string)],
    ['diabetes', 'diabetes', (v) => P.bool(v as boolean)],
    ['diabetesType', 'diabetes_type', (v) => P.opt((v as string) ?? null)],
    ['diabetesDuration', 'diabetes_duration', (v) => P.opt((v as number) ?? null)],
    ['hta', 'hta', (v) => P.bool(v as boolean)],
    ['dlp', 'dlp', (v) => P.bool(v as boolean)],
    ['medications', 'medications', (v) => P.json(v)],
    ['otherConditions', 'other_conditions', (v) => P.opt((v as string) ?? null)],
    ['metadata', 'metadata', (v) => (v ? P.json(v) : P.null())],
  ];
  for (const [key, col, conv] of map) {
    if (key in p) {
      fields.push(`${col} = ?`);
      params.push(conv((p as Record<string, unknown>)[key]));
    }
  }
  fields.push('updated_at = ?');
  params.push(P.text(new Date().toISOString()));
  params.push(P.int(id));
  await dbExecute(`UPDATE patients SET ${fields.join(', ')} WHERE id = ?`, params);
}

export async function deletePatient(id: number): Promise<void> {
  // CASCADE en sessions/images/detections/etc.
  await dbExecute('DELETE FROM patients WHERE id = ?', [P.int(id)]);
}

export async function countPatients(): Promise<number> {
  const r = await dbQueryOne<{ c: number }>('SELECT count(*) AS c FROM patients');
  return (r?.c as number) ?? 0;
}
