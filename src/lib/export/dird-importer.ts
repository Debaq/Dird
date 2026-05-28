import JSZip from 'jszip';
import { db } from '@/lib/db/schema';
import type { Patient, Detection, Segmentation, Measurement } from '@/lib/db/schema';
import type { DirdExportMetadata } from './dird-exporter';
import { isEncryptedContainer, decryptContainer, DirdContainerError } from './dird-container';

/**
 * Lee un archivo `.dird`. Si tiene magic `DIRD` (contenedor v2.0 cifrado), pide
 * `password`. Si es ZIP plano (v1.0.1 legacy) lo abre directo.
 */
async function readDirdAsZip(file: File, password?: string): Promise<JSZip> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isEncryptedContainer(bytes)) {
    if (!password) {
      throw new DirdContainerError('Archivo cifrado: se requiere contraseña.');
    }
    const { zipBytes } = await decryptContainer(bytes, password);
    return JSZip.loadAsync(zipBytes);
  }
  return JSZip.loadAsync(bytes);
}

export interface ImportResult {
  success: boolean;
  patient?: Patient;
  sessionsImported?: number;
  imagesImported: number;
  detectionsImported: number;
  segmentationsImported: number;
  measurementsImported: number;
  reportsImported: number;
  patientsImported?: number;
  error?: string;
  import_type?: 'patient' | 'session' | 'full'
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
      await db.measurements.where('imageId').equals(image.id!).delete();
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

async function deleteSessionData(sessionId: number) {
  // Get all images
  const images = await db.images.where('sessionId').equals(sessionId!).toArray();

  for (const image of images) {
    // Delete detections and segmentations
    await db.detections.where('imageId').equals(image.id!).delete();
    await db.segmentations.where('imageId').equals(image.id!).delete();
    await db.measurements.where('imageId').equals(image.id!).delete();
  }

  // Delete images
  await db.images.where('sessionId').equals(sessionId).delete();

  // Delete reports
  await db.reports.where('sessionId').equals(sessionId).delete();

  // Delete session
  await db.sessions.where('id').equals(sessionId).delete();
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

async function importSessionZip(zip: JSZip, metadata: DirdExportMetadata, targetPatientId: number): Promise<ImportResult> {
  try{

    if (!metadata.sessions || metadata.sessions.length !== 1 ) {
      throw new Error('Invalid session export: expected exactly one session');
    }

    // Check if session already exists
    const sessionData = metadata.sessions[0];
    const existingSession = await db.sessions.where('patientId').equals(targetPatientId).and(s => s.sessionNumber === sessionData.sessionNumber).first();

    if (existingSession) {
      const overwrite = confirm(`La sesion ${metadata.sessions[0].name} (${metadata.sessions[0].sessionNumber}) ya existe. ¿Deseas sobrescribirlo?`);
      if (!overwrite) {
        return {
          success: false,
          error: 'Importación cancelada por el usuario',
          imagesImported: 0,
          detectionsImported: 0,
          segmentationsImported: 0,
          reportsImported: 0,
          measurementsImported: 0
        };
      }

      // Delete existing session and all related data
      await deleteSessionData(existingSession.id!);
    }

    let sessionsImported = 0;
    let imagesImported = 0;
    let detectionsImported = 0;
    let segmentationsImported = 0;
    let measurementsImported = 0;
    let reportsImported = 0;

    const sessionId = await db.sessions.add({
      ...sessionData,
      id: undefined,
      patientId: targetPatientId,
    });
    sessionsImported++;


    // Import images
    const imagesMetaFile = zip.file(`images_metadata.json`);
    if (!imagesMetaFile) {
      throw new Error('Missing image.json');
    }
    const imagesMeta = JSON.parse(await imagesMetaFile.async('text'));

    const imageIdMap = new Map<number, number>();

    
    for (const imgMeta of imagesMeta) {
      const blob = await zip.file(`images/${imgMeta.filename}`)!.async('blob');
      const img = await loadImageFromBlob(blob);

      const newImageId = await db.images.add({
        sessionId: sessionId as number,
        filename: imgMeta.filename,
        eyeType: 'OI',
        originalBlob: blob,
        width: img.width,
        height: img.height,
        uploadedAt: new Date(),
      });

      imageIdMap.set(imgMeta.id, newImageId as number);
      imagesImported++;
    }

    // Import detections
    const detectionsFile = zip.file(`detections.json`);
    if (detectionsFile) {
      const detections: Detection[] = JSON.parse(
        await detectionsFile.async('text')
      );

      for (const detection of detections) {
        const newImageId = imageIdMap.get(detection.imageId as number);

        if (!newImageId) {
          throw new Error('Missing image mapping for imageId ${detection.imageId}')
        }

        await db.detections.add({
          ...detection,
          id: undefined,
          imageId: newImageId,
        });
        detectionsImported++;
      }
    }

    // Import segmentations
    const segmentationsFile = zip.file(`segmentations.json`);
    if (segmentationsFile) {
      const segmentationsContent = await segmentationsFile.async('text');
      const segmentations: Segmentation[] = JSON.parse(segmentationsContent);

      for (const segmentation of segmentations) {
        const newImageId = imageIdMap.get(segmentation.imageId as number);

        if (!newImageId) {
          throw new Error('Missing image mapping for imageId ${detection.imageId}')
        }

        await db.segmentations.add({
          ...segmentation,
          id: undefined,
          imageId: newImageId,
        });
        segmentationsImported++;
      }
    }

    // Import reports
    const reportFiles = Object.keys(zip.files).filter(
      (name) => name.startsWith(`report/`) && name.endsWith('.pdf')
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
      reportsImported++;
    }

    // Import measurements 
    const measurementsFile = zip.file(`measurements.json`);
    if (measurementsFile) {
      const measurementsContent = await measurementsFile.async('text');
      const measurements: Measurement[] = JSON.parse(measurementsContent);

      for (const measurement of measurements) {
        const newImageId = imageIdMap.get(measurement.imageId as number);

        if (!newImageId) {
          throw new Error('Missing image mapping for imageId ${detection.imageId}')
        }

        await db.measurements.add({
          ...measurement,
          id: undefined,
          imageId:newImageId,
        });
      }
    }

    return {
      success: true,
      sessionsImported,
      imagesImported,
      detectionsImported,
      segmentationsImported,
      measurementsImported,
      reportsImported,
      import_type: 'session'
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      sessionsImported: 0,
      imagesImported: 0,
      detectionsImported: 0,
      segmentationsImported: 0,
      measurementsImported: 0,
      reportsImported: 0,
      import_type: 'session'
    };
  }
}

async function importSessionsToPatient(zip: JSZip, metadata: DirdExportMetadata, targetPatientId: number): Promise <ImportResult> {
  try {
    if (!metadata.sessions || metadata.sessions.length === 0) {
      throw new Error('Invalid session import: no sessions found');
    }

    let sessionsImported = 0;
    let imagesImported = 0;
    let detectionsImported = 0;
    let segmentationsImported = 0;
    let measurementsImported = 0;
    let reportsImported = 0;

    // import sessions
    for (const sessionData of metadata.sessions) {
      const sessionFolderPath = `sessions/session_${String(sessionData.sessionNumber).padStart(3, '0')}`;
      const sessionFolder = zip.folder(sessionFolderPath);
      if (!sessionFolder) continue;

      // overwrite check
      const existingSession = await db.sessions.where('patientId').equals(targetPatientId).and(s => s.sessionNumber === sessionData.sessionNumber).first();

      if (existingSession) {
        const overwrite = confirm(`La sesión ${sessionData.name} (${sessionData.sessionNumber}) ya existe. ¿Deseas sobrescribirla?`);
        if (!overwrite) continue;
        await deleteSessionData(existingSession.id!);
      }

      const newSessionId = await db.sessions.add({
        ...sessionData,
        id: undefined,
        patientId: targetPatientId
      })
      sessionsImported++;

      // import images
      const imagesMetaFile = zip.file(`${sessionFolderPath}/images_metadata.json`);
      if (!imagesMetaFile) continue;

      const imagesMeta = JSON.parse(await imagesMetaFile.async('text'));
      const imageIdMap = new Map<number,number>();

      for (const imgMeta of imagesMeta) {
        const imageFile = zip.file(`${sessionFolderPath}/images/${imgMeta.filename}`);
        if (!imageFile) continue;

        const blob = await imageFile.async('blob');
        const img = await loadImageFromBlob(blob);

        const newImageId = await db.images.add({
          sessionId: newSessionId as number,
          filename: imgMeta.filename,
          eyeType: imgMeta.eyeType,
          originalBlob: blob,
          width: img.width,
          height: img.height,
          uploadedAt: new Date()
        });

        imageIdMap.set(imgMeta.id, newImageId as number);
        imagesImported++;
      }

      // import detections
      const detectionsFile = zip.file(`${sessionFolderPath}/detections.json`);
      if (detectionsFile) {
        const detections: Detection[] = JSON.parse(await detectionsFile.async('text'));
        for (const detection of detections) {
          const newImageId = imageIdMap.get(detection.imageId as number);
          if (!newImageId) continue;

          await db.detections.add({
            ...detection,
            id: undefined,
            imageId: newImageId
          });
          detectionsImported++;
        }
      }

      // import segmentations
      const segmentationsFile = zip.file(`${sessionFolderPath}/segmentations.json`);
      if (segmentationsFile) {
        const segmentations: Segmentation[] = JSON.parse(await segmentationsFile.async('text'));
        for (const segmentation of segmentations) {
          const newImageId = imageIdMap.get(segmentation.imageId as number);
          if (!newImageId) continue;

          await db.segmentations.add({
            ...segmentation,
            id: undefined,
            imageId: newImageId
          });
          segmentationsImported++;
        }
      }

      // measurements
      const measurementsFile = zip.file(`${sessionFolderPath}/measurements.json`);
      if (measurementsFile) {
        const measurements: Measurement[] = JSON.parse(await measurementsFile.async('text'));
        for (const measurement of measurements) {
          const newImageId = imageIdMap.get(measurement.imageId as number);
          if (!newImageId) continue;

          await db.measurements.add({
            ...measurement,
            id: undefined,
            imageId: newImageId
          });
          measurementsImported++;
        }
      }

      // import reports
      const reportFiles = Object.keys(zip.files).filter(
        name =>
          name.startsWith(`${sessionFolderPath}/reports/`) &&
          name.endsWith('.pdf')
      );

      for (const reportPath of reportFiles) {
        const blob = await zip.files[reportPath].async('blob');
        const reportType = reportPath.includes('final') ? 'final' : 'preview';

        await db.reports.add({
          sessionId: newSessionId as number,
          type: reportType as 'preview' | 'final',
          reportCategory: 'single',
          pdfBlob: blob,
          evaluatorNotes: '',
          areasOfInterest: [],
          generatedAt: new Date()
        });

        reportsImported++;
      }
    }

    return {
      success: true,
      sessionsImported,
      imagesImported,
      detectionsImported,
      segmentationsImported,
      measurementsImported,
      reportsImported,
      import_type: 'session'
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      sessionsImported: 0,
      imagesImported: 0,
      detectionsImported: 0,
      segmentationsImported: 0,
      measurementsImported: 0,
      reportsImported: 0,
      import_type: 'session'
    };
  }
}

async function importPatientZip(zip: JSZip, metadata: DirdExportMetadata): Promise<ImportResult> {
  try {

    if (!metadata.patient || !metadata.sessions) {
      throw new Error('Invalid patient export: missing patient or sessions');
    }

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
          segmentationsImported: 0,
          reportsImported: 0,
          measurementsImported: 0
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

    const importedPatient = await db.patients.get(patientId as number);
    let sessionsImported = 0;
    let imagesImported = 0;
    let detectionsImported = 0;
    let segmentationsImported = 0;
    let measurementsImported = 0;
    let reportsImported = 0;

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

      const imagesMetaFile = zip.file(`${sessionFolderName}/images_metadata.json`);
      if (!imagesMetaFile) {
        throw new Error('Missing image.json');
      }
      const imagesMeta = JSON.parse(await imagesMetaFile.async('text'));


      // Map old image IDs to new ones
      const imageIdMap = new Map<number, number>();

      for (const imgMeta of imagesMeta) {
        const blob = await zip.file(`${sessionFolderName}/images/${imgMeta.filename}`)!.async('blob');

        // Load image to get dimensions
        const img = await loadImageFromBlob(blob);

        const newImageId = await db.images.add({
          sessionId: sessionId as number,
          filename: imgMeta.filename,
          eyeType: imgMeta.eyeType, // Default value for imported images
          originalBlob: blob,
          width: img.width,
          height: img.height,
          uploadedAt: new Date(),
        });

        imageIdMap.set(imgMeta.id, newImageId as number);
        imagesImported++;
        }

        // Import detections
        const detectionsFile = zip.file(`${sessionFolderName}/detections.json`);
        if (detectionsFile) {
          const detectionsContent = await detectionsFile.async('text');
          const detections: Detection[] = JSON.parse(detectionsContent);

          for (const detection of detections) {
            // Map old imageId to new imageId
            const newImageId = imageIdMap.get(detection.imageId as number);

            if (!newImageId) {
              throw new Error('Missing image mapping for imageId ${detection.imageId}')
            }

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
            const newImageId = imageIdMap.get(segmentation.imageId as number);

            if (!newImageId) {
              throw new Error('Missing image mapping for imageId ${detection.imageId}')
            }

            await db.segmentations.add({
              ...segmentation,
              id: undefined,
              imageId: newImageId,
            });
            segmentationsImported++;
          }
        }

        // Import measurements 
        const measurementsFile = zip.file(`${sessionFolderName}/measurements.json`);
        if (measurementsFile) {
          const measurementsContent = await measurementsFile.async('text');
          const measurements: Measurement[] = JSON.parse(measurementsContent);

          for (const measurement of measurements) {
            const newImageId = imageIdMap.get(measurement.imageId as number);

            if (!newImageId) {
              throw new Error('Missing image mapping for imageId ${detection.imageId}')
            }

            await db.measurements.add({
              ...measurement,
              id: undefined,
              imageId: newImageId,
            });
            measurementsImported++;
          }
        }

        // Import reports
        const reportFiles = Object.keys(zip.files).filter(
          (name) => name.startsWith(`${sessionFolderName}/reports/`) && name.endsWith('.pdf')
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
          reportsImported++;
        }
      }

    return {
      success: true,
      patient: importedPatient,
      sessionsImported,
      imagesImported,
      detectionsImported,
      segmentationsImported,
      measurementsImported,
      reportsImported,
      import_type: 'patient'
    };
  } catch (error) {
    console.error('Error importing .dird file:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      sessionsImported: 0,
      imagesImported: 0,
      detectionsImported: 0,
      segmentationsImported: 0,
      measurementsImported: 0,
      reportsImported: 0,
      import_type: 'patient'
    };
  }
}

async function importPatientFromFolder(zip: JSZip, basePath: string): Promise<ImportResult> {
  
  const metadataFile = zip.file(`${basePath}/metadata.json`);
  if (!metadataFile) {
    throw new Error(`Missing metadata.json in ${basePath}`);
  }

  const metadata: DirdExportMetadata = JSON.parse(
    await metadataFile.async('text')
  );

  if (!metadata.patient || !metadata.sessions) {
    throw new Error('Invalid patient export');
  }

  // overwrite check
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
        segmentationsImported: 0,
        reportsImported: 0,
        measurementsImported: 0
      };
    }
    await deletePatientData(existingPatient.id!);
  }

  const patientId = await db.patients.add({
    ...metadata.patient,
    id: undefined,
  });

  let sessionsImported = 0;
  let imagesImported = 0;
  let detectionsImported = 0;
  let segmentationsImported = 0;
  let measurementsImported = 0;
  let reportsImported = 0;

  // Import sessions
  for (const sessionData of metadata.sessions) {
    const sessionFolderName = `sessions/session_${String(sessionData.sessionNumber).padStart(3, '0')}`;
    const sessionBasePath = `${basePath}/${sessionFolderName}`;

    // Import session
    const sessionId = await db.sessions.add({
      ...sessionData,
      id: undefined,
      patientId: patientId as number,
    });
    sessionsImported++;

    // Import images

    const imagesMetaFile = zip.file(`${sessionBasePath}/images_metadata.json`);
    if (!imagesMetaFile) {
      throw new Error('Missing image.json');
    }
    const imagesMeta = JSON.parse(await imagesMetaFile.async('text'));

      // Map old image IDs to new ones
      const imageIdMap = new Map<number, number>();

      for (const imgMeta of imagesMeta) {
        const imageFile = zip.file(`${sessionBasePath}/images/${imgMeta.filename}`);
        if (!imageFile) continue;
        const blob = await imageFile.async('blob');

        // Load image to get dimensions
        const img = await loadImageFromBlob(blob);

        const newImageId = await db.images.add({
          sessionId: sessionId as number,
          filename: imgMeta.filename,
          eyeType: imgMeta.eyeType, // Default value for imported images
          originalBlob: blob,
          width: img.width,
          height: img.height,
          uploadedAt: new Date(imgMeta.uploadedAt),
        });

        imageIdMap.set(imgMeta.id, newImageId as number);
        imagesImported++;
        }

    // Import detections
    const detectionsFile = zip.file(`${sessionBasePath}/detections.json`);
    if (detectionsFile) {
      const detections: Detection[] = JSON.parse(await detectionsFile.async('text'));

      for (const detection of detections) {
        const newImageId = imageIdMap.get(detection.imageId as number);
        if (!newImageId) {
          throw new Error('Missing image mapping for imageId ${detection.imageId}')
        }

        await db.detections.add({
          ...detection,
          id: undefined,
          imageId: newImageId,
        });
        detectionsImported++;
      }
    }

    // Import segmentations
    const segmentationsFile = zip.file(`${sessionBasePath}/segmentations.json`);
    if (segmentationsFile) {
      const segmentations: Segmentation[] = JSON.parse(
        await segmentationsFile.async('text')
      );

      for (const segmentation of segmentations) {
        const newImageId = imageIdMap.get(segmentation.imageId as number);
        if (!newImageId) {
          throw new Error('Missing image mapping for imageId ${detection.imageId}')
        }
        await db.segmentations.add({
          ...segmentation,
          id: undefined,
          imageId: newImageId,
        });
        segmentationsImported++;
      }
    }

    // Import reports
    const reportFiles = Object.keys(zip.files).filter(
      name => name.startsWith(`${sessionBasePath}/reports/`) && name.endsWith('.pdf')
    );

    for (const reportPath of reportFiles) {
      const blob = await zip.files[reportPath].async('blob');
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
      reportsImported++;
    }

    // Import measurements
    const measurementsFile = zip.file(`${sessionBasePath}/measurements.json`);
    if (measurementsFile) {
      const measurements: Measurement[] = JSON.parse(
        await measurementsFile.async('text')
      );

      for (const measurement of measurements) {
        const newImageId = imageIdMap.get(measurement.imageId as number);

        if (!newImageId) {
          throw new Error('Missing image mapping for imageId ${detection.imageId}')
        }
          await db.measurements.add({
            ...measurement,
            id: undefined,
            imageId: newImageId,
          });
          measurementsImported++;
      }
    }
  }

  return {
    success: true,
    sessionsImported,
    imagesImported,
    detectionsImported,
    segmentationsImported,
    measurementsImported,
    reportsImported,
    patient: await db.patients.get(patientId as number),
  };
}


