import JSZip from 'jszip';
import { db } from '@/lib/db/schema';
import type { Patient, Detection, Segmentation } from '@/lib/db/schema';
import type { DirdExportMetadata } from './dird-exporter';

export interface ImportResult {
  success: boolean;
  patient?: Patient;
  sessionsImported: number;
  imagesImported: number;
  detectionsImported: number;
  error?: string;
}

export async function importDirdFile(file: File): Promise<ImportResult> {
  try {
    // Load ZIP file
    const zip = await JSZip.loadAsync(file);

    // Read metadata
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid .dird file: metadata.json not found');
    }

    const metadataContent = await metadataFile.async('text');
    const metadata: DirdExportMetadata = JSON.parse(metadataContent);

    // Check if patient already exists
    const existingPatient = await db.patients
      .where('patientId')
      .equals(metadata.patient.patientId)
      .first();

    if (existingPatient) {
      const overwrite = confirm(
        `El paciente ${metadata.patient.name} (${metadata.patient.patientId}) ya existe. ¿Deseas sobrescribirlo?`
      );
      if (!overwrite) {
        return {
          success: false,
          error: 'Importación cancelada por el usuario',
          sessionsImported: 0,
          imagesImported: 0,
          detectionsImported: 0,
        };
      }

      // Delete existing patient and all related data
      await deletePatientData(existingPatient.id!);
    }

    // Import patient
    const patientId = await db.patients.add({
      ...metadata.patient,
      id: undefined, // Let database assign new ID
    });

    let sessionsImported = 0;
    let imagesImported = 0;
    let detectionsImported = 0;

    // Import sessions
    for (const sessionData of metadata.sessions) {
      const sessionNumber = sessionData.sessionNumber;
      const sessionFolderName = `sessions/session_${String(sessionNumber).padStart(3, '0')}`;

      // Import session
      const sessionId = await db.sessions.add({
        ...sessionData,
        id: undefined,
        patientId: patientId as number,
      });
      sessionsImported++;

      // Import images
      const imagesFolder = zip.folder(`${sessionFolderName}/images`);
      if (imagesFolder) {
        const imageFiles = Object.keys(zip.files).filter(
          (name) => name.startsWith(`${sessionFolderName}/images/`) && !zip.files[name].dir
        );

        // Map old image IDs to new ones
        const imageIdMap = new Map<number, number>();
        let imageIndex = 0;

        for (const imagePath of imageFiles) {
          const imageFile = zip.files[imagePath];
          const filename = imagePath.split('/').pop()!;
          const blob = await imageFile.async('blob');

          // Load image to get dimensions
          const img = await loadImageFromBlob(blob);

          const newImageId = await db.images.add({
            sessionId: sessionId as number,
            filename,
            eyeType: 'OI', // Default value for imported images
            originalBlob: blob,
            width: img.width,
            height: img.height,
            uploadedAt: new Date(),
          });

          imageIdMap.set(imageIndex, newImageId as number);
          imageIndex++;
          imagesImported++;
        }

        // Import detections
        const detectionsFile = zip.file(`${sessionFolderName}/detections.json`);
        if (detectionsFile) {
          const detectionsContent = await detectionsFile.async('text');
          const detections: Detection[] = JSON.parse(detectionsContent);

          for (const detection of detections) {
            // Map old imageId to new imageId
            const newImageId = Array.from(imageIdMap.values())[
              detections.indexOf(detection) % imageIdMap.size
            ];

            await db.detections.add({
              ...detection,
              id: undefined,
              imageId: newImageId,
            });
            detectionsImported++;
          }
        }

        // Import segmentations
        const segmentationsFile = zip.file(`${sessionFolderName}/segmentations.json`);
        if (segmentationsFile) {
          const segmentationsContent = await segmentationsFile.async('text');
          const segmentations: Segmentation[] = JSON.parse(segmentationsContent);

          for (const segmentation of segmentations) {
            const newImageId = Array.from(imageIdMap.values())[
              segmentations.indexOf(segmentation) % imageIdMap.size
            ];

            await db.segmentations.add({
              ...segmentation,
              id: undefined,
              imageId: newImageId,
            });
          }
        }

        // Import reports
        const reportFiles = Object.keys(zip.files).filter(
          (name) => name.startsWith(`${sessionFolderName}/report_`) && name.endsWith('.pdf')
        );

        for (const reportPath of reportFiles) {
          const reportFile = zip.files[reportPath];
          const blob = await reportFile.async('blob');
          const reportType = reportPath.includes('final') ? 'final' : 'preview';

          await db.reports.add({
            sessionId: sessionId as number,
            type: reportType as 'preview' | 'final',
            reportCategory: 'single',
            pdfBlob: blob,
            evaluatorNotes: '',
            areasOfInterest: [],
            generatedAt: new Date(),
          });
        }
      }
    }

    const importedPatient = await db.patients.get(patientId as number);

    return {
      success: true,
      patient: importedPatient,
      sessionsImported,
      imagesImported,
      detectionsImported,
    };
  } catch (error) {
    console.error('Error importing .dird file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      sessionsImported: 0,
      imagesImported: 0,
      detectionsImported: 0,
    };
  }
}

async function deletePatientData(patientId: number) {
  // Get all sessions
  const sessions = await db.sessions.where('patientId').equals(patientId).toArray();

  for (const session of sessions) {
    // Get all images
    const images = await db.images.where('sessionId').equals(session.id!).toArray();

    for (const image of images) {
      // Delete detections and segmentations
      await db.detections.where('imageId').equals(image.id!).delete();
      await db.segmentations.where('imageId').equals(image.id!).delete();
    }

    // Delete images
    await db.images.where('sessionId').equals(session.id!).delete();

    // Delete reports
    await db.reports.where('sessionId').equals(session.id!).delete();
  }

  // Delete sessions
  await db.sessions.where('patientId').equals(patientId).delete();

  // Delete patient
  await db.patients.delete(patientId);
}

function loadImageFromBlob(blob: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(blob);

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load image'));
    };

    img.src = url;
  });
}
