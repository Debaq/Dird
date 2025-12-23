import Dexie, { Table } from 'dexie';

export interface Patient {
  id?: number;
  patientId: string;
  name: string;
  dateOfBirth: Date;
  status: 'active' | 'archived';
  diabetes: boolean;
  diabetesType?: 'type1' | 'type2' | 'gestational' | 'other';
  diabetesDuration?: number; // años desde diagnóstico
  hta: boolean; // Hipertensión Arterial
  dlp: boolean; // Dislipidemia
  medications: string[]; // medicamentos que toma
  otherConditions?: string; // otros antecedentes relevantes
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface Session {
  id?: number;
  patientId: number;
  name?: string;
  sessionNumber: number;
  date: Date;
  notes?: string;
  modelVersions: {
    detection?: string;
    segmentation?: string;
  };
  locked: boolean;
  lockedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface Image {
  id?: number;
  sessionId: number;
  filename: string;
  eyeType: 'OI' | 'OD';
  originalBlob: Blob;
  processedBlob?: Blob;
  width: number;
  height: number;
  uploadedAt: Date;
}

export interface Detection {
  id?: number;
  imageId: number;
  type: 'ai' | 'manual';
  modelVersion?: string;
  bbox: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  class: string;
  confidence?: number;
  customLabel?: string;
  visible: boolean;
  createdAt: Date;
}

export interface Segmentation {
  id?: number;
  imageId: number;
  type: 'ai' | 'manual';
  modelVersion?: string;
  maskData: string;
  class: string;
  confidence?: number;
  customLabel?: string;
  opacity: number;
  visible: boolean;
  createdAt: Date;
}

export interface Report {
  id?: number;
  sessionId: number;
  type: 'preview' | 'final';
  pdfBlob: Blob;
  evaluatorNotes: string;
  areasOfInterest: Array<{
    imageId: number;
    coords: { x: number; y: number };
    comment: string;
  }>;
  generatedAt: Date;
}

export class DirdDatabase extends Dexie {
  patients!: Table<Patient>;
  sessions!: Table<Session>;
  images!: Table<Image>;
  detections!: Table<Detection>;
  segmentations!: Table<Segmentation>;
  reports!: Table<Report>;

  constructor() {
    super('DirdDatabase');
    this.version(1).stores({
      patients: '++id, patientId, name, createdAt',
      sessions: '++id, patientId, sessionNumber, date, locked',
      images: '++id, sessionId, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, generatedAt'
    });
    this.version(2).stores({
      patients: '++id, patientId, name, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked', // Added 'name'
      images: '++id, sessionId, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, generatedAt'
    });
    this.version(3).stores({
      patients: '++id, patientId, name, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked',
      images: '++id, sessionId, eyeType, uploadedAt', // Added eyeType
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, generatedAt'
    }).upgrade(tx => {
      return tx.table('images').toCollection().modify(image => {
        if (!image.eyeType) {
          image.eyeType = 'OI';
        }
      });
    });
    this.version(4).stores({
      patients: '++id, patientId, name, status, createdAt', // Added status
      sessions: '++id, patientId, name, sessionNumber, date, locked',
      images: '++id, sessionId, eyeType, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, generatedAt'
    }).upgrade(tx => {
      return tx.table('patients').toCollection().modify(patient => {
        if (patient.status === undefined) {
          patient.status = 'active';
        }
      });
    });
    this.version(5).stores({
      patients: '++id, patientId, name, status, createdAt', // Added medical fields
      sessions: '++id, patientId, name, sessionNumber, date, locked',
      images: '++id, sessionId, eyeType, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, generatedAt'
    }).upgrade(tx => {
      return tx.table('patients').toCollection().modify(patient => {
        patient.diabetes = false;
        patient.hta = false;
        patient.dlp = false;
        patient.medications = [];
      });
    });
  }
}

export const db = new DirdDatabase();
