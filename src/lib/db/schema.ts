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
  type?: 'normal' | 'combined'; // Tipo de sesión: normal o combinada
  combinedSessionIds?: number[]; // IDs de las sesiones que se combinaron (solo para type: 'combined')
  createdAt: Date;
  updatedAt: Date;
}

export interface Image {
  id?: number;
  sessionId: number;
  filename: string;
  eyeType: 'OI' | 'OD';
  order?: number; // Ordenar imagenes y actualizar su orden en una sesion
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
  metadata?: Record<string, any>; // For storing additional data like painted pixels, precise points, etc.
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
  reportCategory: 'single' | 'combined';
  pdfBlob: Blob;
  evaluatorNotes: string;
  originalNotes?: string; // The original notes entered by the user before AI processing
  areasOfInterest: Array<{
    imageId: number;
    coords: { x: number; y: number };
    comment: string;
  }>;
  // Tracking de interacciones del usuario con el preview
  previewViewed?: boolean; // El usuario visualizó el preview
  previewDownloaded?: boolean; // El usuario descargó el preview
  conclusionEdited?: boolean; // El usuario editó la conclusión
  generatedAt: Date;
}

export interface Measurement {
  id?: number;
  imageId: number;
  originX: number;
  originY: number;
  destinationX: number;
  destinationY: number;
  distancePixels: number;
  distanceDD?: number;
  visible: boolean;
  createdAt: Date;
}

export interface ImageClassification {
  id?: number;
  imageId: number;
  eyeType: 'OD' | 'OI' | 'unknown';
  eyeTypeDetectionMethod: 'manual' | 'auto' | 'unknown';
  severity: string; // Changed from union type to string to support multiple guidelines
  confidence: 'low' | 'moderate' | 'high';
  lesions: {
    microaneurysms: number;
    hemorrhages: number;
    hardExudates: number;
    softExudates: number;
    neovascularization: number;
  };
  quadrantAnalysisData: string; // JSON stringified QuadrantAnalysis
  quadrantLesionsData: string; // JSON stringified QuadrantLesionCounts
  criteria: string[]; // Array of criteria strings
  usedQuadrantAnalysis: boolean;
  warnings: string[]; // Array of warning strings

  // Clinical Guideline Integration (v12)
  guideline?: string; // ID of clinical guideline used (e.g., 'icdr_2024', 'minsal_chile_2017')
  guidelineName?: string; // Name of guideline for quick reference
  guidelineVersion?: string; // Version of guideline
  treatments?: string[]; // Recommended treatment actions
  followupDays?: number; // Days until recommended follow-up
  urgency?: 'routine' | 'accelerated' | 'urgent'; // Treatment urgency level
  rationale?: string; // Clinical rationale for classification

  // Manual modification tracking (v14)
  manuallyModified?: boolean; // True if user manually modified the AI classification

  createdAt: Date;
  updatedAt: Date;
}

export interface PendingContribution {
  id?: number;
  type: 'image' | 'guideline' | 'conclusion';
  referenceId: number; // imageId, guidelineId (not used for guidelines from files), or imageClassificationId
  status: 'pending' | 'submitted';
  metadata?: Record<string, any>; // Store guideline JSON or conclusion data
  createdAt: Date;
}

