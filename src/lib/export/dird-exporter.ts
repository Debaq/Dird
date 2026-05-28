import JSZip from 'jszip';
import { db } from '@/lib/db/schema';
import type { Patient, Session, Detection, Segmentation, Measurement } from '@/lib/db/schema';
import { encryptContainer } from './dird-container';

const EXPORT_VERSION = '2.0.0';

/**
 * Finaliza un ZIP. Si `password` viene, devuelve un contenedor `.dird` v2.0 cifrado;
 * si no, devuelve el ZIP plano (modo legacy v1.0.1, sólo para migración).
 */
async function finalize(zip: JSZip, password?: string): Promise<Blob> {
  if (!password) {
    return zip.generateAsync({ type: 'blob' });
  }
  const zipBytes = await zip.generateAsync({ type: 'uint8array' });
  const container = await encryptContainer(zipBytes, password);
  return new Blob([container as BlobPart], { type: 'application/octet-stream' });
}

export interface DirdExportMetadata {
  export_version: string;
  exported_at: string;
  export_type: 'full' | 'patient' | 'session';
  patient?: Patient;
  sessions?: Session[];
  
}

export async function exportPatient(patientId: number, password?: string): Promise<Blob> {
  const zip = new JSZip();

  // Get patient data
  const patient = await db.patients.get(patientId);
  if (!patient) throw new Error('Patient not found');

  // Get all sessions for this patient
  const sessions = await db.sessions.where('patientId').equals(patientId).toArray();

  // Create metadata
  const metadata: DirdExportMetadata = {
    export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    export_type: 'patient',
    patient,
    sessions
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

    // Image metadata
    const imagesMetadata = images.map(img => ({
      id: img.id,
      filename: img.filename,
      eyeType: img.eyeType,
    }))

    sessionFolder.file('images_metadata.json', JSON.stringify(imagesMetadata, null, 2));

    // Get detections / segmentations / measurements for all images in this session
    const allDetections: Detection[] = [];
    const allSegmentations: Segmentation[] = [];
    const allMeasurements: Measurement[] = [];


    for (const image of images) {
      const detections = await db.detections.where('imageId').equals(image.id!).toArray();
      const segmentations = await db.segmentations.where('imageId').equals(image.id!).toArray();
      const measurements = await db.measurements.where('imageId').equals(image.id!).toArray();
      allDetections.push(...detections);
      allSegmentations.push(...segmentations);
      allMeasurements.push(...measurements);
    }

    // Save detections, measurements and segmentations as JSON
    if (allDetections.length > 0) {
      sessionFolder.file('detections.json', JSON.stringify(allDetections, null, 2));
    }

    if (allSegmentations.length > 0) {
      sessionFolder.file('segmentations.json', JSON.stringify(allSegmentations, null, 2));
    }

    if (allMeasurements.length > 0) {
      sessionFolder.file('measurements.json', JSON.stringify(allMeasurements, null, 2));
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
    } else {
      console.log('no reports found for session', session.id);
    }
  }

  return finalize(zip, password);
}

export async function exportSession(sessionId: number, password?: string): Promise<Blob> {
  const zip = new JSZip();

  const session = await db.sessions.get(sessionId);
  if (!session) throw new Error('Session not found');

  const metadata: DirdExportMetadata = {
    export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    export_type: 'session',
    sessions: [session]
  };

  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  const images = await db.images.where('sessionId').equals(sessionId).toArray();
  const imagesFolder = zip.folder('images');
  if (imagesFolder) {
    for (const image of images) {
      imagesFolder.file(image.filename, image.originalBlob);
    }
  }

  // Image metadata
  const imagesMetadata = images.map(img => ({
    id: img.id,
    filename: img.filename,
    eyeType: img.eyeType,
  }))

  zip.file('images_metadata.json', JSON.stringify(imagesMetadata, null, 2));

  const allDetections: Detection[] = [];
  const allSegmentations: Segmentation[] = [];
  const allMeasurements: Measurement[] = [];
  for (const image of images) {
    const detections = await db.detections.where('imageId').equals(image.id!).toArray();
    allDetections.push(...detections);
    const segmentations = await db.segmentations.where('imageId').equals(image.id!).toArray();
    allSegmentations.push(...segmentations);
    const measurements = await db.measurements.where('imageId').equals(image.id!).toArray();
    allMeasurements.push(...measurements);
  }

  if (allDetections.length > 0) {
    zip.file('detections.json', JSON.stringify(allDetections, null, 2));
  }
  if (allSegmentations.length > 0) {
    zip.file('segmentations.json', JSON.stringify(allSegmentations, null, 2));
  }
  if (allMeasurements.length > 0) {
    zip.file('measurements.json', JSON.stringify(allMeasurements, null, 2));
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

  return finalize(zip, password);
}

export async function exportAllData(password?: string): Promise<Blob> {
  const zip = new JSZip();

  const metadata: DirdExportMetadata = {
    export_version: EXPORT_VERSION,
    exported_at: new Date().toISOString(),
    export_type: 'full',
  };


  zip.file('metadata.json', JSON.stringify(metadata, null, 2));

  // Get all patients
  const patients = await db.patients.toArray();

  for (const patient of patients) {
    const patientFolder = zip.folder(`paciente_${patient.patientId}`);
    if (!patientFolder) continue;

    const sessions = await db.sessions.where('patientId').equals(patient.id!).toArray();

    const patientMetadata: DirdExportMetadata = {
      export_version: EXPORT_VERSION,
      exported_at: new Date().toISOString(),
      export_type: 'patient',
      patient, sessions
    };

    patientFolder.file('metadata.json', JSON.stringify(patientMetadata, null, 2));

    for (const session of sessions) {
      const sessionFolder = patientFolder.folder(`sessions/session_${String(session.sessionNumber).padStart(3, '0')}`);
      if (!sessionFolder) continue;

      const images = await db.images.where('sessionId').equals(session.id!).toArray();

      const imagesFolder = sessionFolder.folder('images');
      if (imagesFolder) {
        for (const image of images) {
          imagesFolder.file(image.filename, image.originalBlob);
        }
      }

      const imagesMetadata = images.map(img => ({
        id: img.id,
        filename: img.filename,
        eyeType: img.eyeType
      }));

      sessionFolder.file('images_metadata.json', JSON.stringify(imagesMetadata, null, 2));

      const allDetections: Detection[] = [];
      const allSegmentations: Segmentation[] = [];
      const allMeasurements: Measurement[] = [];

      for (const image of images) {
        allDetections.push(...(await db.detections.where('imageId').equals(image.id!).toArray()));
        allSegmentations.push(...(await db.segmentations.where('imageId').equals(image.id!).toArray()));
        allMeasurements.push(...(await db.measurements.where('imageId').equals(image.id!).toArray()));
      }

      if (allDetections.length > 0) {sessionFolder.file('detections.json', JSON.stringify(allDetections, null, 2));}
      if (allSegmentations.length > 0) {sessionFolder.file('segmentations.json', JSON.stringify(allSegmentations, null, 2));}
      if (allMeasurements.length > 0) {sessionFolder.file('measurements.json', JSON.stringify(allMeasurements, null, 2));}

      const reports = await db.reports.where('sessionId').equals(session.id!).toArray();
      if (reports.length > 0) {
        const reportsFolder = sessionFolder.folder('reports');
        if (reportsFolder) {
          for (const report of reports) {
            reportsFolder.file(`report_${report.type}.pdf`, report.pdfBlob);
          }
        }
      }

    }
  }

  return finalize(zip, password);
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
