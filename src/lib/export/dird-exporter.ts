import JSZip from 'jszip';
import { db } from '@/lib/db/schema';
import type { Patient, Session, Detection, Segmentation } from '@/lib/db/schema';

export interface DirdExportMetadata {
  export_version: string;
  exported_at: string;
  patient: Patient;
  sessions: Session[];
}

export async function exportPatient(patientId: number): Promise<Blob> {
  const zip = new JSZip();

  // Get patient data
  const patient = await db.patients.get(patientId);
  if (!patient) throw new Error('Patient not found');

  // Get all sessions for this patient
  const sessions = await db.sessions.where('patientId').equals(patientId).toArray();

  // Create metadata
  const metadata: DirdExportMetadata = {
    export_version: '1.0.1',
    exported_at: new Date().toISOString(),
    patient,
    sessions,
  };

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Export each session
  for (const session of sessions) {
    const sessionFolder = zip.folder(`sessions/session_${String(session.sessionNumber).padStart(3, '0')}`);
    if (!sessionFolder) continue;

    // Get images for this session
    const images = await db.images.where('sessionId').equals(session.id!).toArray();

    // Images folder
    const imagesFolder = sessionFolder.folder('images');
    if (imagesFolder) {
      for (const image of images) {
        imagesFolder.file(image.filename, image.originalBlob);
      }
    }

    // Get detections for all images in this session
    const allDetections: Detection[] = [];
    const allSegmentations: Segmentation[] = [];

    for (const image of images) {
      const detections = await db.detections.where('imageId').equals(image.id!).toArray();
      const segmentations = await db.segmentations.where('imageId').equals(image.id!).toArray();
      allDetections.push(...detections);
      allSegmentations.push(...segmentations);
    }

    // Save detections and segmentations as JSON
    if (allDetections.length > 0) {
      sessionFolder.file('detections.json', JSON.stringify(allDetections, null, 2));
    }

    if (allSegmentations.length > 0) {
      sessionFolder.file('segmentations.json', JSON.stringify(allSegmentations, null, 2));
    }

    // Get reports for this session
    const reports = await db.reports.where('sessionId').equals(session.id!).toArray();
    if (reports.length > 0) {
      const reportsFolder = sessionFolder.folder('reports');
      if (reportsFolder) {
        for (const report of reports) {
          const reportName = `report_${report.type}.pdf`;
          reportsFolder.file(reportName, report.pdfBlob);
        }
      }
    }
  }

  // Generate ZIP blob
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

export async function exportSession(sessionId: number): Promise<Blob> {
  const zip = new JSZip();

  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  const patient = await db.patients.get(session.patientId);
  if (!patient) throw new Error('Patient not found for session');

  const metadata: DirdExportMetadata = {
    export_version: '1.0.1',
    exported_at: new Date().toISOString(),
    patient,
    sessions: [session],
  };

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  const images = await db.images.where('sessionId').equals(sessionId).toArray();
  const imagesFolder = zip.folder('images');
  if (imagesFolder) {
    for (const image of images) {
      imagesFolder.file(image.filename, image.originalBlob);
    }
  }

  const allDetections: Detection[] = [];
  const allSegmentations: Segmentation[] = [];
  for (const image of images) {
    const detections = await db.detections.where('imageId').equals(image.id!).toArray();
    allDetections.push(...detections);
    const segmentations = await db.segmentations.where('imageId').equals(image.id!).toArray();
    allSegmentations.push(...segmentations);
  }

  if (allDetections.length > 0) {
    zip.file('detections.json', JSON.stringify(allDetections, null, 2));
  }
  if (allSegmentations.length > 0) {
    zip.file('segmentations.json', JSON.stringify(allSegmentations, null, 2));
  }

  const reports = await db.reports.where('sessionId').equals(sessionId).toArray();
  if (reports.length > 0) {
    const reportsFolder = zip.folder('reports');
    if (reportsFolder) {
      for (const report of reports) {
        reportsFolder.file(`report_${report.type}.pdf`, report.pdfBlob);
      }
    }
  }

  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

export async function exportAllData(): Promise<Blob> {
  const zip = new JSZip();

  // Get all patients
  const patients = await db.patients.toArray();

  for (const patient of patients) {
    const patientBlob = await exportPatient(patient.id!);
    const patientZip = await JSZip.loadAsync(patientBlob);

    // Add to main zip with patient folder
    const patientFolderName = `paciente_${patient.patientId}`;
    const patientFolder = zip.folder(patientFolderName);

    if (patientFolder) {
      // Copy all files from patient zip to main zip
      const files = Object.keys(patientZip.files);
      for (const filename of files) {
        const file = patientZip.files[filename];
        if (!file.dir) {
          const content = await file.async('blob');
          patientFolder.file(filename, content);
        }
      }
    }
  }

  // Generate ZIP blob
  const blob = await zip.generateAsync({ type: 'blob' });
  return blob;
}

export function downloadDirdFile(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename.endsWith('.dird') ? filename : `${filename}.dird`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
