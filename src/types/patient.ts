export interface PatientData {
  id?: number;
  patientId: string;
  name: string;
  dateOfBirth: Date;
  metadata?: Record<string, any>;
  createdAt: Date;
  updatedAt: Date;
}

export interface SessionData {
  id?: number;
  patientId: number;
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

export interface ImageData {
  id?: number;
  sessionId: number;
  filename: string;
  originalBlob: Blob;
  processedBlob?: Blob;
  width: number;
  height: number;
  uploadedAt: Date;
}

export interface PatientWithSessions extends PatientData {
  sessions: SessionData[];
}