export class DirdDatabase extends Dexie {
  patients!: Table<Patient>;
  sessions!: Table<Session>;
  images!: Table<Image>;
  detections!: Table<Detection>;
  segmentations!: Table<Segmentation>;
  reports!: Table<Report>;
  measurements!: Table<Measurement>;
  imageClassifications!: Table<ImageClassification>;
  pendingContributions!: Table<PendingContribution>;

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
    this.version(6).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked',
      images: '++id, sessionId, eyeType, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, reportCategory, generatedAt'
    }).upgrade(tx => {
      return tx.table('reports').toCollection().modify(report => {
        if (report.reportCategory === undefined) {
          report.reportCategory = 'single';
        }
      });
    });
    this.version(7).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked',
      images: '++id, sessionId, eyeType, uploadedAt, contributionStatus', // Added contributionStatus
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, reportCategory, generatedAt'
    }).upgrade(tx => {
      return tx.table('images').toCollection().modify(image => {
        if (!image.contributionStatus) {
          image.contributionStatus = 'none';
        }
      });
    });
    this.version(8).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type', // Added type
      images: '++id, sessionId, eyeType, uploadedAt, contributionStatus',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, reportCategory, generatedAt'
    }).upgrade(tx => {
      return tx.table('sessions').toCollection().modify(session => {
        if (!session.type) {
          session.type = 'normal';
        }
      });
    });
    this.version(9).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt, contributionStatus',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, reportCategory, generatedAt',
      measurements: '++id, imageId, visible, createdAt' // Added measurements table
    });
    this.version(10).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt, contributionStatus',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, sessionId, type, reportCategory, generatedAt',
      measurements: '++id, imageId, visible, createdAt',
      imageClassifications: '++id, imageId, eyeType, severity, createdAt, updatedAt' // Added DR classifications
    });
    this.version(11).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt, contributionStatus',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, [sessionId+type], sessionId, type, reportCategory, generatedAt', // Added compound index
      measurements: '++id, imageId, visible, createdAt',
      imageClassifications: '++id, imageId, eyeType, severity, createdAt, updatedAt'
    });
    this.version(12).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt, contributionStatus',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, [sessionId+type], sessionId, type, reportCategory, generatedAt',
      measurements: '++id, imageId, visible, createdAt',
      imageClassifications: '++id, imageId, eyeType, severity, guideline, urgency, createdAt, updatedAt' // Added guideline fields
    });
    this.version(13).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, [sessionId+type], sessionId, type, reportCategory, generatedAt',
      measurements: '++id, imageId, visible, createdAt',
      imageClassifications: '++id, imageId, eyeType, severity, guideline, urgency, createdAt, updatedAt',
      pendingContributions: '++id, type, referenceId, status, createdAt'
    });
    this.version(14).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, [sessionId+type], sessionId, type, reportCategory, generatedAt',
      measurements: '++id, imageId, visible, createdAt',
      imageClassifications: '++id, imageId, eyeType, severity, guideline, urgency, manuallyModified, createdAt, updatedAt',
      pendingContributions: '++id, type, referenceId, status, createdAt'
    });
    this.version(15).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, [sessionId+type], sessionId, type, reportCategory, generatedAt',
      measurements: '++id, imageId, visible, createdAt',
      imageClassifications: '++id, imageId, eyeType, severity, guideline, urgency, manuallyModified, createdAt, updatedAt',
      pendingContributions: '++id, [type+referenceId], type, referenceId, status, createdAt'
    });
    this.version(16).stores({
      patients: '++id, patientId, name, status, createdAt',
      sessions: '++id, patientId, name, sessionNumber, date, locked, type',
      images: '++id, sessionId, eyeType, uploadedAt',
      detections: '++id, imageId, type, class, visible',
      segmentations: '++id, imageId, type, class, visible',
      reports: '++id, [sessionId+type], sessionId, type, reportCategory, generatedAt', // added originalNotes implicitly (no index needed)
      measurements: '++id, imageId, visible, createdAt',
      imageClassifications: '++id, imageId, eyeType, severity, guideline, urgency, manuallyModified, createdAt, updatedAt',
      pendingContributions: '++id, [type+referenceId], type, referenceId, status, createdAt'
    }).upgrade(_ => {
       // No specific upgrade logic needed for non-indexed fields
    });
  }
}

/**
 * Instancia Dexie legacy. Sólo usada por el migrador en F0.8 para leer datos
 * de v1.0.1 antes de moverlos a SQLite. NO usar en código de aplicación.
 */
export const legacyDb = new DirdDatabase();

// Re-export del facade SQLCipher como `db` (drop-in con la API Dexie usada
// por la app). Esto materializa el swap atómico F0.8b: todas las lecturas y
// escrituras pasan por SQLCipher, no por IndexedDB.
import { sqlDb } from '@/lib/db-sql/db';
export const db = sqlDb;