async function importFullZip(zip: JSZip, _metadata: DirdExportMetadata): Promise<ImportResult> {
  let totalSessions = 0;
  let totalImages = 0;
  let totalDetections = 0;
  let totalPatients = 0;
  let totalSegmentations = 0;
  let totalReports = 0;
  let totalMeasurements = 0;

  // Only treat real folders (ending with /) as patient folders
  const patientFolders = Object.keys(zip.files).filter(name => {
    if (!zip.files[name].dir) return false;
    if (!name.startsWith('paciente_')) return false;
  
    // remove trailing slash and check depth
    const trimmed = name.replace(/\/$/, '');
    return !trimmed.includes('/');
  });
  

  for (const folder of patientFolders) {
    try {
      const result = await importPatientFromFolder(zip, folder.replace(/\/$/, ''));

      if (!result.success) {
        return result;
      }

      totalPatients++;
      totalSessions += result.sessionsImported || 0;
      totalImages += result.imagesImported;
      totalDetections += result.detectionsImported;
      totalSegmentations += result.segmentationsImported;
      totalReports += result.reportsImported;
      totalMeasurements += result.measurementsImported;

    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : 'Error importing patient folder',
        sessionsImported: totalSessions,
        imagesImported: totalImages,
        detectionsImported: totalDetections,
        segmentationsImported: totalSegmentations,
        measurementsImported: totalMeasurements,
        reportsImported: totalReports,
        patientsImported: totalPatients,
        import_type: 'full'
      };
    }
  }

  return {
    success: true,
    sessionsImported: totalSessions,
    imagesImported: totalImages,
    detectionsImported: totalDetections,
    patientsImported: totalPatients,
    segmentationsImported: totalSegmentations,
    measurementsImported: totalMeasurements,
    reportsImported: totalReports,
    import_type: 'full'
  };
}

export async function importDirdFile(
  file: File,
  targetPatientId?: number,
  password?: string,
): Promise<ImportResult> {
  try {
    const zip = await readDirdAsZip(file, password);

    // Read metadata
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid .dird file: metadata.json not found');
    }

    const metadataContent = await metadataFile.async('text');
    const metadata: DirdExportMetadata = JSON.parse(metadataContent);

    switch (metadata.export_type) {
      case 'patient':
        if (!targetPatientId) return importPatientZip(zip, metadata);
        return importSessionsToPatient(zip, metadata, targetPatientId);
    
      case 'session':
        if (!targetPatientId) {
          throw new Error('Target patient ID is required for session import');
        }
        return importSessionZip(zip, metadata, targetPatientId);
    
      case 'full':
        return importFullZip(zip, metadata);
    
      default:
        throw new Error('Unsupported export type');
    }

  } catch (error) {

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido',
      sessionsImported: 0,
      imagesImported: 0,
      detectionsImported: 0,
      segmentationsImported: 0,
      measurementsImported: 0,
      reportsImported: 0
    };
  }
}

export async function importDirdType(file: File, password?: string): Promise<DirdExportMetadata['export_type'] | null > {
  try {
    const zip = await readDirdAsZip(file, password);

    // Read metadata
    const metadataFile = zip.file('metadata.json');
    if (!metadataFile) {
      throw new Error('Invalid .dird file: metadata.json not found');
    }

    const metadataContent = await metadataFile.async('text');
    const metadata: DirdExportMetadata = JSON.parse(metadataContent);

    return metadata.export_type;
    
  } catch (error) {
    console.error('Error determining .dird file type:', error);
    return null;

  }
}